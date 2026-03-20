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

from agents.revert_analytics import RevertAnalytics


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
        parallel_judges: bool = False,
        decompose: bool = False,
    ):
        self.project_dir = project_dir.resolve()
        self.revert_analytics = RevertAnalytics(self.project_dir)
        self.strategy = strategy
        self.max_turns = max_turns
        self.parallel_judges = parallel_judges
        self.decompose = decompose

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
    async def _run_judge(self, experiment_number: int, report_text: str) -> Optional[Dict[str, Any]]:
        """Run all judge profiles on the last experiment commit.

        When ``self.parallel_judges`` is True, uses ParallelAgentRunner to
        run each judge profile as a separate independent agent concurrently.
        Otherwise falls back to sequential ExperimentJudge.evaluate_all().

        Returns the multi-profile verdict dict, or None on error.
        Judge failures are non-fatal -- logged but don't break the loop.
        """
        import json as _json

        try:
            verdict = None

            if self.parallel_judges:
                # --- Parallel mode: independent agents per profile ---
                from agents.parallel import run_parallel_judges

                await self._emit(_make_event(
                    EVENT_LOG,
                    message=f"Running parallel judges for exp {experiment_number}...",
                ))

                result = await run_parallel_judges(
                    project_dir=self.project_dir,
                    report_text=report_text,
                )

                # Normalize format to match evaluate_all() output
                profiles: Dict[str, Dict[str, Any]] = {}
                for label, v in result.get("verdicts", {}).items():
                    # label is "judge-strict", "judge-balanced", etc.
                    profile_name = label.replace("judge-", "")
                    profiles[profile_name] = {
                        "recommendation": v.get("verdict", "DISCARD"),
                        "score": v.get("score", 0.0),
                        "reason": v.get("reason", ""),
                        "risks": v.get("risks", []),
                        "source": "parallel_agent",
                    }

                if profiles:
                    # Use consensus from run_parallel_judges directly
                    consensus = result.get("consensus", "REVIEW")
                    avg_score = result.get("consensus_score", 0.0)
                    parsed_count = result.get("parsed", 0)

                    verdict = {
                        "profiles": profiles,
                        "consensus": consensus,
                        "consensus_score": round(avg_score, 2),
                        "agent_decision": "",
                        "agent_score": None,
                        "available_profiles": list(profiles.keys()),
                        "parallel_mode": True,
                        "total_agents": result.get("total_agents", 0),
                        "completed_agents": result.get("completed", 0),
                        "parsed_agents": parsed_count,
                    }

                    chief_called = result.get("chief_called", False)
                    chief_info = " + chief" if chief_called else ""
                    await self._emit(_make_event(
                        EVENT_LOG,
                        message=f"Parallel judges done: {consensus} "
                                f"(score={avg_score:.2f}, "
                                f"{parsed_count}/{result.get('completed', 0)} parsed{chief_info})",
                    ))
            else:
                # --- Sequential mode: local ExperimentJudge ---
                from utils.judge import ExperimentJudge

                judge = ExperimentJudge(self.project_dir)
                verdict = judge.evaluate_all(
                    report_text=report_text,
                )

            if verdict is None:
                return None

            # Persist verdict to experiments directory
            exp_dir = self.project_dir / ".autoresearch" / "experiments"
            if exp_dir.exists():
                judge_file = exp_dir / f"judge_{experiment_number}_all.json"
                judge_file.write_text(
                    _json.dumps(verdict, indent=2), encoding="utf-8"
                )

            # --- Conflict resolution: act on consensus ---
            consensus = verdict.get("consensus", "REVIEW")
            score = verdict.get("consensus_score", 0.5)

            # Collect rework remarks from judges to pass to next experiment
            rework_remarks = []
            if consensus == "REWORK":
                for pname, pdata in verdict.get("profiles", {}).items():
                    risks = pdata.get("risks", [])
                    reason = pdata.get("reason", "")
                    if risks:
                        rework_remarks.extend(risks)
                    if reason and pdata.get("recommendation") == "REWORK":
                        rework_remarks.append(f"[{pname}] {reason}")
                # Also check chief
                chief = verdict.get("profiles", {}).get("chief", {})
                if chief.get("risks"):
                    rework_remarks.extend(chief["risks"])
                if rework_remarks:
                    rework_remarks = list(dict.fromkeys(rework_remarks))  # dedupe preserving order
                    await self._emit(_make_event(
                        EVENT_LOG,
                        message=f"REWORK remarks for next experiment: "
                                + "; ".join(rework_remarks[:5]),
                    ))

            # Auto-revert only on DISCARD (REWORK and KEEP are kept)
            auto_reverted = False
            if consensus == "DISCARD" and score < 0.85:
                auto_reverted = await self._auto_revert_discard(
                    experiment_number, consensus, score, verdict,
                )

            # Update verdict with auto_reverted and rework_remarks, re-save to disk
            verdict["auto_reverted"] = auto_reverted
            if rework_remarks:
                verdict["rework_remarks"] = rework_remarks
            if exp_dir.exists():
                judge_file = exp_dir / f"judge_{experiment_number}_all.json"
                judge_file.write_text(
                    _json.dumps(verdict, indent=2), encoding="utf-8"
                )

            # Log conflict resolution details if present
            conflict = verdict.get("conflict_resolution")
            if conflict:
                await self._emit(_make_event(
                    EVENT_LOG,
                    message=f"Conflict resolved: {conflict.get('resolved')} "
                            f"via {conflict.get('resolution_method')} "
                            f"(agent {conflict.get('agent_agreement', '?')})",
                ))

            # Auto-adjust weights based on accumulated history
            try:
                from utils.judge import JudgeHistory
                history = JudgeHistory(self.project_dir)
                adj_result = history.auto_adjust(min_verdicts=5)
                if adj_result and adj_result.get("applied"):
                    logger.info(
                        "Judge weights auto-adjusted after exp %d: %s",
                        experiment_number, adj_result.get("reason", ""),
                    )
            except Exception as adj_err:
                logger.debug("Judge weight auto-adjust skipped: %s", adj_err)

            return verdict
        except Exception as e:
            logger.warning("Judge evaluation failed for exp %d: %s", experiment_number, e)
            return None

    async def _run_decomposed_experiment(
        self,
        prompt: str,
        iteration: int,
    ) -> Dict[str, Any]:
        """Run a single experiment as decomposed parallel sub-tasks.

        When ``self.decompose`` is True and the prompt looks decomposable,
        splits the goal into independent sub-tasks, runs them in parallel
        via ParallelAgentRunner, then aggregates results.

        Falls back to normal sequential execution if decomposition fails.
        """
        from agents.parallel import (
            ParallelAgentRunner,
            ResultAggregator,
            TaskDecomposer,
        )

        await self._emit(_make_event(
            EVENT_LOG,
            message=f"Experiment {iteration}: decomposing into sub-tasks...",
        ))

        decomposer = TaskDecomposer(self.project_dir)
        sub_tasks = await decomposer.decompose(prompt, max_subtasks=3)

        if not sub_tasks:
            await self._emit(_make_event(
                EVENT_LOG,
                message=f"Experiment {iteration}: decomposition failed, falling back to sequential",
            ))
            return await self.run_experiment(prompt, iteration)

        await self._emit(_make_event(
            EVENT_LOG,
            message=f"Experiment {iteration}: decomposed into {len(sub_tasks)} sub-tasks: "
                    + ", ".join(t.label for t in sub_tasks),
        ))

        # Run sub-tasks in parallel
        runner = ParallelAgentRunner(max_concurrency=len(sub_tasks))
        runner.add_listener(lambda event: asyncio.ensure_future(self._emit(event)))

        # Forward parallel events with experiment context
        original_listener = self._emit

        async def _forward_with_context(event: dict):
            event["experiment_number"] = iteration
            await original_listener(event)

        runner._listeners = [_forward_with_context]

        # Snapshot current git state BEFORE sub-tasks run
        import subprocess as _sp_run
        try:
            _snap = _sp_run.run(
                ["git", "diff", "--name-only", "HEAD"],
                capture_output=True, text=True, timeout=10,
                cwd=str(self.project_dir),
                encoding="utf-8", errors="replace",
            )
            files_before = set((_snap.stdout or "").strip().split("\n"))
            files_before.discard("")
        except Exception:
            files_before = set()

        completed = await runner.run(sub_tasks, concurrency=len(sub_tasks))

        # Aggregate results — only check files that changed during THIS run
        aggregator = ResultAggregator(self.project_dir)
        aggregated = aggregator.aggregate(sub_tasks, completed, files_before=files_before)

        await self._emit(_make_event(
            EVENT_LOG,
            message=f"Experiment {iteration}: parallel execution complete — "
                    f"{aggregated.tasks_completed}/{aggregated.tasks_total} tasks, "
                    f"${aggregated.total_cost_usd:.4f}, "
                    f"conflicts={'YES' if aggregated.has_conflicts else 'none'}",
        ))

        # Build unified output from all sub-tasks
        full_output = aggregated.merged_summary
        for task in completed:
            if task.status == "completed" and task.output:
                full_output += f"\n\n--- {task.label} ---\n{task.output}"

        # Track tokens/cost from sub-tasks
        for task in completed:
            if task.usage:
                self.tokens.update_from_result(task.usage, task.cost)

        # Determine overall status
        all_completed = all(t.status == "completed" for t in completed)
        status = "success" if all_completed and not aggregated.has_conflicts else (
            "conflict" if aggregated.has_conflicts else "partial"
        )
        is_complete = ">>>EXPERIMENT_COMPLETE<<<" in full_output

        return {
            "status": "success" if is_complete else status,
            "output": full_output,
            "session_id": self._session_id,
            "usage": None,  # aggregated, not per-agent
            "cost": aggregated.total_cost_usd,
            "num_turns": sum(t.usage.get("num_turns", 0) if t.usage else 0 for t in completed),
            "decomposed": True,
            "subtask_count": len(sub_tasks),
            "subtask_completed": aggregated.tasks_completed,
            "aggregation": aggregated.to_dict(),
        }

    async def _auto_revert_discard(
        self,
        experiment_number: int,
        consensus: str,
        score: float,
        verdict: Dict[str, Any],
    ) -> bool:
        """Auto-revert the experiment commit when judges strongly reject it.

        Reverts the last commit (which should be the experiment commit)
        using ``git revert --no-edit``. Non-destructive — creates a new
        revert commit rather than resetting history.

        Returns True if revert was performed, False otherwise.
        """
        import subprocess as _sp

        try:
            # Verify last commit is the experiment commit
            result = _sp.run(
                ["git", "log", "-1", "--pretty=format:%s"],
                capture_output=True, text=True, timeout=10,
                cwd=str(self.project_dir),
                encoding="utf-8", errors="replace",
            )
            last_msg = (result.stdout or "").strip()

            if not last_msg.startswith(f"exp #{experiment_number}:"):
                await self._emit(_make_event(
                    EVENT_LOG,
                    message=f"Auto-revert skipped: last commit is not exp #{experiment_number} "
                            f"({last_msg[:60]})",
                ))
                return False

            # Perform revert
            await self._emit(_make_event(
                EVENT_LOG,
                message=f"Auto-reverting exp #{experiment_number}: "
                        f"DISCARD consensus (score={score:.2f})",
            ))

            result = _sp.run(
                ["git", "revert", "--no-edit", "HEAD"],
                capture_output=True, text=True, timeout=30,
                cwd=str(self.project_dir),
                encoding="utf-8", errors="replace",
            )

            if result.returncode != 0:
                err = (result.stderr or "unknown error").strip()[:200]
                await self._emit(_make_event(
                    EVENT_LOG,
                    message=f"Auto-revert FAILED for exp #{experiment_number}: {err}",
                ))
                return False

            # Collect changed files from the experiment commit
            files_changed = []
            try:
                diff_result = _sp.run(
                    ["git", "diff-tree", "--no-commit-id", "--name-status", "-r", "HEAD"],
                    capture_output=True, text=True, timeout=10,
                    cwd=str(self.project_dir),
                    encoding="utf-8", errors="replace",
                )
                for line in (diff_result.stdout or "").strip().split("\n"):
                    line = line.strip()
                    if line:
                        parts = line.split("\t", 1)
                        status = parts[0] if parts else "?"
                        fname = parts[1] if len(parts) > 1 else line
                        files_changed.append({"file": fname, "status": status})
            except Exception as diff_err:
                logger.debug("Failed to collect changed files for revert log: %s", diff_err)

            # Collect per-profile scores
            profile_scores = {}
            for pname, pdata in verdict.get("profiles", {}).items():
                profile_scores[pname] = {
                    "recommendation": pdata.get("recommendation", "?"),
                    "score": pdata.get("score"),
                }

            # Build revert reason from judge profiles
            reasons = []
            for pname, pdata in verdict.get("profiles", {}).items():
                if pdata.get("recommendation") == "DISCARD":
                    reason = pdata.get("reason", "")
                    if reason:
                        reasons.append(f"[{pname}] {reason[:120]}")
            revert_reason_str = "; ".join(reasons[:3]) if reasons else f"DISCARD consensus (score={score:.2f})"

            # Record the revert
            revert_msg = f"exp #{experiment_number}(discard): auto-reverted by judge"
            await self._emit(_make_event(
                EVENT_JUDGE,
                number=experiment_number,
                consensus="REVERTED",
                consensus_score=score,
                profiles=verdict.get("profiles"),
                revert_reason="auto_revert_discard",
            ))

            await self._emit(_make_event(
                EVENT_LOG,
                message=f"Auto-revert done for exp #{experiment_number}",
            ))
            logger.info(
                "Auto-reverted exp %d: DISCARD consensus (score=%.2f)",
                experiment_number, score,
            )

            # --- Accumulate structured revert event for analytics ---
            conflict_reason = ""
            conflict_info = verdict.get("conflict_resolution")
            if conflict_info:
                conflict_reason = (
                    f"{conflict_info.get('resolution_method', '')}: "
                    f"{conflict_info.get('resolved', '')}"
                )

            self._log_revert_event(
                experiment_number=experiment_number,
                consensus=consensus,
                score=score,
                reason=revert_reason_str,
                profile_scores=profile_scores,
                files_changed=files_changed,
                conflict_reason=conflict_reason,
            )

            return True

        except Exception as e:
            logger.warning("Auto-revert error for exp %d: %s", experiment_number, e)
            await self._emit(_make_event(
                EVENT_LOG,
                message=f"Auto-revert error for exp #{experiment_number}: {e}",
            ))
            return False

    def _log_revert_event(
        self,
        experiment_number: int,
        consensus: str,
        score: float,
        reason: str,
        profile_scores: Dict[str, Any],
        files_changed: List[Dict[str, str]],
        conflict_reason: str = "",
    ) -> None:
        """Append a structured auto-revert event to the analytics JSON file.

        Stores each revert as a JSON object in
        ``.autoresearch/auto_revert_events.json`` for offline analysis of
        judge effectiveness, common rejection reasons, and file-level impact.
        """
        import json as _json

        events_file = self.project_dir / ".autoresearch" / "auto_revert_events.json"

        event = {
            "experiment_number": experiment_number,
            "timestamp": datetime.now().isoformat(),
            "consensus": consensus,
            "score": round(score, 4),
            "reason": reason,
            "profile_scores": profile_scores,
            "files_changed": files_changed,
        }

        if conflict_reason:
            event["conflict_reason"] = conflict_reason

        try:
            # Read existing events (or start fresh)
            if events_file.exists():
                try:
                    events = _json.loads(events_file.read_text(encoding="utf-8"))
                    if not isinstance(events, list):
                        events = []
                except (_json.JSONDecodeError, OSError):
                    events = []
            else:
                events = []

            events.append(event)

            # Write back atomically
            events_file.write_text(
                _json.dumps(events, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            logger.info(
                "Logged revert event for exp %d (%d total events)",
                experiment_number, len(events),
            )
        except Exception as log_err:
            logger.warning(
                "Failed to log revert event for exp %d: %s",
                experiment_number, log_err,
            )

    async def run_experiment(
        self,
        prompt: str,
        iteration: int,
    ) -> Dict[str, Any]:
        """Run a single experiment via SDK query().

        Returns dict with keys: status, output, session_id, usage.
        """
        from claude_code_sdk import ClaudeCodeOptions, query

        # Temporarily remove CLAUDECODE/CLAUDE_SESSION_ID from os.environ.
        # options.env only affects the child subprocess, but the SDK itself
        # reads os.environ to decide between "nested session" (talk to parent
        # Claude process) and "standalone" (spawn independent subprocess).
        # Removing from os.environ forces standalone mode for every call.
        _saved_env: Dict[str, str] = {}
        for _var in ("CLAUDECODE", "CLAUDE_SESSION_ID"):
            if _var in os.environ:
                _saved_env[_var] = os.environ.pop(_var)

        # Also pass empty strings in options.env for the child process
        clean_env = dict(_saved_env)
        for _k in clean_env:
            clean_env[_k] = ""

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
        finally:
            # Restore env vars after SDK call completes
            for _var, _val in _saved_env.items():
                os.environ[_var] = _val

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

                # Run experiment (decomposed or sequential)
                if self.decompose:
                    result = await self._run_decomposed_experiment(prompt, i)
                else:
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
                    # The experiment SDK call may leave the Claude CLI subprocess
                    # alive (especially with continue_conversation). Kill lingering
                    # processes before starting judges.
                    logger.info(
                        "Experiment %d done. Session_id=%s. Cleaning up before judging...",
                        i, self._session_id,
                    )
                    await asyncio.sleep(3)

                    # Kill any lingering Claude CLI processes from the experiment
                    _killed = await self._kill_lingering_claude_processes()
                    if _killed:
                        logger.info("Killed %d lingering Claude processes before judging", _killed)
                    await asyncio.sleep(2)

                    judge_verdict = await self._run_judge(i, result.get("output", ""))
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

                        # Emit REWORK remarks so agent sees them in next experiment
                        remarks = judge_verdict.get("rework_remarks", [])
                        if remarks and judge_verdict.get("consensus") == "REWORK":
                            await self._emit(_make_event(
                                EVENT_LOG,
                                message="[REWORK] Issues to address in next experiment: "
                                        + "; ".join(remarks[:8]),
                            ))

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

    @staticmethod
    async def _kill_lingering_claude_processes() -> int:
        """Kill any lingering Claude CLI subprocesses from previous SDK calls.

        The SDK's continue_conversation mode can leave CLI processes alive
        after query() completes. These block new SDK calls with
        "Control request timeout: initialize".

        Returns number of processes killed.
        """
        import subprocess as _sp
        import asyncio as _aio

        killed = 0
        try:
            # Find node.exe processes with 'claude' in command line
            find = await _aio.create_subprocess_exec(
                "wmic", "process", "where",
                "name='node.exe' and commandline like '%%claude%%'",
                "get", "processid", "/FORMAT:CSV",
                stdout=_sp.PIPE, stderr=_sp.PIPE,
            )
            stdout, _ = await _aio.wait_for(find.communicate(), timeout=15)
            for line in (stdout or b"").decode("utf-8", errors="replace").strip().split("\n"):
                line = line.strip()
                if not line or line.startswith("Node"):
                    continue
                # CSV: "hostname\pid"
                parts = line.split(",")
                if len(parts) >= 2:
                    pid = parts[1].strip().strip('"')
                    if pid.isdigit():
                        kill = await _aio.create_subprocess_exec(
                            "taskkill", "/F", "/PID", pid,
                            stdout=_sp.PIPE, stderr=_sp.PIPE,
                        )
                        await _aio.wait_for(kill.communicate(), timeout=5)
                        killed += 1
                        logger.info("Killed lingering Claude CLI PID=%s", pid)
        except Exception as e:
            logger.debug("Process cleanup: %s", e)

        # Also remove lock files
        from pathlib import Path as _P
        for d in [_P.home() / ".claude"]:
            try:
                for lock in d.glob("*.lock"):
                    lock.unlink()
                    logger.debug("Removed lock: %s", lock)
            except Exception:
                pass

        return killed

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
            "parallel_judges": self.parallel_judges,
            "decompose": self.decompose,
        }

    # -- revert analytics --

    def get_revert_stats(self) -> Dict[str, Any]:
        """Compute summary statistics from accumulated auto-revert events.

        Reads ``.autoresearch/auto_revert_events.json`` and returns:
        - total_reverts, total_experiments, revert_rate
        - avg_score, min_score, max_score
        - common_reasons (top 5 by frequency)
        - affected_files (sorted by frequency)
        - per_profile_discard_rate
        - recent_reverts (last 10)
        """
        import json as _json
        from collections import Counter

        events_file = self.project_dir / ".autoresearch" / "auto_revert_events.json"

        try:
            if events_file.exists():
                events = _json.loads(events_file.read_text(encoding="utf-8"))
                if not isinstance(events, list):
                    events = []
            else:
                events = []
        except Exception:
            events = []

        if not events:
            return {
                "total_reverts": 0,
                "total_experiments": self.total_experiments or 0,
                "revert_rate": 0.0,
                "avg_score": None,
                "min_score": None,
                "max_score": None,
                "common_reasons": [],
                "affected_files": [],
                "per_profile_discard_rate": {},
                "recent_reverts": [],
            }

        total_reverts = len(events)
        total_exp = max(self.total_experiments or total_reverts, total_reverts)
        revert_rate = round(total_reverts / total_exp, 4) if total_exp else 0.0

        scores = [e.get("score", 0) for e in events if e.get("score") is not None]
        avg_score = round(sum(scores) / len(scores), 4) if scores else None

        # Common reasons — normalize by taking first 80 chars as key
        reason_counter = Counter()
        for e in events:
            r = e.get("reason", "unknown")
            reason_counter[r[:80]] += 1
        common_reasons = [
            {"reason": r, "count": c}
            for r, c in reason_counter.most_common(5)
        ]

        # Affected files
        file_counter = Counter()
        for e in events:
            for fc in e.get("files_changed", []):
                fname = fc.get("file", "") if isinstance(fc, dict) else str(fc)
                if fname:
                    file_counter[fname] += 1
        affected_files = [
            {"file": f, "count": c}
            for f, c in file_counter.most_common(20)
        ]

        # Per-profile discard rate
        profile_total = Counter()
        profile_discard = Counter()
        for e in events:
            for pname, pdata in e.get("profile_scores", {}).items():
                profile_total[pname] += 1
                if pdata.get("recommendation") == "DISCARD":
                    profile_discard[pname] += 1
        per_profile_discard_rate = {
            p: round(profile_discard[p] / profile_total[p], 4) if profile_total[p] else 0.0
            for p in profile_total
        }

        # Recent reverts (last 10)
        recent_reverts = [
            {
                "experiment_number": e.get("experiment_number"),
                "timestamp": e.get("timestamp"),
                "score": e.get("score"),
                "reason": e.get("reason", "")[:120],
            }
            for e in events[-10:]
        ][::-1]  # newest first

        return {
            "total_reverts": total_reverts,
            "total_experiments": total_exp,
            "revert_rate": revert_rate,
            "avg_score": avg_score,
            "min_score": round(min(scores), 4) if scores else None,
            "max_score": round(max(scores), 4) if scores else None,
            "common_reasons": common_reasons,
            "affected_files": affected_files,
            "per_profile_discard_rate": per_profile_discard_rate,
            "recent_reverts": recent_reverts,
        }
