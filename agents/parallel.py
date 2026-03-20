"""Parallel multi-agent runner for concurrent research tasks.

Runs multiple independent Claude Code SDK queries simultaneously using
asyncio.gather. Each agent gets its own prompt and cwd. Results are
collected per-agent with unified event streaming.

Use cases:
  - Parallel evaluation: run multiple judges concurrently
  - Diverse exploration: different agents investigate different aspects
  - Redundant execution: same task, pick best result
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Event types
# ---------------------------------------------------------------------------

EVENT_PARALLEL_START = "parallel_start"
EVENT_PARALLEL_END = "parallel_end"
EVENT_PARALLEL_AGENT_START = "parallel_agent_start"
EVENT_PARALLEL_AGENT_END = "parallel_agent_end"
EVENT_PARALLEL_AGENT_EVENT = "parallel_agent_event"  # per-agent SDK message
EVENT_PARALLEL_ERROR = "parallel_error"


def _make_event(event_type: str, **data) -> dict:
    return {"type": event_type, "timestamp": datetime.now().isoformat(), **data}


# ---------------------------------------------------------------------------
# Agent task descriptor
# ---------------------------------------------------------------------------

class AgentTask:
    """A single agent task within a parallel run."""

    def __init__(
        self,
        label: str,
        prompt: str,
        cwd: str,
        agent_id: Optional[str] = None,
        max_turns: int = 10,
        permission_mode: str = "bypassPermissions",
        model: Optional[str] = None,
        append_system_prompt: Optional[str] = None,
    ):
        self.agent_id = agent_id or str(uuid.uuid4())[:8]
        self.label = label
        self.prompt = prompt
        self.cwd = cwd
        self.max_turns = max_turns
        self.permission_mode = permission_mode
        self.model = model
        self.append_system_prompt = append_system_prompt

        # Runtime state
        self.status: str = "pending"  # pending | running | completed | error | cancelled
        self.output: str = ""
        self.error: Optional[str] = None
        self.usage: Optional[Dict[str, Any]] = None
        self.cost: Optional[float] = None
        self.session_id: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "label": self.label,
            "cwd": self.cwd,
            "status": self.status,
            "output_length": len(self.output),
            "error": self.error,
            "usage": self.usage,
            "cost": self.cost,
        }


# ---------------------------------------------------------------------------
# ParallelAgentRunner
# ---------------------------------------------------------------------------

class ParallelAgentRunner:
    """Run multiple Claude Code agents in parallel.

    Each agent gets its own SDK query() call. All run concurrently
    via asyncio.gather with return_exceptions=True so one failure
    doesn't cancel others.

    Usage::

        runner = ParallelAgentRunner()
        runner.add_listener(my_handler)

        tasks = [
            AgentTask("investigator", prompt1, cwd="/project"),
            AgentTask("critic", prompt2, cwd="/project"),
        ]
        results = await runner.run(tasks, concurrency=2)
    """

    def __init__(self, max_concurrency: int = 3):
        self.max_concurrency = max_concurrency
        self._listeners: List[Callable[[dict], Any]] = []
        self._running = False
        self._cancelled = False
        self._run_id: Optional[str] = None
        self.started_at: Optional[str] = None

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
                logger.exception("Parallel runner listener error")

    # -- public API --

    @property
    def is_running(self) -> bool:
        return self._running

    def cancel(self) -> None:
        """Signal all agents to stop."""
        self._cancelled = True

    @staticmethod
    async def _prompt_as_stream(text: str):
        """Yield a single user message for streaming mode.

        Avoids Windows command-line length limit by sending via stdin.
        """
        yield {
            "type": "user",
            "message": {"role": "user", "content": text},
        }

    async def _run_single_agent(self, task: AgentTask) -> AgentTask:
        """Execute one agent task via SDK query()."""
        from claude_code_sdk import ClaudeCodeOptions, query

        task.status = "running"

        # Clean env to prevent nested session errors
        clean_env = {}
        for var in ("CLAUDECODE", "CLAUDE_SESSION_ID"):
            if var in os.environ:
                clean_env[var] = ""

        options = ClaudeCodeOptions(
            cwd=task.cwd,
            max_turns=task.max_turns,
            permission_mode=task.permission_mode,
            env=clean_env,
        )

        if task.model:
            options.model = task.model
        if task.append_system_prompt:
            options.append_system_prompt = task.append_system_prompt

        output_parts: list[str] = []

        try:
            prompt_stream = self._prompt_as_stream(task.prompt)
            async for message in query(prompt=prompt_stream, options=options):
                if self._cancelled:
                    task.status = "cancelled"
                    return task

                event_dict = asdict(message)
                msg_type = type(message).__name__

                # Stream to listeners with agent context
                await self._emit(_make_event(
                    EVENT_PARALLEL_AGENT_EVENT,
                    run_id=self._run_id,
                    agent_id=task.agent_id,
                    agent_label=task.label,
                    message_type=msg_type,
                    data=event_dict,
                ))

                # Collect text output
                if msg_type == "AssistantMessage":
                    for block in event_dict.get("content", []):
                        if isinstance(block, dict) and block.get("text"):
                            output_parts.append(block["text"])

                # Capture result
                if msg_type == "ResultMessage":
                    task.usage = event_dict.get("usage")
                    task.cost = event_dict.get("total_cost_usd")
                    sid = event_dict.get("session_id")
                    if sid:
                        task.session_id = sid

            task.output = "\n".join(output_parts)
            task.status = "completed"

        except asyncio.CancelledError:
            task.status = "cancelled"
        except Exception as e:
            task.status = "error"
            task.error = str(e)
            logger.error("Agent %s (%s) error: %s", task.agent_id, task.label, e)

        return task

    async def run(
        self,
        tasks: List[AgentTask],
        concurrency: Optional[int] = None,
    ) -> List[AgentTask]:
        """Run all tasks in parallel with bounded concurrency.

        Args:
            tasks: List of AgentTask instances to execute.
            concurrency: Max parallel agents (default: self.max_concurrency).

        Returns:
            List of AgentTask with results populated.
        """
        if not tasks:
            return []

        self._cancelled = False
        self._running = True
        self._run_id = str(uuid.uuid4())[:8]
        self.started_at = datetime.now().isoformat()

        conc = concurrency or self.max_concurrency

        await self._emit(_make_event(
            EVENT_PARALLEL_START,
            run_id=self._run_id,
            total_tasks=len(tasks),
            concurrency=conc,
            task_labels=[t.label for t in tasks],
        ))

        # Semaphore to limit concurrency
        sem = asyncio.Semaphore(conc)

        async def _guarded_run(task: AgentTask) -> AgentTask:
            async with sem:
                if self._cancelled:
                    task.status = "cancelled"
                    return task
                await self._emit(_make_event(
                    EVENT_PARALLEL_AGENT_START,
                    run_id=self._run_id,
                    agent_id=task.agent_id,
                    agent_label=task.label,
                ))
                result = await self._run_single_agent(task)
                await self._emit(_make_event(
                    EVENT_PARALLEL_AGENT_END,
                    run_id=self._run_id,
                    agent_id=task.agent_id,
                    agent_label=task.label,
                    status=result.status,
                    output_length=len(result.output),
                    cost=result.cost,
                ))
                return result

        try:
            results = await asyncio.gather(
                *[_guarded_run(t) for t in tasks],
                return_exceptions=True,
            )

            # Handle unexpected exceptions from gather
            final_tasks: List[AgentTask] = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    tasks[i].status = "error"
                    tasks[i].error = str(result)
                    final_tasks.append(tasks[i])
                else:
                    final_tasks.append(result)

        except Exception as e:
            logger.exception("Parallel run error")
            await self._emit(_make_event(EVENT_PARALLEL_ERROR, run_id=self._run_id, message=str(e)))
            final_tasks = tasks  # return tasks with whatever state they have

        finally:
            self._running = False

        completed = sum(1 for t in final_tasks if t.status == "completed")
        errors = sum(1 for t in final_tasks if t.status == "error")
        total_cost = sum(t.cost or 0 for t in final_tasks)

        await self._emit(_make_event(
            EVENT_PARALLEL_END,
            run_id=self._run_id,
            total_tasks=len(final_tasks),
            completed=completed,
            errors=errors,
            total_cost_usd=round(total_cost, 4),
            results=[t.to_dict() for t in final_tasks],
        ))

        return final_tasks

    def get_status(self) -> dict:
        return {
            "running": self._running,
            "run_id": self._run_id,
            "started_at": self.started_at,
            "cancelled": self._cancelled,
        }


# ---------------------------------------------------------------------------
# Convenience: parallel judge evaluation
# ---------------------------------------------------------------------------

async def run_parallel_judges(
    project_dir: Path,
    report_text: str,
    profiles: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Run judge evaluation in parallel using separate agents.

    Instead of running all judge profiles sequentially in a single
    ExperimentJudge.evaluate_all() call, this runs each profile
    as a separate agent for truly independent evaluation.

    Args:
        project_dir: Project root path.
        report_text: Experiment output text to evaluate.
        profiles: List of judge profiles (default: all 3).

    Returns:
        Dict with per-profile verdicts and consensus.
    """
    try:
        from utils.judge import ExperimentJudge
    except ImportError:
        logger.warning("Judge module not available for parallel evaluation")
        return {"error": "judge module not available"}

    if profiles is None:
        profiles = ["strict", "balanced", "lenient"]

    judge = ExperimentJudge(project_dir)

    # Build individual prompts per profile
    tasks = []
    for profile in profiles:
        prompt = (
            f"You are a {profile} code review judge evaluating an experiment.\n"
            f"Project: {project_dir}\n\n"
            f"Experiment report:\n```\n{report_text[:8000]}\n```\n\n"
            f"Evaluate as a {profile} judge. Consider:\n"
            f"- Code quality and correctness\n"
            f"- Goal alignment\n"
            f"- Risk of regression\n"
            f"- Complexity impact\n\n"
            f"Respond in JSON: {{\"verdict\": \"KEEP|DISCARD\", \"score\": 0.0-1.0, "
            f"\"reason\": \"...\", \"risks\": [...]}}"
        )
        tasks.append(AgentTask(
            label=f"judge-{profile}",
            prompt=prompt,
            cwd=str(project_dir),
            max_turns=3,
        ))

    runner = ParallelAgentRunner(max_concurrency=len(profiles))
    results = await runner.run(tasks)

    # Parse verdicts from agent outputs
    import json as _json
    verdicts = {}
    for task in results:
        if task.status != "completed":
            continue
        try:
            # Try to extract JSON from output
            output = task.output.strip()
            # Find JSON block in output
            json_start = output.find("{")
            json_end = output.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                parsed = _json.loads(output[json_start:json_end])
                verdicts[task.label] = parsed
            else:
                verdicts[task.label] = {
                    "verdict": "DISCARD",
                    "score": 0.0,
                    "reason": f"Could not parse judge output",
                    "raw_output": output[:500],
                }
        except Exception as e:
            verdicts[task.label] = {
                "verdict": "DISCARD",
                "score": 0.0,
                "reason": f"Parse error: {e}",
                "raw_output": task.output[:500],
            }

    # Compute consensus
    if verdicts:
        scores = [v.get("score", 0) for v in verdicts.values()]
        avg_score = sum(scores) / len(scores) if scores else 0
        keep_count = sum(1 for v in verdicts.values() if v.get("verdict") == "KEEP")
        discard_count = sum(1 for v in verdicts.values() if v.get("verdict") == "DISCARD")

        if keep_count > len(verdicts) / 2:
            consensus = "KEEP"
        elif discard_count > len(verdicts) / 2:
            consensus = "DISCARD"
        else:
            # Split — use score tiebreaker
            if avg_score >= 0.65:
                consensus = "KEEP"
            elif avg_score <= 0.35:
                consensus = "DISCARD"
            else:
                consensus = "REVIEW"
    else:
        avg_score = 0
        consensus = "DISCARD"

    return {
        "verdicts": verdicts,
        "consensus": consensus,
        "consensus_score": round(avg_score, 3),
        "total_agents": len(results),
        "completed": sum(1 for r in results if r.status == "completed"),
    }
