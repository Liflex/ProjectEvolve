"""SDK-based research experiment runner with token-aware session management.

Replaces the subprocess-based Claude CLI calls in autoresearch.py with
direct claude-code-sdk query() calls. Supports session continuation
between experiments with automatic reset when token usage approaches
the context window limit (to avoid quality degradation from compression).
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

# ---------------------------------------------------------------------------
# Monkey-patch SDK message parser to handle unknown message types
# (e.g. rate_limit_event) instead of crashing with MessageParseError.
# ---------------------------------------------------------------------------
try:
    from claude_code_sdk._internal import message_parser as _mp
    from claude_code_sdk.types import SystemMessage as _SysMsg

    _original_parse = _mp.parse_message

    def _safe_parse_message(data: dict) -> Any:
        try:
            return _original_parse(data)
        except Exception:
            # Wrap unknown event types as SystemMessage so the stream continues
            return _SysMsg(subtype=data.get("type", "unknown"), data=data)

    _mp.parse_message = _safe_parse_message
except ImportError:
    pass  # SDK not installed

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Token tracking
# ---------------------------------------------------------------------------

@dataclass
class TokenBudget:
    """Tracks cumulative token usage across experiments in a single session.

    When the estimated context size approaches ``threshold``, the runner
    should start a fresh session to avoid context quantization / compression
    that degrades reasoning quality.
    """

    threshold: int = 100_000
    """Hard ceiling. If current input_tokens >= threshold, force new session."""

    soft_threshold: int = 80_000
    """Soft ceiling. If current + avg_experiment_tokens >= threshold, preemptive reset."""

    input_tokens: int = 0
    """Last reported input_tokens (= full context size seen by the model)."""

    output_tokens: int = 0
    """Cumulative output_tokens across experiments in this session."""

    total_cost_usd: float = 0.0
    """Cumulative cost across ALL sessions (not reset)."""

    _experiment_input_sizes: list[int] = field(default_factory=list)
    """History of per-experiment input_token deltas for avg estimation."""

    def update_from_result(self, usage: Dict[str, Any], cost: Optional[float] = None) -> None:
        """Update counters from a ResultMessage.usage dict.

        The SDK ``usage`` dict typically contains:
        ``{"input_tokens": N, "output_tokens": M, ...}``
        where ``input_tokens`` reflects the **full context window** at the
        end of the query (system + history + last response).
        """
        prev_input = self.input_tokens
        self.input_tokens = usage.get("input_tokens", self.input_tokens)
        self.output_tokens += usage.get("output_tokens", 0)
        if cost:
            self.total_cost_usd += cost

        delta = self.input_tokens - prev_input
        if delta > 0:
            self._experiment_input_sizes.append(delta)

    @property
    def avg_experiment_tokens(self) -> int:
        """Average input_tokens growth per experiment (rough estimate)."""
        if not self._experiment_input_sizes:
            return 25_000  # conservative default ~25K per experiment
        return int(sum(self._experiment_input_sizes) / len(self._experiment_input_sizes))

    def should_reset(self) -> bool:
        """True if continuing the session risks hitting compression."""
        if self.input_tokens >= self.threshold:
            return True
        if self.input_tokens + self.avg_experiment_tokens >= self.soft_threshold:
            return True
        return False

    def reset_session(self) -> None:
        """Reset per-session counters (keeps cost and history)."""
        self.input_tokens = 0
        self.output_tokens = 0
        # Keep _experiment_input_sizes for better avg estimation

    def to_dict(self) -> dict:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_cost_usd": round(self.total_cost_usd, 4),
            "avg_experiment_tokens": self.avg_experiment_tokens,
            "threshold": self.threshold,
            "soft_threshold": self.soft_threshold,
            "should_reset": self.should_reset(),
        }


# ---------------------------------------------------------------------------
# Event types emitted by ResearchRunner
# ---------------------------------------------------------------------------

EVENT_RUN_START = "run_start"
EVENT_RUN_END = "run_end"
EVENT_EXP_START = "experiment_start"
EVENT_EXP_END = "experiment_end"
EVENT_SESSION_RESET = "session_reset"
EVENT_AGENT = "agent_event"          # wraps individual SDK messages
EVENT_LOG = "log"
EVENT_ERROR = "error"
EVENT_TOKENS = "tokens_update"
EVENT_JUDGE = "judge_verdict"        # post-experiment judge evaluation


def _make_event(event_type: str, **data) -> dict:
    return {"type": event_type, "timestamp": datetime.now().isoformat(), **data}


# ---------------------------------------------------------------------------
# ResearchRunner
# ---------------------------------------------------------------------------

class ResearchRunner:
    """Runs a sequence of research experiments using claude-code-sdk.

    Each experiment is a single ``query()`` call. Sessions are continued
    between experiments (``continue_conversation=True``) until the token
    budget signals a reset, at which point a fresh session starts.

    Events are emitted to registered listeners for real-time UI streaming.
    """

    def __init__(
        self,
        project_dir: Path,
        strategy: str = "default",
        max_turns: int = 100,
        token_threshold: int = 100_000,
        token_soft_threshold: int = 80_000,
    ):
        self.project_dir = project_dir.resolve()
        self.strategy = strategy
        self.max_turns = max_turns

        self.tokens = TokenBudget(
            threshold=token_threshold,
            soft_threshold=token_soft_threshold,
        )

        # Session state
        self._session_id: Optional[str] = None  # SDK session_id for resume
        self._experiment_count_in_session: int = 0

        # Run state
        self._cancelled = False
        self._running = False
        self.current_experiment: int = 0
        self.total_experiments: int = 0
        self.started_at: Optional[str] = None
        self.error: Optional[str] = None
        self.results: List[Dict[str, Any]] = []

        # Listeners
        self._listeners: List[Callable[[dict], Any]] = []

    # -- listeners --

    def add_listener(self, fn: Callable[[dict], Any]) -> None:
        self._listeners.append(fn)

    async def _emit(self, event: dict) -> None:
        for fn in self._listeners:
            try:
                result = fn(event)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                logger.exception("Listener error")

    # -- public API --

    @property
    def is_running(self) -> bool:
        return self._running

    def cancel(self) -> None:
        self._cancelled = True

    @staticmethod
    async def _prompt_as_stream(text: str):
        """Yield a single user message for streaming mode.

        The SDK has two modes:
        - String mode: passes prompt as CLI argument (``--print -- <prompt>``)
          which hits the Windows command-line length limit (~8191 chars).
        - Streaming mode: passes prompt via stdin (``--input-format stream-json``)
          which has no length limit.

        We always use streaming mode to avoid the Windows limit.
        """
        yield {
            "type": "user",
            "message": {"role": "user", "content": text},
        }

    def _run_judge(self, experiment_number: int, report_text: str) -> Optional[Dict[str, Any]]:
        """Run all judge profiles on the last experiment commit.

        Returns the multi-profile verdict dict, or None on error.
        Judge failures are non-fatal — logged but don't break the loop.
        """
        try:
            from utils.judge import ExperimentJudge, JudgeHistory
            import json as _json

            judge = ExperimentJudge(self.project_dir)
            verdict = judge.evaluate_all(
                report_text=report_text,
            )

            # Persist verdict to experiments directory
            exp_dir = self.project_dir / ".autoresearch" / "experiments"
            if exp_dir.exists():
                judge_file = exp_dir / f"judge_{experiment_number}_all.json"
                judge_file.write_text(
                    _json.dumps(verdict, indent=2), encoding="utf-8"
                )

            # Auto-adjust weights based on accumulated history
            try:
                history = JudgeHistory(self.project_dir)
                result = history.auto_adjust(min_verdicts=5)
                if result and result.get("applied"):
                    logger.info(
                        "Judge weights auto-adjusted after exp %d: %s",
                        experiment_number, result.get("reason", ""),
                    )
            except Exception as adj_err:
                logger.debug("Judge weight auto-adjust skipped: %s", adj_err)

            return verdict
        except Exception as e:
            logger.warning("Judge evaluation failed for exp %d: %s", experiment_number, e)
            return None

    async def run_experiment(
        self,
        prompt: str,
        iteration: int,
    ) -> Dict[str, Any]:
        """Run a single experiment via SDK query().

        Returns dict with keys: status, output, session_id, usage.
        """
        from claude_code_sdk import ClaudeCodeOptions, query

        # Unset CLAUDECODE/CLAUDE_SESSION_ID to prevent "nested session" error.
        # The SDK merges options.env on top of os.environ, so setting empty
        # strings effectively removes these vars from the child process.
        clean_env = {}
        for var in ("CLAUDECODE", "CLAUDE_SESSION_ID"):
            if var in os.environ:
                clean_env[var] = ""

        options = ClaudeCodeOptions(
            cwd=str(self.project_dir),
            max_turns=self.max_turns,
            permission_mode="bypassPermissions",
            env=clean_env,
        )

        # Session continuation logic
        if self._session_id and self._experiment_count_in_session > 0:
            options.continue_conversation = True
            options.resume = self._session_id
            logger.info(
                "Experiment %d: continuing session %s (tokens: %d)",
                iteration, self._session_id, self.tokens.input_tokens,
            )
        else:
            logger.info("Experiment %d: starting fresh session", iteration)

        output_parts: list[str] = []
        result_data: Dict[str, Any] = {}

        try:
            # Use streaming mode to avoid Windows command-line length limit.
            # String mode passes prompt as CLI arg (--print -- <prompt>) which
            # fails on Windows when prompt > ~8KB.  Streaming mode sends via
            # stdin (--input-format stream-json) with no size limit.
            prompt_stream = self._prompt_as_stream(prompt)
            async for message in query(prompt=prompt_stream, options=options):
                if self._cancelled:
                    break

                event_dict = asdict(message)
                msg_type = type(message).__name__

                # Stream to UI
                await self._emit(_make_event(
                    EVENT_AGENT,
                    message_type=msg_type,
                    data=event_dict,
                ))

                # Collect text output from AssistantMessage
                if msg_type == "AssistantMessage":
                    for block in event_dict.get("content", []):
                        if isinstance(block, dict) and block.get("text"):
                            output_parts.append(block["text"])

                # Capture ResultMessage (final)
                if msg_type == "ResultMessage":
                    result_data = event_dict
                    # Update token tracking
                    usage = event_dict.get("usage") or {}
                    cost = event_dict.get("total_cost_usd")
                    self.tokens.update_from_result(usage, cost)
                    # Capture session_id for continuation
                    sid = event_dict.get("session_id")
                    if sid:
                        self._session_id = sid
                    self._experiment_count_in_session += 1

                    await self._emit(_make_event(
                        EVENT_TOKENS,
                        **self.tokens.to_dict(),
                    ))

        except asyncio.CancelledError:
            return {"status": "cancelled", "output": "", "session_id": self._session_id}
        except Exception as e:
            logger.error("Experiment %d error: %s", iteration, e)
            await self._emit(_make_event(EVENT_ERROR, message=str(e), experiment=iteration))
            return {"status": "error", "error": str(e), "session_id": self._session_id}

        full_output = "\n".join(output_parts)
        is_complete = ">>>EXPERIMENT_COMPLETE<<<" in full_output

        return {
            "status": "success" if is_complete else "incomplete",
            "output": full_output,
            "session_id": self._session_id,
            "usage": result_data.get("usage"),
            "cost": result_data.get("total_cost_usd"),
            "num_turns": result_data.get("num_turns", 0),
        }

    async def run_loop(
        self,
        iterations: int,
        start_from: int,
        timeout_min: int,
        max_time: Optional[int] = None,
        build_prompt_fn: Optional[Callable[..., str]] = None,
    ) -> List[Dict[str, Any]]:
        """Main research loop — async replacement for run_autoresearch().

        Args:
            iterations: Number of experiments to run.
            start_from: Starting experiment number.
            timeout_min: Minutes to wait between experiments.
            max_time: Maximum total wall time in seconds (None = unlimited).
            build_prompt_fn: Callable(iteration, total) -> str that builds
                the prompt. If None, caller must have set prompts externally.

        Returns:
            List of experiment result dicts.
        """
        self._cancelled = False
        self._running = True
        self.total_experiments = iterations
        self.started_at = datetime.now().isoformat()
        self.results = []
        self.error = None

        max_number = start_from + iterations - 1
        deadline = time.time() + max_time if max_time else None

        await self._emit(_make_event(
            EVENT_RUN_START,
            start_from=start_from,
            iterations=iterations,
            max_number=max_number,
            strategy=self.strategy,
            project=str(self.project_dir),
        ))

        try:
            for i in range(start_from, max_number + 1):
                if self._cancelled:
                    await self._emit(_make_event(EVENT_LOG, message="Run cancelled by user."))
                    break

                if deadline and time.time() >= deadline:
                    await self._emit(_make_event(EVENT_LOG, message=f"Time limit ({max_time}s) reached."))
                    break

                # --- Token budget: check if we need a fresh session ---
                if self.tokens.should_reset() and self._session_id:
                    await self._emit(_make_event(
                        EVENT_SESSION_RESET,
                        reason="token_budget",
                        input_tokens=self.tokens.input_tokens,
                        threshold=self.tokens.threshold,
                        avg_experiment=self.tokens.avg_experiment_tokens,
                    ))
                    logger.info(
                        "Resetting session: input_tokens=%d >= soft_threshold=%d",
                        self.tokens.input_tokens, self.tokens.soft_threshold,
                    )
                    self._session_id = None
                    self._experiment_count_in_session = 0
                    self.tokens.reset_session()

                self.current_experiment = i

                await self._emit(_make_event(
                    EVENT_EXP_START,
                    number=i,
                    total=max_number,
                    session_id=self._session_id,
                    session_continued=self._session_id is not None,
                    tokens=self.tokens.to_dict(),
                ))

                # Build prompt
                if build_prompt_fn is None:
                    raise ValueError("build_prompt_fn is required")
                prompt = build_prompt_fn(i, max_number)

                # Run experiment
                result = await self.run_experiment(prompt, i)
                self.results.append(result)

                await self._emit(_make_event(
                    EVENT_EXP_END,
                    number=i,
                    total=max_number,
                    status=result.get("status"),
                    session_id=result.get("session_id"),
                    usage=result.get("usage"),
                    cost=result.get("cost"),
                    tokens=self.tokens.to_dict(),
                ))

                # --- Auto-judge: evaluate experiment after completion ---
                if result.get("status") == "success":
                    judge_verdict = self._run_judge(i, result.get("output", ""))
                    if judge_verdict:
                        result["judge"] = judge_verdict
                        await self._emit(_make_event(
                            EVENT_JUDGE,
                            number=i,
                            consensus=judge_verdict.get("consensus"),
                            consensus_score=judge_verdict.get("consensus_score"),
                            profiles=judge_verdict.get("profiles"),
                        ))
                        logger.info(
                            "Judge verdict for exp %d: %s (score=%.2f)",
                            i, judge_verdict.get("consensus"),
                            judge_verdict.get("consensus_score", 0),
                        )

                # Pause between experiments
                if i < max_number and timeout_min > 0 and not self._cancelled:
                    await self._emit(_make_event(
                        EVENT_LOG,
                        message=f"Waiting {timeout_min} min before next experiment...",
                    ))
                    try:
                        await asyncio.sleep(timeout_min * 60)
                    except asyncio.CancelledError:
                        break

        except Exception as e:
            self.error = str(e)
            logger.exception("Research loop error")
            await self._emit(_make_event(EVENT_ERROR, message=str(e)))

        finally:
            self._running = False
            successful = sum(1 for r in self.results if r.get("status") == "success")
            await self._emit(_make_event(
                EVENT_RUN_END,
                total_run=len(self.results),
                successful=successful,
                total_cost_usd=round(self.tokens.total_cost_usd, 4),
                error=self.error,
            ))

        return self.results

    def get_status(self) -> dict:
        """Snapshot for /api/run/status compatibility."""
        return {
            "running": self._running,
            "current_exp": self.current_experiment,
            "total_exps": self.total_experiments,
            "project": str(self.project_dir),
            "started_at": self.started_at,
            "error": self.error,
            "session_id": self._session_id,
            "tokens": self.tokens.to_dict(),
        }
