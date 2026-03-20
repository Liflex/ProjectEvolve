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
from dataclasses import asdict, dataclass, field
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
# Task Decomposer — breaks a complex goal into parallel sub-tasks
# ---------------------------------------------------------------------------

class TaskDecomposer:
    """Decompose a research goal into independent parallel sub-tasks.

    Uses a lightweight LLM call to analyze the goal and split it into
    2-4 focused sub-tasks that can run concurrently without conflicts.

    Usage::

        decomposer = TaskDecomposer(project_dir="/project")
        sub_tasks = await decomposer.decompose(
            goal="Implement user auth with JWT and refresh tokens",
            max_subtasks=3,
        )
        # sub_tasks: List[AgentTask] ready for ParallelAgentRunner.run()
    """

    def __init__(self, project_dir: Path, max_subtasks: int = 3):
        self.project_dir = Path(project_dir).resolve()
        self.max_subtasks = max_subtasks

    async def decompose(
        self,
        goal: str,
        max_subtasks: Optional[int] = None,
        context: Optional[str] = None,
    ) -> List[AgentTask]:
        """Decompose *goal* into independent sub-tasks.

        Args:
            goal: The research/experiment goal to decompose.
            max_subtasks: Override for max number of sub-tasks.
            context: Additional context (e.g. project goals, current state).

        Returns:
            List[AgentTask] instances ready for parallel execution.
            Empty list if decomposition fails.
        """
        max_sub = max_subtasks or self.max_subtasks

        # Build decomposition prompt
        project_context = context or ""
        if not project_context:
            # Auto-gather minimal project context
            project_context = self._gather_project_context()

        decomp_prompt = (
            "You are a task decomposition engine. Break the following goal into "
            f"{max_sub} INDEPENDENT sub-tasks that can be executed in parallel.\n\n"
            "**CRITICAL RULES:**\n"
            "1. Each sub-task must be self-contained and executable independently\n"
            "2. Sub-tasks must NOT modify the same files (no conflicts)\n"
            "3. Each sub-task must produce a complete, testable result\n"
            "4. Focus on different aspects/files/components\n"
            "5. Keep each sub-task focused and specific\n\n"
            f"**Project:** {self.project_dir.name}\n"
            f"**Project context:** {project_context[:2000]}\n\n"
            f"**Goal to decompose:**\n{goal}\n\n"
            "Respond ONLY with a JSON array. Each element must have:\n"
            '```json\n'
            '[\n'
            '  {\n'
            '    "label": "short-task-name",\n'
            '    "prompt": "Complete, self-contained prompt for this sub-task",\n'
            '    "files": ["list of files this sub-task will touch"]\n'
            '  }\n'
            ']\n'
            "```\n"
            "Do NOT include any explanation outside the JSON array."
        )

        # Quick LLM call for decomposition (max 1 turn — just plan, don't execute)
        try:
            from claude_code_sdk import ClaudeCodeOptions, query

            clean_env = {}
            for var in ("CLAUDECODE", "CLAUDE_SESSION_ID"):
                if var in os.environ:
                    clean_env[var] = ""

            options = ClaudeCodeOptions(
                cwd=str(self.project_dir),
                max_turns=1,
                permission_mode="bypassPermissions",
                env=clean_env,
                append_system_prompt=(
                    "You are a task planner. Output ONLY valid JSON. "
                    "No explanations, no markdown code fences, just the JSON array."
                ),
            )

            output_parts: list[str] = []
            async for message in query(
                prompt=self._prompt_as_stream(decomp_prompt),
                options=options,
            ):
                msg_type = type(message).__name__
                if msg_type == "AssistantMessage":
                    for block in message.content or []:
                        if hasattr(block, "text") and block.text:
                            output_parts.append(block.text)

            raw_output = "\n".join(output_parts).strip()
            return self._parse_decomposition(raw_output, max_sub)

        except Exception as e:
            logger.error("Task decomposition failed: %s", e)
            return []

    @staticmethod
    async def _prompt_as_stream(text: str):
        yield {
            "type": "user",
            "message": {"role": "user", "content": text},
        }

    def _gather_project_context(self) -> str:
        """Gather minimal project context for decomposition."""
        import subprocess as _sp

        parts = []

        # List main source files
        try:
            result = _sp.run(
                ["git", "ls-files", "--cached"],
                capture_output=True, text=True, timeout=5,
                cwd=str(self.project_dir),
                encoding="utf-8", errors="replace",
            )
            files = (result.stdout or "").strip().split("\n")
            # Show top-level structure only
            top_files = [f for f in files[:50] if "/" not in f or f.count("/") <= 1]
            parts.append(f"Files: {', '.join(top_files[:30])}")
        except Exception:
            pass

        # Read .autoresearch.json for goals
        auto_file = self.project_dir / ".autoresearch.json"
        if auto_file.exists():
            try:
                import json as _json
                data = _json.loads(auto_file.read_text(encoding="utf-8"))
                goals = data.get("goals", [])[:3]
                if goals:
                    parts.append(f"Goals: {'; '.join(str(g)[:100] for g in goals)}")
            except Exception:
                pass

        return "\n".join(parts)

    def _parse_decomposition(
        self, raw_output: str, max_subtasks: int,
    ) -> List[AgentTask]:
        """Parse LLM JSON output into AgentTask list."""
        import json as _json

        # Strip markdown fences if present
        text = raw_output
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first and last lines (fence markers)
            fence_start = 0
            for i, line in enumerate(lines):
                if line.strip().startswith("```") and i == 0:
                    fence_start = i + 1
                    break
            fence_end = len(lines)
            for i in range(len(lines) - 1, -1, -1):
                if lines[i].strip() == "```":
                    fence_end = i
                    break
            text = "\n".join(lines[fence_start:fence_end])

        try:
            items = _json.loads(text)
        except _json.JSONDecodeError:
            # Try to find JSON array in output
            start = text.find("[")
            end = text.rfind("]") + 1
            if start >= 0 and end > start:
                try:
                    items = _json.loads(text[start:end])
                except _json.JSONDecodeError:
                    logger.warning("Could not parse decomposition JSON: %s", text[:200])
                    return []
            else:
                logger.warning("No JSON array found in decomposition output")
                return []

        if not isinstance(items, list):
            items = [items]

        tasks = []
        for i, item in enumerate(items[:max_subtasks]):
            if not isinstance(item, dict):
                continue
            label = item.get("label", f"subtask-{i+1}")
            prompt = item.get("prompt", "")
            if not prompt:
                continue

            # Add isolation context to each sub-task prompt
            isolation_note = (
                "\n\n**IMPORTANT:** You are working as part of a parallel team. "
                "Only modify files listed below. Do NOT touch files assigned to "
                "other sub-tasks. Make a focused, complete change.\n"
                f"**Your assigned files:** {', '.join(item.get('files', ['your component files']))}"
            )
            prompt += isolation_note

            tasks.append(AgentTask(
                label=label,
                prompt=prompt,
                cwd=str(self.project_dir),
                max_turns=10,
            ))

        return tasks


# ---------------------------------------------------------------------------
# Result Aggregator — merges parallel sub-task results
# ---------------------------------------------------------------------------

@dataclass
class AggregatedResult:
    """Result of merging parallel sub-task outputs."""

    tasks_total: int = 0
    tasks_completed: int = 0
    tasks_failed: int = 0
    total_cost_usd: float = 0.0
    conflicts: List[Dict[str, Any]] = field(default_factory=list)
    merged_summary: str = ""
    per_task: List[Dict[str, Any]] = field(default_factory=list)
    has_conflicts: bool = False

    def to_dict(self) -> dict:
        return {
            "tasks_total": self.tasks_total,
            "tasks_completed": self.tasks_completed,
            "tasks_failed": self.tasks_failed,
            "total_cost_usd": round(self.total_cost_usd, 4),
            "has_conflicts": self.has_conflicts,
            "conflicts": self.conflicts,
            "merged_summary": self.merged_summary,
            "per_task": self.per_task,
        }


class ResultAggregator:
    """Aggregate results from parallel sub-task execution.

    Detects file conflicts between sub-tasks and produces a unified
    summary report.
    """

    def __init__(self, project_dir: Path):
        self.project_dir = Path(project_dir).resolve()

    def aggregate(
        self,
        original_tasks: List[AgentTask],
        completed_tasks: List[AgentTask],
    ) -> AggregatedResult:
        """Merge results from parallel execution.

        Args:
            original_tasks: The tasks that were submitted.
            completed_tasks: The tasks with results populated.

        Returns:
            AggregatedResult with merged summary and conflict info.
        """
        import subprocess as _sp

        result = AggregatedResult(
            tasks_total=len(original_tasks),
            tasks_completed=sum(1 for t in completed_tasks if t.status == "completed"),
            tasks_failed=sum(1 for t in completed_tasks if t.status in ("error", "cancelled")),
            total_cost_usd=sum(t.cost or 0 for t in completed_tasks),
        )

        # Check for file conflicts via git status
        try:
            git_result = _sp.run(
                ["git", "diff", "--name-only", "HEAD"],
                capture_output=True, text=True, timeout=10,
                cwd=str(self.project_dir),
                encoding="utf-8", errors="replace",
            )
            modified_files = set((git_result.stdout or "").strip().split("\n"))
            modified_files.discard("")
        except Exception:
            modified_files = set()

        # Detect uncommitted changes that might conflict
        try:
            git_result2 = _sp.run(
                ["git", "diff", "--name-only"],
                capture_output=True, text=True, timeout=10,
                cwd=str(self.project_dir),
                encoding="utf-8", errors="replace",
            )
            staged_files = set((git_result2.stdout or "").strip().split("\n"))
            staged_files.discard("")
            modified_files.update(staged_files)
        except Exception:
            pass

        # Build per-task summaries
        summaries = []
        for task in completed_tasks:
            task_info = {
                "label": task.label,
                "agent_id": task.agent_id,
                "status": task.status,
                "output_length": len(task.output),
                "cost": task.cost,
                "error": task.error,
                "summary": self._extract_summary(task.output),
            }
            summaries.append(task_info)

        result.per_task = summaries

        # Detect conflicts: if multiple agents ran, check if there are
        # merge conflicts or overlapping file modifications
        if len(completed_tasks) > 1 and modified_files:
            # Check for merge conflict markers in modified files
            conflict_files = []
            for fpath in modified_files:
                full_path = self.project_dir / fpath
                if not full_path.exists():
                    continue
                try:
                    content = full_path.read_text(encoding="utf-8", errors="replace")
                    if "<<<<<<" in content and ">>>>>>" in content:
                        conflict_files.append(fpath)
                except Exception:
                    pass

            if conflict_files:
                result.has_conflicts = True
                result.conflicts = [
                    {"file": f, "type": "merge_conflict"}
                    for f in conflict_files
                ]

        # Build merged summary
        result.merged_summary = self._build_merged_summary(completed_tasks, result)

        return result

    @staticmethod
    def _extract_summary(output: str) -> str:
        """Extract a brief summary from agent output."""
        if not output:
            return "(no output)"
        # Take first 300 chars + last 200 chars
        if len(output) <= 500:
            return output.strip()
        return output[:300].strip() + "\n...\n" + output[-200:].strip()

    @staticmethod
    def _build_merged_summary(
        tasks: List[AgentTask],
        agg: AggregatedResult,
    ) -> str:
        """Build a unified summary of all parallel results."""
        lines = [
            f"## Parallel Execution Summary",
            f"",
            f"**Completed:** {agg.tasks_completed}/{agg.tasks_total}",
            f"**Cost:** ${agg.total_cost_usd:.4f}",
            f"**Conflicts:** {'YES — manual resolution needed' if agg.has_conflicts else 'None'}",
            f"",
        ]

        if agg.conflicts:
            lines.append("**Conflict Files:**")
            for c in agg.conflicts:
                lines.append(f"  - {c['file']} ({c['type']})")
            lines.append("")

        lines.append("**Per-task Results:**")
        for task in tasks:
            status_icon = "+" if task.status == "completed" else "!" if task.status == "error" else "?"
            lines.append(f"")
            lines.append(f"### [{status_icon}] {task.label}")
            if task.error:
                lines.append(f"**Error:** {task.error[:200]}")
            elif task.output:
                # Extract key info from output
                preview = task.output[:500].strip()
                lines.append(preview)

        if agg.has_conflicts:
            lines.append("")
            lines.append("**ACTION REQUIRED:** Resolve merge conflicts before committing.")

        return "\n".join(lines)


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
