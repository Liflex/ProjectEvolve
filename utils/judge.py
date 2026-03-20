"""Post-experiment auto-judge — quality evaluator with specialist profiles.

Evaluates experiment results after the agent commits by running
a set of lightweight checks:
  1. Git commit verification — did the agent commit?
  2. File consistency — do claimed files match actual git diff?
  3. Syntax validation — no obvious errors in changed files
  4. Diff size sanity — not too large, not empty
  5. Report quality — does the experiment report have proper sections?
  6. Code quality — code smells, debug artifacts, commented-out code
  7. Test safety — no known test breakage patterns in changed files
  8. Goal alignment — does the change move toward stated project goals?

Three specialist judge profiles with distinct perspectives (research-backed):
  - guardian:   Security & Safety expert. Protects against regressions, broken
                tests, and unsafe patterns. Low tolerance for safety violations.
                Based on adversarial review best practices (Fagan Inspection).
  - architect:  Structure & Maintainability expert. Evaluates code organization,
                change scope, documentation quality. Focuses on long-term health.
                Based on software architecture review patterns.
  - pragmatist: Functionality & Delivery expert. Prioritizes working code,
                forward progress toward goals, and minimal friction.
                Based on DORA metrics "change failure rate" philosophy.

Chief judge provides meta-evaluation with context-aware tiebreaking when
specialists disagree.
"""

from __future__ import annotations

import json
import re
import subprocess
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Check result
# ---------------------------------------------------------------------------

@dataclass
class CheckResult:
    name: str
    status: str  # "pass" | "warn" | "fail"
    message: str
    weight: float = 1.0


# ---------------------------------------------------------------------------
# Judge profiles
# ---------------------------------------------------------------------------

@dataclass
class JudgeProfile:
    """Configuration for a judge's evaluation perspective."""
    name: str
    label: str
    description: str
    # Per-check weights (check_name → weight multiplier)
    weights: Dict[str, float] = field(default_factory=dict)
    # Thresholds for recommendation
    fail_threshold: int = 2       # fails >= this → DISCARD
    warn_threshold: int = 3       # warns >= this → REVIEW
    # Score multiplier for final score (profile-specific adjustment)
    score_adjust: float = 0.0
    # Role-specific system prompt (the "skill" this judge applies)
    skill: str = ""
    # Legacy name for backward compatibility
    legacy_name: str = ""


JUDGE_PROFILES: Dict[str, JudgeProfile] = {
    "guardian": JudgeProfile(
        name="guardian",
        label="GUARDIAN",
        legacy_name="strict",
        description=(
            "Security & Safety expert. Protects against regressions, broken "
            "tests, unsafe patterns, and debug artifacts. Based on adversarial "
            "review methodology (Fagan Inspection). Low tolerance for safety "
            "violations but accepts larger diffs if they're clean."
        ),
        skill=(
            "You are a security-conscious code reviewer. You look for: "
            "regression risks (broken tests, deleted assertions), unsafe patterns "
            "(debug prints, commented-out code), and integrity issues. "
            "You ask: 'Could this change break something that was working before?' "
            "You are not pedantic about style — you care about safety."
        ),
        weights={
            "commit_exists": 1.0,
            "file_consistency": 1.5,
            "syntax_check": 2.0,       # no errors tolerated
            "diff_size": 1.0,          # size less important than safety
            "report_quality": 0.5,     # less critical for safety
            "code_quality": 2.0,       # code quality paramount
            "test_safety": 2.5,        # tests must not break — highest weight
            "goal_alignment": 1.0,     # safety of approach matters
        },
        fail_threshold=1,    # 1 safety fail → DISCARD
        warn_threshold=2,    # 2 warns → REVIEW
        score_adjust=-0.03,
    ),
    "architect": JudgeProfile(
        name="architect",
        label="ARCHITECT",
        legacy_name="balanced",
        description=(
            "Structure & Maintainability expert. Evaluates code organization, "
            "change scope, documentation, and architectural coherence. Based on "
            "software architecture review patterns. Ensures each change has a "
            "clear single responsibility and doesn't degrade long-term health."
        ),
        skill=(
            "You are a software architect reviewing code changes. You look for: "
            "change scope (is it focused or scattered?), code organization "
            "(single responsibility, clear module boundaries), documentation "
            "(are changes explained?), and structural integrity. "
            "You ask: 'Does this change make the codebase easier or harder to maintain?' "
            "You balance rigor with pragmatism."
        ),
        weights={
            "commit_exists": 1.0,
            "file_consistency": 1.5,   # claimed vs actual must match
            "syntax_check": 1.0,
            "diff_size": 2.0,          # prefer focused, small diffs
            "report_quality": 2.0,     # documentation matters
            "code_quality": 1.5,       # code smells indicate structural issues
            "test_safety": 1.0,
            "goal_alignment": 1.5,     # architectural goals matter
        },
        fail_threshold=2,
        warn_threshold=3,
        score_adjust=0.0,
    ),
    "pragmatist": JudgeProfile(
        name="pragmatist",
        label="PRAGMATIST",
        legacy_name="lenient",
        description=(
            "Functionality & Delivery expert. Prioritizes working code, forward "
            "progress toward goals, and minimal friction. Based on DORA metrics "
            "'change failure rate' philosophy. Tolerates technical debt if "
            "functionality delivers value and tests pass."
        ),
        skill=(
            "You are a pragmatic product engineer reviewing code changes. You look for: "
            "does it work? (syntax, tests pass), did it move toward the goal? "
            "(goal alignment), is it committed properly? You tolerate technical "
            "debt, larger diffs, and minor code smells if the core functionality "
            "delivers value. You ask: 'Does this solve the problem?' "
            "You prefer working code over perfect code."
        ),
        weights={
            "commit_exists": 2.0,       # must be committed
            "file_consistency": 0.5,    # minor mismatches ok
            "syntax_check": 1.5,        # errors still matter
            "diff_size": 0.5,           # large changes ok if functional
            "report_quality": 1.0,
            "code_quality": 0.5,        # code smells tolerated
            "test_safety": 1.5,         # tests still matter
            "goal_alignment": 2.5,      # highest priority — does it deliver?
        },
        fail_threshold=2,
        warn_threshold=4,    # more tolerant
        score_adjust=0.05,
    ),
}

# Backward compatibility aliases
_PROFILE_ALIASES = {"strict": "guardian", "balanced": "architect", "lenient": "pragmatist"}

# Snapshot of default weights for reset (taken once at module load)
_DEFAULT_WEIGHTS: Dict[str, Dict[str, float]] = {
    name: dict(profile.weights) for name, profile in JUDGE_PROFILES.items()
}


# ---------------------------------------------------------------------------
# Judge
# ---------------------------------------------------------------------------

class ExperimentJudge:
    """Lightweight post-experiment evaluator with profile support.

    Usage::

        judge = ExperimentJudge(project_dir)

        # Run with default profile
        verdict = judge.evaluate(claimed_files=["..."], agent_decision="KEEP")

        # Run with specific profile
        verdict = judge.evaluate(claimed_files=["..."], profile="strict")

        # Run all profiles
        all_verdicts = judge.evaluate_all(claimed_files=["..."])
    """

    def __init__(self, project_dir: Path):
        self.project_dir = Path(project_dir).resolve()
        self._load_custom_weights()

    def _load_custom_weights(self) -> None:
        """Load persisted custom weights into JUDGE_PROFILES."""
        path = self.project_dir / ".autoresearch" / "judge_weights.json"
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            for pname, weights in data.items():
                profile = JUDGE_PROFILES.get(pname)
                if profile and isinstance(weights, dict):
                    for check_name, weight in weights.items():
                        if isinstance(weight, (int, float)):
                            profile.weights[check_name] = float(weight)
        except (json.JSONDecodeError, OSError, TypeError):
            pass

    def _run_git(self, *args: str, timeout: int = 10) -> str:
        """Run a git command and return stdout."""
        try:
            result = subprocess.run(
                ["git"] + list(args),
                capture_output=True, text=True, timeout=timeout,
                cwd=str(self.project_dir),
                encoding="utf-8", errors="replace",
            )
            return result.stdout or ""
        except (subprocess.TimeoutExpired, OSError) as e:
            logger.warning("git command failed: %s", e)
            return ""

    def _check_commit_exists(self) -> CheckResult:
        """Check if the last commit is an experiment commit."""
        last_msg = self._run_git("log", "-1", "--pretty=format:%s")
        if not last_msg:
            return CheckResult("commit_exists", "fail", "No commits in repository")

        if re.match(r"^exp #\d+:", last_msg):
            return CheckResult("commit_exists", "pass", f"Experiment commit found: {last_msg[:60]}")
        else:
            return CheckResult("commit_exists", "warn", f"Last commit is not an experiment: {last_msg[:60]}")

    def _check_diff_files(self, claimed_files: List[str]) -> CheckResult:
        """Compare claimed files_modified with actual git diff."""
        diff_output = self._run_git("diff", "--name-only", "HEAD~1", "HEAD")
        if not diff_output.strip():
            diff_output = self._run_git("diff", "--name-only", "--cached")
        if not diff_output.strip():
            diff_output = self._run_git("show", "--name-only", "--pretty=format:", "HEAD")

        actual_files = set(f.strip() for f in diff_output.strip().splitlines() if f.strip())
        claimed_set = set(claimed_files)

        if not actual_files:
            return CheckResult("file_consistency", "warn", "No file changes detected in last commit")

        def normalize(p: str) -> str:
            return p.replace("\\", "/").lstrip("./")

        actual_norm = {normalize(f) for f in actual_files}
        claimed_norm = {normalize(f) for f in claimed_set}

        matched = actual_norm & claimed_norm
        unmatched_claimed = claimed_norm - actual_norm
        unmatched_actual = actual_norm - claimed_norm

        if not claimed_norm:
            return CheckResult(
                "file_consistency", "warn",
                f"Agent claimed no files but {len(actual_norm)} actually changed: {', '.join(list(actual_norm)[:5])}"
            )

        if matched == claimed_norm and matched == actual_norm:
            return CheckResult("file_consistency", "pass", f"All {len(matched)} files match")
        elif matched:
            parts = [f"{len(matched)}/{len(claimed_norm)} claimed files found"]
            if unmatched_claimed:
                parts.append(f"missing: {', '.join(list(unmatched_claimed)[:3])}")
            if unmatched_actual:
                parts.append(f"unclaimed: {', '.join(list(unmatched_actual)[:3])}")
            return CheckResult("file_consistency", "warn", "; ".join(parts))
        else:
            return CheckResult(
                "file_consistency", "fail",
                f"No claimed files found in diff. Actual: {', '.join(list(actual_norm)[:5])}"
            )

    def _check_syntax(self) -> CheckResult:
        """Check for syntax errors in changed Python/JS files."""
        diff_output = self._run_git("diff", "--name-only", "HEAD~1", "HEAD")
        if not diff_output.strip():
            diff_output = self._run_git("show", "--name-only", "--pretty=format:", "HEAD")

        files = [f.strip() for f in diff_output.strip().splitlines() if f.strip()]
        errors = []

        for f in files:
            fpath = self.project_dir / f
            if not fpath.exists():
                continue

            ext = fpath.suffix.lower()
            try:
                if ext == ".py":
                    subprocess.run(
                        ["python", "-m", "py_compile", str(fpath)],
                        capture_output=True, text=True, timeout=10,
                        encoding="utf-8", errors="replace",
                    )
                elif ext in (".js", ".ts", ".jsx", ".tsx"):
                    content = fpath.read_text(encoding="utf-8", errors="replace")
                    if not content.strip():
                        errors.append(f"{f}: empty file")
            except subprocess.TimeoutExpired:
                errors.append(f"{f}: syntax check timed out")
            except Exception as e:
                errors.append(f"{f}: {str(e)[:60]}")

        if errors:
            return CheckResult("syntax_check", "fail", f"{len(errors)} error(s): {'; '.join(errors[:3])}")
        return CheckResult("syntax_check", "pass", "No syntax errors detected")

    def _check_diff_size(self) -> CheckResult:
        """Check if the diff size is reasonable."""
        stat = self._run_git("diff", "--shortstat", "HEAD~1", "HEAD")
        if not stat.strip():
            stat = self._run_git("diff", "--shortstat", "--cached")

        if not stat.strip():
            return CheckResult("diff_size", "warn", "No diff stats available")

        m = re.search(r"(\d+) files? changed", stat)
        files_changed = int(m.group(1)) if m else 0
        m = re.search(r"(\d+) insertion", stat)
        insertions = int(m.group(1)) if m else 0
        m = re.search(r"(\d+) deletion", stat)
        deletions = int(m.group(1)) if m else 0

        total_lines = insertions + deletions

        if total_lines == 0:
            return CheckResult("diff_size", "warn", "No lines changed")

        if total_lines > 5000:
            return CheckResult(
                "diff_size", "fail",
                f"Very large change: {files_changed} files, +{insertions}/-{deletions} lines"
            )

        if total_lines > 2000:
            return CheckResult(
                "diff_size", "warn",
                f"Large change: {files_changed} files, +{insertions}/-{deletions} lines"
            )

        return CheckResult(
            "diff_size", "pass",
            f"{files_changed} file(s), +{insertions}/-{deletions} lines"
        )

    def _check_report_quality(self, report_text: str) -> CheckResult:
        """Validate experiment report has proper sections."""
        if not report_text or not report_text.strip():
            return CheckResult("report_quality", "warn", "No report text provided")

        required = ["Results", "Decision"]
        optional = ["Files Modified", "What was done", "Next"]
        found_required = []
        found_optional = []

        text_lower = report_text.lower()
        for section in required:
            if section.lower() in text_lower:
                found_required.append(section)
        for section in optional:
            if section.lower() in text_lower:
                found_optional.append(section)

        total = len(required) + len(optional)
        found = len(found_required) + len(found_optional)

        if found_required == required and found >= 3:
            return CheckResult("report_quality", "pass",
                f"All required sections present ({found}/{total} total)")
        elif found_required == required:
            return CheckResult("report_quality", "pass",
                f"Required sections OK, {found}/{total} total sections")
        elif found_required:
            missing = [s for s in required if s not in found_required]
            return CheckResult("report_quality", "warn",
                f"Missing sections: {chr(44).join(missing)} ({found}/{total} found)")
        else:
            return CheckResult("report_quality", "fail",
                f"No required sections found ({found}/{total} total)")

    def _check_code_quality(self) -> CheckResult:
        """Analyze diff for code smells: long lines, binary files, debug artifacts."""
        diff_output = self._run_git("diff", "HEAD~1", "HEAD")
        if not diff_output.strip():
            diff_output = self._run_git("diff", "--cached")
        if not diff_output.strip():
            return CheckResult("code_quality", "warn", "No diff available for analysis")

        issues = []
        long_lines = 0
        very_long_lines = 0
        debug_artifacts = 0
        commented_code_lines = 0
        todo_count = 0

        for line in diff_output.splitlines():
            if not line.startswith("+") or line.startswith("+++"):
                continue
            content = line[1:]
            line_len = len(content)
            if line_len > 200:
                long_lines += 1
            if line_len > 300:
                very_long_lines += 1

            # Debug artifacts: print/logging statements that look like debugging
            stripped = content.strip()
            if re.search(r'^\s*(print\s*\(|console\.log\s*\(|console\.debug\s*\(|logging\.debug\s*\()', stripped):
                debug_artifacts += 1

            # Commented-out code lines (heuristic: code-like patterns in comments)
            if re.match(r'^\s*#\s*(def |class |import |from |return |if |for |while )', stripped):
                commented_code_lines += 1

            # TODO/FIXME/HACK markers
            if re.search(r'\b(TODO|FIXME|HACK|XXX|TEMP)\b', stripped):
                todo_count += 1

        if very_long_lines > 5:
            issues.append(f"{very_long_lines} very long lines (>300 chars)")
        elif long_lines > 10:
            issues.append(f"{long_lines} long lines (>200 chars)")

        if debug_artifacts > 0:
            issues.append(f"{debug_artifacts} debug artifact(s) detected")

        if commented_code_lines > 3:
            issues.append(f"{commented_code_lines} commented-out code line(s)")

        if todo_count > 2:
            issues.append(f"{todo_count} TODO/FIXME/HACK marker(s)")

        binary_count = diff_output.count("Binary files")
        if binary_count > 0:
            issues.append(f"{binary_count} binary file(s)")

        if issues:
            return CheckResult("code_quality", "warn", "; ".join(issues))
        return CheckResult("code_quality", "pass", "No code smells detected")

    def _check_test_safety(self) -> CheckResult:
        """Check if modified test files have suspicious patterns.

        Detects:
        - Test functions with empty body (only ``pass``)
        - ``@pytest.mark.skip`` / ``@unittest.skip`` decorators on test functions
        - Deleted test assertions (lines starting with ``-`` that contain ``assert``)
        """
        diff_output = self._run_git("diff", "HEAD~1", "HEAD")
        if not diff_output.strip():
            diff_output = self._run_git("diff", "--cached")
        if not diff_output.strip():
            return CheckResult("test_safety", "pass", "No diff available")

        # Find test files modified in this diff
        test_files: set[str] = set()
        for line in diff_output.splitlines():
            if line.startswith("diff --git"):
                # Extract filename: diff --git a/path/to/file b/path/to/file
                parts = line.split()
                if len(parts) >= 4:
                    fname = parts[3].lstrip("b/")
                    if (
                        fname.startswith("test_")
                        or fname.endswith("_test.py")
                        or "/tests/" in fname
                        or fname.startswith("tests/")
                    ):
                        test_files.add(fname)

        if not test_files:
            return CheckResult("test_safety", "pass", "No test files modified")

        issues: list[str] = []
        deleted_assertions = 0
        skip_decorators = 0
        empty_test_bodies = 0

        in_test_file = False
        current_file = ""
        in_function = False
        function_indent = 0
        function_body_lines = 0

        for line in diff_output.splitlines():
            # Track which file we're in
            if line.startswith("diff --git"):
                parts = line.split()
                if len(parts) >= 4:
                    current_file = parts[3].lstrip("b/")
                    in_test_file = (
                        current_file.startswith("test_")
                        or current_file.endswith("_test.py")
                        or "/tests/" in current_file
                        or current_file.startswith("tests/")
                    )
                in_function = False
                function_body_lines = 0
                continue

            if not in_test_file:
                continue

            # Track deleted assertions
            if line.startswith("-") and not line.startswith("---"):
                stripped = line[1:].strip()
                if re.match(r"assert\s+", stripped):
                    deleted_assertions += 1

            # Track added skip decorators
            if line.startswith("+") and not line.startswith("+++"):
                stripped = line[1:].strip()
                if re.search(
                    r"@pytest\.mark\.skip|@pytest\.mark\.xfail|@unittest\.skip",
                    stripped,
                ):
                    skip_decorators += 1

            # Detect empty test function bodies
            # A test function definition followed by only "pass" is suspicious
            if line.startswith("+") and not line.startswith("+++"):
                stripped = line[1:]
                # Detect function definition: def test_* or async def test_*
                if re.match(r"\s*(async\s+)?def\s+test_", stripped):
                    in_function = True
                    function_indent = len(stripped) - len(stripped.lstrip())
                    function_body_lines = 0
                elif in_function:
                    # Count non-empty, non-comment body lines
                    if stripped.strip() and not stripped.strip().startswith("#"):
                        function_body_lines += 1
                    # Check if indentation returns to function level or less
                    current_indent = len(stripped) - len(stripped.lstrip()) if stripped.strip() else function_indent + 4
                    if current_indent <= function_indent and function_body_lines == 0:
                        # Function ended with no body
                        empty_test_bodies += 1
                        in_function = False
                    elif current_indent <= function_indent:
                        in_function = False

        if deleted_assertions > 0:
            issues.append(f"{deleted_assertions} assertion(s) removed from test files")
        if skip_decorators > 0:
            issues.append(f"{skip_decorators} skip/xfail decorator(s) added to tests")
        if empty_test_bodies > 0:
            issues.append(f"{empty_test_bodies} test function(s) with empty body")

        if issues:
            return CheckResult("test_safety", "warn", "; ".join(issues))
        return CheckResult(
            "test_safety", "pass",
            f"{len(test_files)} test file(s) modified, no safety issues detected",
        )

    def _check_goal_alignment(
        self,
        report_text: str = "",
        experiment_goal: str = "",
    ) -> CheckResult:
        """Check if the experiment moves toward stated project goals.

        Evaluates:
        - Does the experiment report mention a goal or project objective?
        - Does the agent's decision (KEEP) come with a clear reason?
        - Is there a "Next" step indicating forward progress?

        This is a lightweight heuristic — full goal alignment requires
        semantic understanding, but keyword/pattern matching catches
        the most common cases.
        """
        if not report_text or not report_text.strip():
            return CheckResult("goal_alignment", "warn", "No report text for goal analysis")

        text_lower = report_text.lower()

        # Check for goal/project references
        has_goal = any(
            kw in text_lower
            for kw in ("goal:", "цель:", "objective", "target:", "project goal", "цель проекта")
        )
        # Check for forward progress indicators
        has_next = any(
            kw in text_lower
            for kw in ("next:", "дальше", "next step", "for next", "following")
        )
        # Check for concrete outcome
        has_result = any(
            kw in text_lower
            for kw in ("what was done", "results", "результат", "implemented", "реализовано", "fixed", "исправлено")
        )
        # Check for decision rationale
        has_reason = any(
            kw in text_lower
            for kw in ("reason:", "обоснован", "because", "since", "decision:", "решение")
        )

        score = sum([has_goal, has_next, has_result, has_reason])

        if score >= 3:
            return CheckResult("goal_alignment", "pass",
                f"Strong goal alignment ({score}/4 indicators: "
                f"goal={'Y' if has_goal else 'N'}, result={'Y' if has_result else 'N'}, "
                f"reason={'Y' if has_reason else 'N'}, next={'Y' if has_next else 'N'})")
        elif score >= 2:
            return CheckResult("goal_alignment", "warn",
                f"Partial goal alignment ({score}/4 indicators)")
        else:
            return CheckResult("goal_alignment", "warn",
                f"Weak goal alignment ({score}/4 indicators — no clear goal, result, or rationale)")

    def _run_all_checks(
        self,
        claimed_files: List[str],
        report_text: str,
        experiment_goal: str = "",
    ) -> List[CheckResult]:
        """Run all checks and return results."""
        checks: List[CheckResult] = []
        checks.append(self._check_commit_exists())
        checks.append(self._check_diff_files(claimed_files))
        checks.append(self._check_syntax())
        checks.append(self._check_diff_size())
        checks.append(self._check_report_quality(report_text))
        checks.append(self._check_code_quality())
        checks.append(self._check_test_safety())
        checks.append(self._check_goal_alignment(report_text, experiment_goal))
        return checks

    def _compute_verdict(
        self,
        checks: List[CheckResult],
        profile: JudgeProfile,
        agent_decision: str = "",
        agent_score: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Apply profile weights and thresholds to produce a verdict."""
        # Apply profile-specific weights
        weighted_checks = []
        for c in checks:
            w = profile.weights.get(c.name, 1.0)
            weighted_checks.append(CheckResult(c.name, c.status, c.message, weight=w))

        # Calculate score
        total_weight = sum(c.weight for c in weighted_checks)
        if total_weight == 0:
            score = 0.5
        else:
            score_map = {"pass": 1.0, "warn": 0.5, "fail": 0.0}
            weighted = sum(score_map.get(c.status, 0.5) * c.weight for c in weighted_checks)
            score = weighted / total_weight

        # Apply profile score adjustment
        score = max(0.0, min(1.0, score + profile.score_adjust))

        # Recommendation based on profile thresholds
        fails = sum(1 for c in weighted_checks if c.status == "fail")
        warns = sum(1 for c in weighted_checks if c.status == "warn")

        if fails >= profile.fail_threshold:
            recommendation = "DISCARD"
        elif fails >= 1:
            recommendation = "REVIEW"
        elif warns >= profile.warn_threshold:
            recommendation = "REVIEW"
        else:
            recommendation = "KEEP"

        # Summary
        passed = sum(1 for c in weighted_checks if c.status == "pass")
        summary = f"{passed}/{len(weighted_checks)} checks passed"
        if fails:
            summary += f", {fails} failed"
        if warns:
            summary += f", {warns} warnings"

        return {
            "score": round(score, 2),
            "recommendation": recommendation,
            "checks": [
                {
                    "name": c.name,
                    "status": c.status,
                    "message": c.message,
                    "weight": round(c.weight, 2),
                }
                for c in weighted_checks
            ],
            "summary": summary,
            "profile": profile.name,
            "profile_label": profile.label,
            "agent_decision": agent_decision,
            "agent_score": agent_score,
        }

    def evaluate(
        self,
        claimed_files: Optional[List[str]] = None,
        agent_decision: str = "",
        agent_score: Optional[float] = None,
        report_text: str = "",
        profile: str = "architect",
        experiment_goal: str = "",
    ) -> Dict[str, Any]:
        """Run all checks and produce a verdict.

        Args:
            claimed_files: Files the agent claims to have modified.
            agent_decision: Agent's own KEEP/DISCARD decision.
            agent_score: Agent's self-assessed score (0.0-1.0).
            report_text: The experiment report text.
            profile: Judge profile name ("guardian", "architect", "pragmatist",
                     or legacy "strict", "balanced", "lenient").
            experiment_goal: The stated goal of the experiment.

        Returns:
            Dict with score, recommendation, checks, summary, profile info.
        """
        claimed_files = claimed_files or []
        # Backward compatibility: map old names to new
        resolved_profile = _PROFILE_ALIASES.get(profile, profile)
        prof = JUDGE_PROFILES.get(resolved_profile, JUDGE_PROFILES["architect"])
        checks = self._run_all_checks(claimed_files, report_text, experiment_goal)
        return self._compute_verdict(checks, prof, agent_decision, agent_score)

    def _resolve_conflict(
        self,
        profiles: Dict[str, Dict[str, Any]],
        agent_decision: str = "",
        agent_score: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Chief judge meta-evaluation when specialist profiles disagree.

        Resolution strategy (context-aware, research-backed):
        1. **Safety veto** — If Guardian says DISCARD for safety reasons (test_safety
           or syntax_check fail), this takes priority regardless of other profiles.
        2. **Goal delivery** — If Pragmatist says KEEP and goal_alignment passed,
           the experiment delivered value even if not perfectly clean.
        3. **Architect tiebreaker** — When safety is not at risk, Architect's
           structural assessment is the deciding vote.
        4. **Agent agreement** — If the agent's self-assessment agrees with a
           majority-leaning profile, use that as tiebreaker.
        5. **Weighted score** — Final fallback using average scores with
           profile-specific authority weights.

        Returns dict with:
            - resolved: "KEEP" | "DISCARD" | "REVIEW" (final decision)
            - resolution_method: how the conflict was resolved
            - conflicts: list of per-check disagreements
            - agent_agreement: whether agent agrees with resolution
            - rationale: human-readable explanation
        """
        recs = {name: v["recommendation"] for name, v in profiles.items()}
        scores = {name: v["score"] for name, v in profiles.items()}

        # --- Identify per-check conflicts ---
        check_results: Dict[str, Dict[str, str]] = {}  # check_name → {profile: status}
        for pname, verdict in profiles.items():
            for chk in verdict.get("checks", []):
                cname = chk["name"]
                if cname not in check_results:
                    check_results[cname] = {}
                check_results[cname][pname] = chk["status"]

        conflicts: List[Dict[str, Any]] = []
        for cname, statuses in check_results.items():
            unique_statuses = set(statuses.values())
            if len(unique_statuses) > 1:
                passing = [p for p, s in statuses.items() if s == "pass"]
                failing = [p for p, s in statuses.items() if s in ("fail", "warn")]
                conflicts.append({
                    "check": cname,
                    "statuses": statuses,
                    "severity": "high" if "fail" in unique_statuses else "medium",
                    "split": f"{','.join(passing)} vs {','.join(failing)}",
                })

        # --- Resolution logic ---
        keep_count = list(recs.values()).count("KEEP")
        discard_count = list(recs.values()).count("DISCARD")
        review_count = list(recs.values()).count("REVIEW")
        avg_score = sum(scores.values()) / len(scores) if scores else 0

        resolved = "REVIEW"
        resolution_method = "default_review"

        # --- Method 1: Safety veto (Guardian DISCARD for safety-critical fails) ---
        guardian_verdict = profiles.get("guardian", {})
        guardian_checks = {c["name"]: c["status"] for c in guardian_verdict.get("checks", [])}
        guardian_rec = recs.get("guardian", "REVIEW")

        if guardian_rec == "DISCARD":
            # Check if DISCARD is due to safety-critical failures
            safety_fails = [
                name for name, status in guardian_checks.items()
                if status == "fail" and name in ("test_safety", "syntax_check")
            ]
            if safety_fails:
                resolved = "DISCARD"
                resolution_method = "safety_veto"
            else:
                # Guardian DISCARD for non-safety reasons (code_quality, diff_size)
                # — only override if both other profiles agree to KEEP
                if keep_count >= 2:
                    resolved = "KEEP"
                    resolution_method = "majority_override_safety"

        # --- Method 2: Goal delivery (Pragmatist KEEP + goal_alignment pass) ---
        if resolved == "REVIEW" and recs.get("pragmatist") == "KEEP":
            prag_checks = {c["name"]: c["status"] for c in profiles.get("pragmatist", {}).get("checks", [])}
            if prag_checks.get("goal_alignment") == "pass":
                # Experiment delivered value — only DISCARD if safety issue
                if guardian_rec != "DISCARD":
                    resolved = "KEEP"
                    resolution_method = "goal_delivery"

        # --- Method 3: Architect tiebreaker ---
        if resolved == "REVIEW":
            architect_score = scores.get("architect", avg_score)
            if architect_score >= 0.7:
                resolved = "KEEP"
                resolution_method = "architect_score_keep"
            elif architect_score <= 0.35:
                resolved = "DISCARD"
                resolution_method = "architect_score_discard"

        # --- Method 4: Agent agreement ---
        if resolved == "REVIEW":
            agent_dec_upper = agent_decision.upper() if agent_decision else ""
            if agent_dec_upper in ("KEEP", "DISCARD"):
                if agent_dec_upper == "KEEP" and keep_count >= 1 and discard_count <= 1:
                    resolved = "KEEP"
                    resolution_method = "agent_tiebreaker_keep"
                elif agent_dec_upper == "DISCARD" and discard_count >= 1 and keep_count <= 1:
                    resolved = "DISCARD"
                    resolution_method = "agent_tiebreaker_discard"

        # --- Method 5: Weighted score fallback ---
        if resolved == "REVIEW":
            # Authority weights: Guardian=1.3, Architect=1.1, Pragmatist=0.9
            authority = {"guardian": 1.3, "architect": 1.1, "pragmatist": 0.9}
            weighted_score = sum(
                scores.get(name, 0) * authority.get(name, 1.0)
                for name in scores
            ) / sum(authority.get(name, 1.0) for name in scores)

            if weighted_score >= 0.6:
                resolved = "KEEP"
                resolution_method = "authority_weighted_keep"
            elif weighted_score <= 0.35:
                resolved = "DISCARD"
                resolution_method = "authority_weighted_discard"
            elif avg_score > 0.5:
                resolved = "KEEP"
                resolution_method = "avg_score_keep"
            else:
                resolved = "DISCARD"
                resolution_method = "avg_score_discard"

        # --- Agent agreement check ---
        agent_agreement = "unknown"
        agent_dec_upper = agent_decision.upper() if agent_decision else ""
        if agent_dec_upper in ("KEEP", "DISCARD"):
            agent_agreement = "agrees" if agent_dec_upper == resolved else "disagrees"

        # --- Rationale ---
        rationale_parts = [
            f"Specialists disagree: guardian={recs.get('guardian', '?')}, "
            f"architect={recs.get('architect', '?')}, pragmatist={recs.get('pragmatist', '?')}",
            f"Scores: guardian={scores.get('guardian', 0):.2f}, "
            f"architect={scores.get('architect', 0):.2f}, "
            f"pragmatist={scores.get('pragmatist', 0):.2f}",
        ]
        if conflicts:
            rationale_parts.append(f"Conflicting checks: {', '.join(c['check'] for c in conflicts)}")
        rationale_parts.append(f"Chief judge: {resolved} via {resolution_method}")
        if agent_agreement != "unknown":
            rationale_parts.append(f"Agent {agent_agreement}")

        return {
            "resolved": resolved,
            "resolution_method": resolution_method,
            "conflicts": conflicts,
            "conflict_count": len(conflicts),
            "agent_agreement": agent_agreement,
            "rationale": ". ".join(rationale_parts),
        }

    def evaluate_all(
        self,
        claimed_files: Optional[List[str]] = None,
        agent_decision: str = "",
        agent_score: Optional[float] = None,
        report_text: str = "",
        experiment_goal: str = "",
    ) -> Dict[str, Any]:
        """Run all judge profiles and return combined verdicts.

        Returns dict with:
            - profiles: dict of profile_name → verdict
            - consensus: "KEEP" | "DISCARD" | "REVIEW"
            - consensus_score: average score across profiles
            - agent_decision, agent_score
            - conflict_resolution: when judges disagree, how it was resolved
        """
        claimed_files = claimed_files or []
        checks = self._run_all_checks(claimed_files, report_text, experiment_goal)

        profiles: Dict[str, Dict[str, Any]] = {}
        for name, prof in JUDGE_PROFILES.items():
            profiles[name] = self._compute_verdict(
                [CheckResult(c.name, c.status, c.message) for c in checks],
                prof, agent_decision, agent_score,
            )

        # Consensus: majority vote
        recs = [v["recommendation"] for v in profiles.values()]
        keep_count = recs.count("KEEP")
        discard_count = recs.count("DISCARD")
        review_count = recs.count("REVIEW")

        if keep_count >= 2:
            consensus = "KEEP"
        elif discard_count >= 2:
            consensus = "DISCARD"
        elif review_count >= 2:
            consensus = "REVIEW"
        else:
            # SPLIT — use conflict resolution
            conflict = self._resolve_conflict(profiles, agent_decision, agent_score)
            consensus = conflict["resolved"]
        # Average score
        avg_score = sum(v["score"] for v in profiles.values()) / len(profiles) if profiles else 0

        result = {
            "profiles": profiles,
            "consensus": consensus,
            "consensus_score": round(avg_score, 2),
            "agent_decision": agent_decision,
            "agent_score": agent_score,
            "available_profiles": list(JUDGE_PROFILES.keys()),
        }

        # Add conflict resolution details when judges disagreed
        if recs.count("KEEP") < 2 and recs.count("DISCARD") < 2 and recs.count("REVIEW") < 2:
            result["conflict_resolution"] = self._resolve_conflict(
                profiles, agent_decision, agent_score,
            )

        return result


# ---------------------------------------------------------------------------
# Judge History — analytics, trends, self-adjustment
# ---------------------------------------------------------------------------

class JudgeHistory:
    """Aggregates judge verdicts across experiments for analytics.

    Loads all ``judge_*_all.json`` files from the experiments directory,
    computes per-profile accuracy, check reliability, score trends, and
    provides weight self-adjustment suggestions.
    """

    def __init__(self, project_dir: Path):
        self.project_dir = Path(project_dir).resolve()
        self.exp_dir = self.project_dir / ".autoresearch" / "experiments"
        self._verdicts: List[Dict[str, Any]] = []

    def load(self) -> List[Dict[str, Any]]:
        """Load all judge verdict files, sorted by experiment number."""
        if not self.exp_dir.exists():
            return []
        self._verdicts = []
        for f in sorted(self.exp_dir.glob("judge_*_all.json")):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                # Extract experiment number from filename: judge_42_all.json
                m = re.search(r"judge_(\d+)_all", f.name)
                if m:
                    data["experiment"] = int(m.group(1))
                self._verdicts.append(data)
            except (json.JSONDecodeError, OSError) as e:
                logger.warning("Failed to load judge file %s: %s", f.name, e)
        return self._verdicts

    def get_analytics(self) -> Dict[str, Any]:
        """Compute full analytics from loaded verdicts.

        Returns dict with:
            - total_verdicts: number of judged experiments
            - consensus_distribution: {KEEP: N, DISCARD: N, REVIEW: N, SPLIT: N}
            - score_trend: [{experiment, consensus_score, consensus}]
            - profile_accuracy: {profile_name: {agrees_with_consensus: N, total: N, rate: float}}
            - check_reliability: {check_name: {pass_rate, warn_rate, fail_rate, discriminative_score}}
            - weight_adjustments: suggested weight changes for self-improvement
            - avg_consensus_score: overall average
        """
        if not self._verdicts:
            self.load()

        if not self._verdicts:
            return {
                "total_verdicts": 0,
                "consensus_distribution": {},
                "score_trend": [],
                "profile_accuracy": {},
                "check_reliability": {},
                "weight_adjustments": {},
                "avg_consensus_score": 0,
            }

        # --- Consensus distribution ---
        consensus_dist: Dict[str, int] = {}
        score_trend: List[Dict[str, Any]] = []
        for v in self._verdicts:
            c = v.get("consensus", "UNKNOWN")
            consensus_dist[c] = consensus_dist.get(c, 0) + 1
            score_trend.append({
                "experiment": v.get("experiment", 0),
                "consensus_score": v.get("consensus_score", 0),
                "consensus": c,
            })

        # --- Profile accuracy ---
        profile_accuracy: Dict[str, Dict[str, Any]] = {}
        for profile_name in JUDGE_PROFILES:
            agrees = 0
            total = 0
            for v in self._verdicts:
                profiles = v.get("profiles", {})
                if profile_name not in profiles:
                    continue
                total += 1
                if profiles[profile_name]["recommendation"] == v.get("consensus"):
                    agrees += 1
            if total > 0:
                profile_accuracy[profile_name] = {
                    "agrees_with_consensus": agrees,
                    "total": total,
                    "rate": round(agrees / total, 2),
                }

        # --- Check reliability ---
        check_reliability: Dict[str, Dict[str, Any]] = {}
        # Collect all check results across all verdicts
        check_data: Dict[str, List[str]] = {}  # check_name → [status, ...]
        for v in self._verdicts:
            for pname, pverdict in v.get("profiles", {}).items():
                for check in pverdict.get("checks", []):
                    cname = check.get("name", "unknown")
                    if cname not in check_data:
                        check_data[cname] = []
                    check_data[cname].append(check.get("status", "warn"))

        for cname, statuses in check_data.items():
            n = len(statuses)
            pass_r = round(statuses.count("pass") / n, 2) if n else 0
            warn_r = round(statuses.count("warn") / n, 2) if n else 0
            fail_r = round(statuses.count("fail") / n, 2) if n else 0
            # Discriminative score: high variance = more discriminative
            # Uses normalized entropy: 0 = always same, 1 = evenly split
            import math
            entropy = 0
            for rate in (pass_r, warn_r, fail_r):
                if rate > 0:
                    entropy -= rate * math.log2(rate)
            max_entropy = math.log2(3)  # ~1.585
            discriminative = round(entropy / max_entropy, 2) if max_entropy > 0 else 0

            check_reliability[cname] = {
                "pass_rate": pass_r,
                "warn_rate": warn_r,
                "fail_rate": fail_r,
                "discriminative_score": discriminative,
                "total_evaluations": n,
            }

        # --- Weight adjustments (self-improvement) ---
        weight_adjustments = self._compute_weight_adjustments(check_reliability)

        # --- Average score ---
        avg_score = sum(v.get("consensus_score", 0) for v in self._verdicts) / len(self._verdicts)

        return {
            "total_verdicts": len(self._verdicts),
            "consensus_distribution": consensus_dist,
            "score_trend": score_trend,
            "profile_accuracy": profile_accuracy,
            "check_reliability": check_reliability,
            "weight_adjustments": weight_adjustments,
            "avg_consensus_score": round(avg_score, 2),
        }

    def _compute_weight_adjustments(
        self,
        check_reliability: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        """Compute suggested weight adjustments based on check discriminative power.

        Logic:
        - High discriminative score (> 0.7) → increase weight (check is useful)
        - Low discriminative score (< 0.3) → decrease weight (check always same result)
        - High fail rate (> 0.5) → check may be too strict, suggest lowering threshold
        - High pass rate (> 0.95) → check is trivially passing, reduce weight
        """
        adjustments: Dict[str, Dict[str, Any]] = {}
        for cname, data in check_reliability.items():
            adj: Dict[str, Any] = {}
            disc = data.get("discriminative_score", 0)
            pass_r = data.get("pass_rate", 0)
            fail_r = data.get("fail_rate", 0)

            if pass_r > 0.95:
                adj["suggestion"] = "reduce_weight"
                adj["reason"] = f"Pass rate {pass_r:.0%} — check is trivially passing, not discriminative"
                adj["multiplier"] = 0.5
            elif fail_r > 0.5:
                adj["suggestion"] = "lower_threshold"
                adj["reason"] = f"Fail rate {fail_r:.0%} — check may be too strict"
                adj["multiplier"] = 0.8
            elif disc > 0.7:
                adj["suggestion"] = "increase_weight"
                adj["reason"] = f"Discriminative score {disc:.2f} — check provides useful signal"
                adj["multiplier"] = 1.3
            elif disc < 0.3:
                adj["suggestion"] = "reduce_weight"
                adj["reason"] = f"Discriminative score {disc:.2f} — check rarely varies"
                adj["multiplier"] = 0.7
            else:
                adj["suggestion"] = "keep"
                adj["reason"] = "Check performance is within normal range"
                adj["multiplier"] = 1.0

            adjustments[cname] = adj

        return adjustments

    # ------------------------------------------------------------------
    #  Weight persistence & auto-adjustment
    # ------------------------------------------------------------------

    _WEIGHTS_FILE = "judge_weights.json"

    def _weights_path(self) -> Path:
        return self.project_dir / ".autoresearch" / self._WEIGHTS_FILE

    def load_custom_weights(self) -> Optional[Dict[str, Dict[str, float]]]:
        """Load previously saved per-profile custom weights.

        Returns dict ``{profile_name: {check_name: weight}}`` or None.
        """
        path = self._weights_path()
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            # Validate structure
            if not isinstance(data, dict):
                return None
            return data
        except (json.JSONDecodeError, OSError):
            return None

    def save_custom_weights(self, weights: Dict[str, Dict[str, float]]) -> None:
        """Persist custom weights to disk."""
        path = self._weights_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(weights, indent=2), encoding="utf-8",
        )

    def reset_weights(self) -> bool:
        """Delete custom weights file, restoring defaults. Returns True if deleted."""
        path = self._weights_path()
        if path.exists():
            path.unlink()
            return True
        return False

    def apply_weight_adjustments(
        self,
        min_verdicts: int = 5,
        max_weight: float = 3.0,
        min_weight: float = 0.2,
        blend_factor: float = 0.3,
    ) -> Dict[str, Any]:
        """Apply computed weight adjustments to JUDGE_PROFILES with safeguards.

        Args:
            min_verdicts: Minimum verdicts needed before adjustments kick in.
            max_weight: Upper clamp for any weight value.
            min_weight: Lower clamp for any weight value.
            blend_factor: How aggressively to apply (0.0 = no change, 1.0 = full).

        Returns:
            Dict with applied_changes, skipped, and summary.
        """
        analytics = self.get_analytics()
        total = analytics.get("total_verdicts", 0)

        if total < min_verdicts:
            return {
                "applied": False,
                "reason": f"Only {total} verdicts (need {min_verdicts})",
                "changes": {},
            }

        adjustments = analytics.get("weight_adjustments", {})
        if not adjustments:
            return {
                "applied": False,
                "reason": "No adjustments computed",
                "changes": {},
            }

        # Load existing custom weights as base (or start from defaults)
        custom = self.load_custom_weights() or {}

        applied: Dict[str, Dict[str, Any]] = {}

        for cname, adj in adjustments.items():
            if adj.get("suggestion") == "keep":
                continue

            multiplier = adj.get("multiplier", 1.0)
            reason = adj.get("reason", "")

            for pname in JUDGE_PROFILES:
                profile = JUDGE_PROFILES[pname]
                default_w = profile.weights.get(cname, 1.0)
                # Get current base: custom override or default
                current_base = custom.get(pname, {}).get(cname, default_w)

                # Blend: new = current * (1 - factor) + (current * multiplier) * factor
                target = current_base * multiplier
                new_w = current_base * (1 - blend_factor) + target * blend_factor
                new_w = max(min_weight, min(max_weight, round(new_w, 2)))

                if abs(new_w - current_base) < 0.01:
                    continue  # negligible change

                if pname not in custom:
                    custom[pname] = {}
                custom[pname][cname] = new_w

                # Also update in-memory profile weights for immediate effect
                profile.weights[cname] = new_w

                if cname not in applied:
                    applied[cname] = {}
                applied[cname][pname] = {
                    "old": round(current_base, 2),
                    "new": new_w,
                    "reason": reason,
                }

        if applied:
            self.save_custom_weights(custom)

        return {
            "applied": bool(applied),
            "verdicts_used": total,
            "changes": applied,
            "reason": f"Adjusted {sum(len(v) for v in applied.values())} weight(s) across {len(applied)} check(s)",
        }

    def auto_adjust(self, min_verdicts: int = 5) -> Optional[Dict[str, Any]]:
        """One-shot: load history, compute analytics, apply adjustments.

        Returns the adjustment result dict or None if skipped.
        """
        self.load()
        if not self._verdicts:
            return None
        return self.apply_weight_adjustments(min_verdicts=min_verdicts)
