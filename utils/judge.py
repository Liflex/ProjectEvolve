"""Post-experiment auto-judge — basic sanity checker.

Evaluates experiment results after the agent commits by running
a set of lightweight checks:
  1. Git commit verification — did the agent commit?
  2. File consistency — do claimed files match actual git diff?
  3. Syntax validation — no obvious errors in changed files
  4. Diff size sanity — not too large, not empty

Produces a verdict dict with score, decision recommendation, and check details.
"""

from __future__ import annotations

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
# Judge
# ---------------------------------------------------------------------------

class ExperimentJudge:
    """Lightweight post-experiment evaluator.

    Usage::

        judge = ExperimentJudge(project_dir)
        verdict = judge.evaluate(
            claimed_files=["ui/static/js/modules/chat.js"],
            agent_decision="KEEP",
            agent_score=0.8,
        )
    """

    def __init__(self, project_dir: Path):
        self.project_dir = Path(project_dir).resolve()

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
        # Get files changed in last commit
        diff_output = self._run_git("diff", "--name-only", "HEAD~1", "HEAD")
        if not diff_output.strip():
            # Maybe only one commit exists
            diff_output = self._run_git("diff", "--name-only", "--cached")
        if not diff_output.strip():
            diff_output = self._run_git("show", "--name-only", "--pretty=format:", "HEAD")

        actual_files = set(f.strip() for f in diff_output.strip().splitlines() if f.strip())
        claimed_set = set(claimed_files)

        if not actual_files:
            return CheckResult("file_consistency", "warn", "No file changes detected in last commit")

        # Normalize paths for comparison
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
                    # Basic check: file is valid UTF-8 and not empty
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

        # Parse: "3 files changed, 50 insertions(+), 10 deletions(-)"
        m = re.search(r"(\d+) files? changed", stat)
        files_changed = int(m.group(1)) if m else 0
        m = re.search(r"(\d+) insertion", stat)
        insertions = int(m.group(1)) if m else 0
        m = re.search(r"(\d+) deletion", stat)
        deletions = int(m.group(1)) if m else 0

        total_lines = insertions + deletions

        if total_lines == 0:
            return CheckResult("diff_size", "warn", "No lines changed")

        if total_lines > 2000:
            return CheckResult(
                "diff_size", "warn",
                f"Large change: {files_changed} files, +{insertions}/-{deletions} lines"
            )

        if total_lines > 5000:
            return CheckResult(
                "diff_size", "fail",
                f"Very large change: {files_changed} files, +{insertions}/-{deletions} lines"
            )

        return CheckResult(
            "diff_size", "pass",
            f"{files_changed} file(s), +{insertions}/-{deletions} lines"
        )

    def evaluate(
        self,
        claimed_files: Optional[List[str]] = None,
        agent_decision: str = "",
        agent_score: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Run all checks and produce a verdict.

        Returns dict with:
            - score: float (0.0-1.0)
            - recommendation: "KEEP" | "DISCARD" | "REVIEW"
            - checks: list of check result dicts
            - summary: str
        """
        claimed_files = claimed_files or []
        checks: List[CheckResult] = []

        # Run all checks
        checks.append(self._check_commit_exists())
        checks.append(self._check_diff_files(claimed_files))
        checks.append(self._check_syntax())
        checks.append(self._check_diff_size())

        # Calculate score from checks
        total_weight = sum(c.weight for c in checks)
        if total_weight == 0:
            score = 0.5
        else:
            score_map = {"pass": 1.0, "warn": 0.5, "fail": 0.0}
            weighted = sum(score_map.get(c.status, 0.5) * c.weight for c in checks)
            score = weighted / total_weight

        # Recommendation
        fails = sum(1 for c in checks if c.status == "fail")
        warns = sum(1 for c in checks if c.status == "warn")

        if fails >= 2:
            recommendation = "DISCARD"
        elif fails >= 1:
            recommendation = "REVIEW"
        elif warns >= 2:
            recommendation = "REVIEW"
        else:
            recommendation = "KEEP"

        # Summary
        passed = sum(1 for c in checks if c.status == "pass")
        summary = f"{passed}/{len(checks)} checks passed"
        if fails:
            summary += f", {fails} failed"
        if warns:
            summary += f", {warns} warnings"

        return {
            "score": round(score, 2),
            "recommendation": recommendation,
            "checks": [
                {"name": c.name, "status": c.status, "message": c.message}
                for c in checks
            ],
            "summary": summary,
            "agent_decision": agent_decision,
            "agent_score": agent_score,
        }
