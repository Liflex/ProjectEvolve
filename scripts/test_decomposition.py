"""Production validation of parallel task decomposition (exp #204).

Tests TaskDecomposer._parse_decomposition() with 3 task types:
  a) Simple task  — single file, single change
  b) Medium task  — multiple files, related changes
  c) Complex task — cross-cutting concern, backend + frontend

Validates:
  - Number of subtasks (1-5 reasonable range)
  - Subtasks don't conflict by files (unique file sets)
  - Each subtask has a label, prompt, and file list
  - Edge cases: empty output, invalid JSON, too many subtasks

Run:  python scripts/test_decomposition.py
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path
from typing import List

# Add project root to path so we can import agents.parallel
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from agents.parallel import AgentTask, TaskDecomposer


# ---------------------------------------------------------------------------
# Mock LLM JSON responses for each task type
# ---------------------------------------------------------------------------

SIMPLE_TASK_RAW = json.dumps([
    {
        "label": "fix-logging-level",
        "prompt": "Change log level from DEBUG to INFO in the research agent",
        "files": ["agents/research.py"],
    }
])

MEDIUM_TASK_RAW = json.dumps([
    {
        "label": "add-input-validator",
        "prompt": "Add input validation middleware to /api/prompt endpoint",
        "files": ["ui/server.py"],
    },
    {
        "label": "add-validator-tests",
        "prompt": "Write unit tests for the new validation logic",
        "files": ["tests/test_server_validation.py"],
    },
    {
        "label": "update-api-docs",
        "prompt": "Update API docs to describe new validation rules",
        "files": ["docs/api.md"],
    },
])

COMPLEX_TASK_RAW = json.dumps([
    {
        "label": "backend-decompose-endpoint",
        "prompt": "Add /api/parallel/decompose endpoint to server.py",
        "files": ["ui/server.py"],
    },
    {
        "label": "frontend-decompose-ui",
        "prompt": "Add decompose toggle button to the lab dashboard",
        "files": ["ui/static/js/modules/lab.js", "ui/static/css/main.css"],
    },
    {
        "label": "shared-types",
        "prompt": "Add TypeScript-style type definitions for decomposition API",
        "files": ["ui/static/js/types/decomposition.js"],
    },
])


# ---------------------------------------------------------------------------
# Edge-case JSON responses
# ---------------------------------------------------------------------------

# LLM wraps response in markdown fences
FENCED_JSON = """```json
[
  {"label": "a", "prompt": "do a", "files": ["a.py"]},
  {"label": "b", "prompt": "do b", "files": ["b.py"]}
]
```"""

# LLM adds explanatory text before JSON
PREFIXED_JSON = """Sure! Here is the decomposition:

[
  {"label": "a", "prompt": "do a", "files": ["a.py"]},
  {"label": "b", "prompt": "do b", "files": ["b.py"]}
]
"""

# Empty response
EMPTY_JSON = ""

# Invalid JSON
INVALID_JSON = "this is not json at all"

# Single object instead of array
SINGLE_OBJECT_JSON = json.dumps({
    "label": "only-task",
    "prompt": "do the only thing",
    "files": ["only.py"],
})

# 6 subtasks when max is 3 — should be truncated
OVERSIZED_JSON = json.dumps([
    {"label": f"task-{i}", "prompt": f"do task {i}", "files": [f"{i}.py"]}
    for i in range(6)
])

# Subtask without prompt — should be skipped
MISSING_PROMPT_JSON = json.dumps([
    {"label": "good-task", "prompt": "do good", "files": ["good.py"]},
    {"label": "bad-task", "files": ["bad.py"]},  # no prompt
    {"label": "also-good", "prompt": "also do", "files": ["also.py"]},
])

# File conflict: two subtasks touch the same file
CONFLICT_JSON = json.dumps([
    {"label": "task-a", "prompt": "modify auth", "files": ["auth.py", "utils.py"]},
    {"label": "task-b", "prompt": "add logging", "files": ["utils.py", "log.py"]},
])

# Non-dict item in array
MIXED_ARRAY_JSON = json.dumps([
    {"label": "valid", "prompt": "ok", "files": ["ok.py"]},
    "not a dict",
    {"label": "also-valid", "prompt": "ok2", "files": ["ok2.py"]},
])


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

class ValidationResult:
    def __init__(self, name: str):
        self.name = name
        self.passed = True
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.details: List[str] = []

    def fail(self, msg: str):
        self.passed = False
        self.errors.append(msg)

    def warn(self, msg: str):
        self.warnings.append(msg)

    def info(self, msg: str):
        self.details.append(msg)

    @property
    def icon(self):
        return "PASS" if self.passed else "FAIL"


def validate_decomposition(
    name: str,
    raw_json: str,
    max_subtasks: int = 5,
    expect_min: int = 1,
    expect_max: int = 5,
) -> ValidationResult:
    """Parse raw JSON via TaskDecomposer and validate the result."""
    vr = ValidationResult(name)

    decomposer = TaskDecomposer(project_dir=str(project_root))
    tasks = decomposer._parse_decomposition(raw_json, max_subtasks)

    # Check task count
    task_count = len(tasks)
    vr.info(f"Subtasks produced: {task_count} (max={max_subtasks})")

    if task_count < expect_min:
        vr.fail(f"Expected >= {expect_min} subtask(s), got {task_count}")
    elif task_count > expect_max:
        vr.fail(f"Expected <= {expect_max} subtasks, got {task_count}")

    # Check each task
    all_files_sets: List[set] = []
    for i, task in enumerate(tasks):
        prefix = f"  [{i}] {task.label}"

        # Check label
        if not task.label:
            vr.fail(f"{prefix}: missing label")

        # Check prompt
        if not task.prompt:
            vr.fail(f"{prefix}: missing prompt")
        elif len(task.prompt) < 10:
            vr.warn(f"{prefix}: prompt is suspiciously short ({len(task.prompt)} chars)")
        else:
            vr.info(f"{prefix}: prompt={len(task.prompt)} chars")

        # Check files (stored as attribute if available)
        task_files = getattr(task, "files", None)
        if task_files is not None:
            if not isinstance(task_files, list):
                vr.fail(f"{prefix}: files is not a list: {type(task_files)}")
            elif len(task_files) == 0:
                vr.warn(f"{prefix}: empty file list")
            else:
                all_files_sets.append(set(task_files))
                vr.info(f"{prefix}: files={task_files}")
        else:
            vr.warn(f"{prefix}: no 'files' attribute on AgentTask (bug?)")

    # Check file uniqueness across subtasks
    if len(all_files_sets) > 1:
        all_files = set()
        conflicts = []
        for i, fs in enumerate(all_files_sets):
            overlap = all_files & fs
            if overlap:
                conflicts.append((i, overlap))
            all_files |= fs
        if conflicts:
            for idx, overlap in conflicts:
                vr.warn(f"  File conflict detected: subtask [{idx}] shares files: {overlap}")
        else:
            vr.info("  No file conflicts across subtasks")

    return vr


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------

def print_header(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_result(vr: ValidationResult):
    status = f"[{vr.icon}] {vr.name}"
    print(f"\n{status}")
    if vr.details:
        for d in vr.details:
            print(f"    {d}")
    if vr.warnings:
        for w in vr.warnings:
            print(f"    WARN: {w}")
    if vr.errors:
        for e in vr.errors:
            print(f"    FAIL: {e}")


def main():
    print_header("Task Decomposition Production Validation (exp #204)")
    print(f"Project root: {project_root}")

    results: List[ValidationResult] = []

    # --- Core task type tests ---

    print_header("1. Core Task Types")

    print_result(validate_decomposition(
        name="Simple task (1 file, 1 change)",
        raw_json=SIMPLE_TASK_RAW,
        max_subtasks=5,
        expect_min=1,
        expect_max=1,
    ))
    results.append(validate_decomposition(
        name="Simple task (1 file, 1 change)",
        raw_json=SIMPLE_TASK_RAW,
        max_subtasks=5,
        expect_min=1,
        expect_max=1,
    ))

    print_result(validate_decomposition(
        name="Medium task (3 files, related changes)",
        raw_json=MEDIUM_TASK_RAW,
        max_subtasks=5,
        expect_min=2,
        expect_max=4,
    ))
    results.append(validate_decomposition(
        name="Medium task (3 files, related changes)",
        raw_json=MEDIUM_TASK_RAW,
        max_subtasks=5,
        expect_min=2,
        expect_max=4,
    ))

    print_result(validate_decomposition(
        name="Complex task (cross-cutting, backend+frontend)",
        raw_json=COMPLEX_TASK_RAW,
        max_subtasks=5,
        expect_min=2,
        expect_max=5,
    ))
    results.append(validate_decomposition(
        name="Complex task (cross-cutting, backend+frontend)",
        raw_json=COMPLEX_TASK_RAW,
        max_subtasks=5,
        expect_min=2,
        expect_max=5,
    ))

    # --- Edge case tests ---

    print_header("2. Edge Cases")

    print_result(validate_decomposition(
        name="Markdown-fenced JSON",
        raw_json=FENCED_JSON,
        max_subtasks=5,
        expect_min=2,
        expect_max=2,
    ))
    results.append(validate_decomposition(
        name="Markdown-fenced JSON",
        raw_json=FENCED_JSON,
        max_subtasks=5,
        expect_min=2,
        expect_max=2,
    ))

    print_result(validate_decomposition(
        name="Prefixed JSON (explanatory text before)",
        raw_json=PREFIXED_JSON,
        max_subtasks=5,
        expect_min=2,
        expect_max=2,
    ))
    results.append(validate_decomposition(
        name="Prefixed JSON (explanatory text before)",
        raw_json=PREFIXED_JSON,
        max_subtasks=5,
        expect_min=2,
        expect_max=2,
    ))

    print_result(validate_decomposition(
        name="Empty response",
        raw_json=EMPTY_JSON,
        max_subtasks=5,
        expect_min=0,
        expect_max=0,
    ))
    results.append(validate_decomposition(
        name="Empty response",
        raw_json=EMPTY_JSON,
        max_subtasks=5,
        expect_min=0,
        expect_max=0,
    ))

    print_result(validate_decomposition(
        name="Invalid JSON",
        raw_json=INVALID_JSON,
        max_subtasks=5,
        expect_min=0,
        expect_max=0,
    ))
    results.append(validate_decomposition(
        name="Invalid JSON",
        raw_json=INVALID_JSON,
        max_subtasks=5,
        expect_min=0,
        expect_max=0,
    ))

    print_result(validate_decomposition(
        name="Single object (not array)",
        raw_json=SINGLE_OBJECT_JSON,
        max_subtasks=5,
        expect_min=1,
        expect_max=1,
    ))
    results.append(validate_decomposition(
        name="Single object (not array)",
        raw_json=SINGLE_OBJECT_JSON,
        max_subtasks=5,
        expect_min=1,
        expect_max=1,
    ))

    print_result(validate_decomposition(
        name="Oversized (6 items, max=3)",
        raw_json=OVERSIZED_JSON,
        max_subtasks=3,
        expect_min=3,
        expect_max=3,
    ))
    results.append(validate_decomposition(
        name="Oversized (6 items, max=3)",
        raw_json=OVERSIZED_JSON,
        max_subtasks=3,
        expect_min=3,
        expect_max=3,
    ))

    print_result(validate_decomposition(
        name="Missing prompt in one subtask",
        raw_json=MISSING_PROMPT_JSON,
        max_subtasks=5,
        expect_min=2,
        expect_max=2,
    ))
    results.append(validate_decomposition(
        name="Missing prompt in one subtask",
        raw_json=MISSING_PROMPT_JSON,
        max_subtasks=5,
        expect_min=2,
        expect_max=2,
    ))

    print_result(validate_decomposition(
        name="File conflict (shared utils.py)",
        raw_json=CONFLICT_JSON,
        max_subtasks=5,
        expect_min=2,
        expect_max=2,
    ))
    results.append(validate_decomposition(
        name="File conflict (shared utils.py)",
        raw_json=CONFLICT_JSON,
        max_subtasks=5,
        expect_min=2,
        expect_max=2,
    ))

    print_result(validate_decomposition(
        name="Mixed array (non-dict item)",
        raw_json=MIXED_ARRAY_JSON,
        max_subtasks=5,
        expect_min=2,
        expect_max=2,
    ))
    results.append(validate_decomposition(
        name="Mixed array (non-dict item)",
        raw_json=MIXED_ARRAY_JSON,
        max_subtasks=5,
        expect_min=2,
        expect_max=2,
    ))

    # --- Summary ---

    print_header("Summary")
    passed = sum(1 for r in results if r.passed)
    failed = sum(1 for r in results if not r.passed)
    total = len(results)

    print(f"  Total: {total}  |  Passed: {passed}  |  Failed: {failed}")

    if failed > 0:
        print("\n  Failed tests:")
        for r in results:
            if not r.passed:
                print(f"    [FAIL] {r.name}")
                for e in r.errors:
                    print(f"           -> {e}")

    # Warnings summary
    all_warnings = [(r.name, w) for r in results for w in r.warnings]
    if all_warnings:
        print(f"\n  Warnings ({len(all_warnings)}):")
        for name, w in all_warnings:
            print(f"    [WARN] {name}: {w}")

    # Return exit code
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
