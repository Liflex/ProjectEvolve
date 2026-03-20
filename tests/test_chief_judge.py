"""Tests for chief judge meta-analysis, conflict resolution, and tiebreaker logic.

Tests cover:
- ExperimentJudge creation and profile loading
- _resolve_conflict: safety veto, goal delivery, architect tiebreaker,
  agent agreement, authority-weighted scoring
- evaluate_all: consensus computation with majority and split verdicts
- run_parallel_judges: consensus logic in agents/parallel.py
"""

from __future__ import annotations

import sys
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.judge import (
    ExperimentJudge,
    JudgeProfile,
    CheckResult,
    JUDGE_PROFILES,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_checks(**statuses: str) -> list[dict]:
    """Build a checks list for a profile verdict.

    Usage: _make_checks(test_safety="fail", syntax_check="pass", ...)
    """
    return [
        {"name": name, "status": status, "message": f"{name} is {status}", "weight": 1.0}
        for name, status in statuses.items()
    ]


def _make_profile_verdict(recommendation: str, score: float, checks: list[dict]) -> dict:
    """Build a minimal profile verdict dict matching _resolve_conflict input format."""
    return {
        "recommendation": recommendation,
        "score": score,
        "checks": checks,
        "profile": "test",
        "profile_label": "TEST",
        "agent_decision": "",
        "agent_score": None,
        "summary": "test verdict",
    }


def _make_judge_with_tmpdir(tmp_path: Path) -> ExperimentJudge:
    """Create an ExperimentJudge in a temp directory (no .autoresearch/judge_weights.json)."""
    return ExperimentJudge(tmp_path)


# ---------------------------------------------------------------------------
# 1. Creation smoke tests
# ---------------------------------------------------------------------------

class TestExperimentJudgeCreation:

    def test_creates_without_error(self, tmp_path):
        judge = ExperimentJudge(tmp_path)
        assert judge is not None
        assert judge.project_dir == tmp_path.resolve()

    def test_all_profiles_loaded(self):
        assert "guardian" in JUDGE_PROFILES
        assert "architect" in JUDGE_PROFILES
        assert "pragmatist" in JUDGE_PROFILES

    def test_guardian_has_strictest_thresholds(self):
        g = JUDGE_PROFILES["guardian"]
        a = JUDGE_PROFILES["architect"]
        p = JUDGE_PROFILES["pragmatist"]
        # Guardian should have lowest fail threshold (most strict)
        assert g.fail_threshold <= a.fail_threshold
        assert g.fail_threshold <= p.fail_threshold

    def test_guardian_weights_safety_highest(self):
        g = JUDGE_PROFILES["guardian"]
        assert g.weights["test_safety"] >= g.weights["diff_size"]
        assert g.weights["syntax_check"] >= g.weights["report_quality"]

    def test_profile_aliases_work(self):
        from utils.judge import _PROFILE_ALIASES
        assert _PROFILE_ALIASES["strict"] == "guardian"
        assert _PROFILE_ALIASES["balanced"] == "architect"
        assert _PROFILE_ALIASES["lenient"] == "pragmatist"


# ---------------------------------------------------------------------------
# 2. _resolve_conflict tests
# ---------------------------------------------------------------------------

class TestConflictResolution:

    # --- Method 1: Safety veto ---

    def test_safety_veto_blocks_all(self, tmp_path):
        """Guardian DISCARD with test_safety fail → DISCARD, even if others say KEEP."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "DISCARD", 0.3,
                _make_checks(test_safety="fail", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "architect": _make_profile_verdict(
                "KEEP", 0.8,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "pragmatist": _make_profile_verdict(
                "KEEP", 0.9,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
        }
        result = judge._resolve_conflict(profiles)
        assert result["resolved"] == "DISCARD"
        assert result["resolution_method"] == "safety_veto"

    def test_safety_veto_syntax_fail(self, tmp_path):
        """Guardian DISCARD with syntax_check fail → DISCARD."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "DISCARD", 0.25,
                _make_checks(test_safety="pass", syntax_check="fail",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "architect": _make_profile_verdict(
                "KEEP", 0.85,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "pragmatist": _make_profile_verdict(
                "KEEP", 0.9,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
        }
        result = judge._resolve_conflict(profiles)
        assert result["resolved"] == "DISCARD"
        assert result["resolution_method"] == "safety_veto"

    def test_non_safety_discard_overridden_by_majority(self, tmp_path):
        """Guardian DISCARD for non-safety reasons (code_quality fail only)
        should be overridden if both others say KEEP."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "DISCARD", 0.4,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="fail", goal_alignment="pass"),
            ),
            "architect": _make_profile_verdict(
                "KEEP", 0.85,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "pragmatist": _make_profile_verdict(
                "KEEP", 0.9,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
        }
        result = judge._resolve_conflict(profiles)
        assert result["resolved"] == "KEEP"
        assert result["resolution_method"] == "majority_override_safety"

    # --- Method 2: Goal delivery ---

    def test_goal_delivery_keep(self, tmp_path):
        """Pragmatist KEEP with goal_alignment pass, no safety issue → KEEP."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "REVIEW", 0.5,
                _make_checks(test_safety="warn", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="warn", goal_alignment="pass"),
            ),
            "architect": _make_profile_verdict(
                "REVIEW", 0.55,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="warn", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "pragmatist": _make_profile_verdict(
                "KEEP", 0.8,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
        }
        result = judge._resolve_conflict(profiles)
        assert result["resolved"] == "KEEP"
        assert result["resolution_method"] == "goal_delivery"

    # --- Method 3: Architect tiebreaker ---

    def test_architect_tiebreaker_keep(self, tmp_path):
        """Architect high score (>=0.7) → KEEP when no other method resolved."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "REVIEW", 0.5,
                _make_checks(test_safety="warn", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="warn", goal_alignment="warn"),
            ),
            "architect": _make_profile_verdict(
                "KEEP", 0.75,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "pragmatist": _make_profile_verdict(
                "REVIEW", 0.5,
                _make_checks(test_safety="warn", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="warn",
                             code_quality="warn", goal_alignment="warn"),
            ),
        }
        result = judge._resolve_conflict(profiles)
        assert result["resolved"] == "KEEP"
        assert result["resolution_method"] == "architect_score_keep"

    def test_architect_tiebreaker_discard(self, tmp_path):
        """Architect low score (<=0.35) → DISCARD."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "REVIEW", 0.4,
                _make_checks(test_safety="warn", syntax_check="pass",
                             commit_exists="pass", file_consistency="warn",
                             diff_size="warn", report_quality="warn",
                             code_quality="warn", goal_alignment="warn"),
            ),
            "architect": _make_profile_verdict(
                "DISCARD", 0.3,
                _make_checks(test_safety="warn", syntax_check="pass",
                             commit_exists="warn", file_consistency="warn",
                             diff_size="fail", report_quality="fail",
                             code_quality="warn", goal_alignment="warn"),
            ),
            "pragmatist": _make_profile_verdict(
                "REVIEW", 0.45,
                _make_checks(test_safety="warn", syntax_check="pass",
                             commit_exists="pass", file_consistency="warn",
                             diff_size="warn", report_quality="warn",
                             code_quality="warn", goal_alignment="warn"),
            ),
        }
        result = judge._resolve_conflict(profiles)
        assert result["resolved"] == "DISCARD"
        assert result["resolution_method"] == "architect_score_discard"

    # --- Method 4: Agent agreement tiebreaker ---

    def test_agent_agreement_keep(self, tmp_path):
        """Agent says KEEP, 1 profile says KEEP → KEEP via agent tiebreaker."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "REVIEW", 0.5,
                _make_checks(test_safety="warn", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="warn", goal_alignment="warn"),
            ),
            "architect": _make_profile_verdict(
                "REVIEW", 0.5,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="warn", report_quality="warn",
                             code_quality="pass", goal_alignment="warn"),
            ),
            "pragmatist": _make_profile_verdict(
                "KEEP", 0.6,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="warn"),
            ),
        }
        result = judge._resolve_conflict(profiles, agent_decision="KEEP")
        assert result["resolved"] == "KEEP"
        assert result["resolution_method"] == "agent_tiebreaker_keep"

    def test_agent_agreement_discard(self, tmp_path):
        """Agent says DISCARD, 1 profile says DISCARD → DISCARD via agent tiebreaker."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "DISCARD", 0.3,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="warn", goal_alignment="warn"),
            ),
            "architect": _make_profile_verdict(
                "REVIEW", 0.5,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="warn", report_quality="pass",
                             code_quality="pass", goal_alignment="warn"),
            ),
            "pragmatist": _make_profile_verdict(
                "REVIEW", 0.5,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="warn",
                             code_quality="pass", goal_alignment="warn"),
            ),
        }
        result = judge._resolve_conflict(profiles, agent_decision="DISCARD")
        assert result["resolved"] == "DISCARD"
        assert result["resolution_method"] == "agent_tiebreaker_discard"

    # --- Method 5: Authority-weighted scoring ---

    def test_authority_weighted_keep(self, tmp_path):
        """Weighted score >= 0.6 → KEEP when no other method resolves."""
        judge = _make_judge_with_tmpdir(tmp_path)
        # Authority: guardian=1.3, architect=1.1, pragmatist=0.9
        # guardian=0.6, architect=0.6, pragmatist=0.6 → weighted = 0.6 (>= 0.6 → KEEP)
        profiles = {
            "guardian": _make_profile_verdict(
                "REVIEW", 0.6,
                _make_checks(test_safety="warn", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="warn", goal_alignment="pass"),
            ),
            "architect": _make_profile_verdict(
                "REVIEW", 0.6,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="warn", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "pragmatist": _make_profile_verdict(
                "REVIEW", 0.6,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="warn",
                             code_quality="pass", goal_alignment="pass"),
            ),
        }
        result = judge._resolve_conflict(profiles)
        assert result["resolved"] == "KEEP"
        assert result["resolution_method"] == "authority_weighted_keep"

    def test_authority_weighted_discard(self, tmp_path):
        """Weighted score <= 0.35 → DISCARD."""
        judge = _make_judge_with_tmpdir(tmp_path)
        # architect=0.4 (> 0.35, skips architect tiebreaker) but guardian=0.2,
        # pragmatist=0.2 drag weighted score down:
        # weighted = (0.2*1.3 + 0.4*1.1 + 0.2*0.9) / 3.3 = 0.88/3.3 ≈ 0.267
        profiles = {
            "guardian": _make_profile_verdict(
                "REVIEW", 0.2,
                _make_checks(test_safety="warn", syntax_check="warn",
                             commit_exists="warn", file_consistency="warn",
                             diff_size="warn", report_quality="warn",
                             code_quality="warn", goal_alignment="warn"),
            ),
            "architect": _make_profile_verdict(
                "REVIEW", 0.4,
                _make_checks(test_safety="warn", syntax_check="warn",
                             commit_exists="warn", file_consistency="warn",
                             diff_size="warn", report_quality="warn",
                             code_quality="warn", goal_alignment="warn"),
            ),
            "pragmatist": _make_profile_verdict(
                "REVIEW", 0.2,
                _make_checks(test_safety="warn", syntax_check="warn",
                             commit_exists="warn", file_consistency="warn",
                             diff_size="warn", report_quality="warn",
                             code_quality="warn", goal_alignment="warn"),
            ),
        }
        result = judge._resolve_conflict(profiles)
        assert result["resolved"] == "DISCARD"
        assert result["resolution_method"] == "authority_weighted_discard"

    def test_authority_weights_prefer_guardian(self, tmp_path):
        """Guardian has highest authority weight (1.3), so its score impacts more."""
        # All scores = 0.5, but guardian has higher authority
        # weighted = (0.5*1.3 + 0.5*1.1 + 0.5*0.9) / (1.3+1.1+0.9) = 1.65/3.3 = 0.5
        # 0.5 > 0.35 but < 0.6 → falls through to avg_score check → avg=0.5 > 0.5? No, equal.
        # So it should go to avg_score_discard since avg_score is NOT > 0.5
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "REVIEW", 0.5,
                _make_checks(test_safety="warn", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="warn", goal_alignment="pass"),
            ),
            "architect": _make_profile_verdict(
                "REVIEW", 0.5,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "pragmatist": _make_profile_verdict(
                "REVIEW", 0.5,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
        }
        result = judge._resolve_conflict(profiles)
        # avg_score = 0.5, NOT > 0.5 → DISCARD
        assert result["resolved"] == "DISCARD"
        assert result["resolution_method"] == "avg_score_discard"

    # --- Conflict detection ---

    def test_conflicts_detected(self, tmp_path):
        """Conflicting checks across profiles should be detected."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "DISCARD", 0.4,
                _make_checks(test_safety="fail", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="fail", goal_alignment="pass"),
            ),
            "architect": _make_profile_verdict(
                "KEEP", 0.8,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "pragmatist": _make_profile_verdict(
                "KEEP", 0.9,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
        }
        result = judge._resolve_conflict(profiles)
        assert result["conflict_count"] > 0
        assert len(result["conflicts"]) > 0
        # test_safety and code_quality should be in conflicts
        conflict_names = [c["check"] for c in result["conflicts"]]
        assert "test_safety" in conflict_names

    # --- Agent agreement metadata ---

    def test_agent_agrees_with_resolution(self, tmp_path):
        """When agent decision matches resolution, agent_agreement='agrees'."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "DISCARD", 0.3,
                _make_checks(test_safety="fail", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "architect": _make_profile_verdict(
                "KEEP", 0.8,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "pragmatist": _make_profile_verdict(
                "KEEP", 0.9,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
        }
        result = judge._resolve_conflict(profiles, agent_decision="DISCARD")
        assert result["agent_agreement"] == "agrees"

    def test_agent_disagrees_with_resolution(self, tmp_path):
        """When agent decision differs from resolution, agent_agreement='disagrees'."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict(
                "DISCARD", 0.3,
                _make_checks(test_safety="fail", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "architect": _make_profile_verdict(
                "KEEP", 0.8,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
            "pragmatist": _make_profile_verdict(
                "KEEP", 0.9,
                _make_checks(test_safety="pass", syntax_check="pass",
                             commit_exists="pass", file_consistency="pass",
                             diff_size="pass", report_quality="pass",
                             code_quality="pass", goal_alignment="pass"),
            ),
        }
        result = judge._resolve_conflict(profiles, agent_decision="KEEP")
        assert result["agent_agreement"] == "disagrees"

    def test_agent_unknown_when_no_decision(self, tmp_path):
        """No agent decision → agent_agreement='unknown'."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
            "architect": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
            "pragmatist": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
        }
        result = judge._resolve_conflict(profiles, agent_decision="")
        assert result["agent_agreement"] == "unknown"


# ---------------------------------------------------------------------------
# 3. evaluate_all consensus tests
# ---------------------------------------------------------------------------

class TestEvaluateAllConsensus:

    def test_majority_keep_2_of_3(self, tmp_path):
        """2 KEEP + 1 DISCARD → consensus KEEP, no conflict_resolution key."""
        judge = _make_judge_with_tmpdir(tmp_path)
        # Mock _run_all_checks to return consistent check results
        checks = [
            CheckResult("commit_exists", "pass", "ok"),
            CheckResult("file_consistency", "pass", "ok"),
            CheckResult("syntax_check", "pass", "ok"),
            CheckResult("diff_size", "pass", "ok"),
            CheckResult("report_quality", "pass", "ok"),
            CheckResult("code_quality", "pass", "ok"),
            CheckResult("test_safety", "pass", "ok"),
            CheckResult("goal_alignment", "pass", "ok"),
        ]
        with patch.object(judge, '_run_all_checks', return_value=checks):
            result = judge.evaluate_all(claimed_files=["README.md"])
        # All checks pass → all profiles should say KEEP
        assert result["consensus"] == "KEEP"
        # No conflict resolution needed
        assert "conflict_resolution" not in result

    def test_no_checks_produces_result(self, tmp_path):
        """Even with empty checks, evaluate_all returns valid structure."""
        judge = _make_judge_with_tmpdir(tmp_path)
        with patch.object(judge, '_run_all_checks', return_value=[]):
            result = judge.evaluate_all()
        assert "consensus" in result
        assert "profiles" in result
        assert "consensus_score" in result
        assert len(result["profiles"]) == 3

    def test_all_fail_gives_discard_consensus(self, tmp_path):
        """All checks fail → DISCARD consensus from majority."""
        judge = _make_judge_with_tmpdir(tmp_path)
        checks = [
            CheckResult("commit_exists", "fail", "no commit"),
            CheckResult("file_consistency", "fail", "mismatch"),
            CheckResult("syntax_check", "fail", "errors"),
            CheckResult("diff_size", "fail", "too large"),
            CheckResult("report_quality", "fail", "bad"),
            CheckResult("code_quality", "fail", "smells"),
            CheckResult("test_safety", "fail", "broken"),
            CheckResult("goal_alignment", "fail", "no goal"),
        ]
        with patch.object(judge, '_run_all_checks', return_value=checks):
            result = judge.evaluate_all()
        # Guardian has fail_threshold=1, so 1+ fails → DISCARD
        # Architect has fail_threshold=2, so 8 fails → DISCARD
        # Pragmatist has fail_threshold=2, so 8 fails → DISCARD
        assert result["consensus"] == "DISCARD"

    def test_profile_scores_in_result(self, tmp_path):
        """Each profile should have a score in the result."""
        judge = _make_judge_with_tmpdir(tmp_path)
        checks = [
            CheckResult("commit_exists", "pass", "ok"),
            CheckResult("file_consistency", "pass", "ok"),
            CheckResult("syntax_check", "pass", "ok"),
            CheckResult("diff_size", "pass", "ok"),
            CheckResult("report_quality", "pass", "ok"),
            CheckResult("code_quality", "pass", "ok"),
            CheckResult("test_safety", "pass", "ok"),
            CheckResult("goal_alignment", "pass", "ok"),
        ]
        with patch.object(judge, '_run_all_checks', return_value=checks):
            result = judge.evaluate_all()
        for profile_name in ["guardian", "architect", "pragmatist"]:
            assert "score" in result["profiles"][profile_name]
            assert "recommendation" in result["profiles"][profile_name]
            assert 0 <= result["profiles"][profile_name]["score"] <= 1


# ---------------------------------------------------------------------------
# 4. _compute_verdict tests
# ---------------------------------------------------------------------------

class TestComputeVerdict:

    def test_all_pass_gives_keep(self, tmp_path):
        """All checks pass → KEEP recommendation."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profile = JUDGE_PROFILES["architect"]
        checks = [
            CheckResult("commit_exists", "pass", "ok"),
            CheckResult("syntax_check", "pass", "ok"),
        ]
        verdict = judge._compute_verdict(checks, profile)
        assert verdict["recommendation"] == "KEEP"

    def test_guardian_single_fail_gives_discard(self, tmp_path):
        """Guardian: 1 fail → DISCARD (fail_threshold=1)."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profile = JUDGE_PROFILES["guardian"]
        checks = [
            CheckResult("commit_exists", "pass", "ok"),
            CheckResult("syntax_check", "fail", "errors found"),
        ]
        verdict = judge._compute_verdict(checks, profile)
        assert verdict["recommendation"] == "DISCARD"

    def test_architect_single_fail_gives_review(self, tmp_path):
        """Architect: 1 fail → REVIEW (fail_threshold=2)."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profile = JUDGE_PROFILES["architect"]
        checks = [
            CheckResult("commit_exists", "pass", "ok"),
            CheckResult("syntax_check", "fail", "errors"),
            CheckResult("diff_size", "pass", "ok"),
        ]
        verdict = judge._compute_verdict(checks, profile)
        assert verdict["recommendation"] == "REVIEW"

    def test_weighted_scoring_applied(self, tmp_path):
        """Profile weights should affect the score."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profile = JUDGE_PROFILES["guardian"]
        # Guardian weights test_safety=2.5, report_quality=0.5
        checks = [
            CheckResult("test_safety", "fail", "broken"),
            CheckResult("report_quality", "pass", "ok"),
        ]
        verdict = judge._compute_verdict(checks, profile)
        # test_safety fail (0.0 * 2.5 = 0) + report_quality pass (1.0 * 0.5 = 0.5)
        # total_weight = 3.0, score = 0.5/3.0 ≈ 0.167
        # After score_adjust (-0.03): ≈ 0.137
        assert verdict["score"] < 0.2


# ---------------------------------------------------------------------------
# 5. run_parallel_judges consensus logic (agents/parallel.py)
# ---------------------------------------------------------------------------

class TestParallelJudgesConsensus:
    """Test the consensus computation logic from agents/parallel.py.

    We test the pure logic by simulating the verdict dict that
    run_parallel_judges would build after parsing agent outputs.
    This avoids needing actual LLM agents.
    """

    @staticmethod
    def _compute_consensus(verdicts: dict) -> str:
        """Replicate the consensus logic from parallel.py lines 1426-1468."""
        keep_count = sum(1 for v in verdicts.values() if v.get("verdict") == "KEEP")
        rework_count = sum(1 for v in verdicts.values() if v.get("verdict") == "REWORK")
        discard_count = sum(1 for v in verdicts.values() if v.get("verdict") == "DISCARD")

        if keep_count >= 2:
            return "KEEP"
        elif rework_count >= 2:
            return "REWORK"
        elif discard_count == len(verdicts):
            return "DISCARD"
        elif keep_count > 0 or rework_count > 0:
            # Would trigger chief judge — in this context we return CHIEF_NEEDED
            return "CHIEF_NEEDED"
        else:
            return "DISCARD"

    def test_majority_keep(self):
        verdicts = {
            "judge-guardian": {"verdict": "KEEP", "score": 0.8},
            "judge-architect": {"verdict": "KEEP", "score": 0.75},
            "judge-pragmatist": {"verdict": "DISCARD", "score": 0.3},
        }
        assert self._compute_consensus(verdicts) == "KEEP"

    def test_majority_discard(self):
        verdicts = {
            "judge-guardian": {"verdict": "DISCARD", "score": 0.2},
            "judge-architect": {"verdict": "DISCARD", "score": 0.25},
            "judge-pragmatist": {"verdict": "KEEP", "score": 0.8},
        }
        # 2 DISCARD + 1 KEEP is not unanimous discard and has keep_count > 0
        # → chief judge needed
        assert self._compute_consensus(verdicts) == "CHIEF_NEEDED"

    def test_majority_rework(self):
        verdicts = {
            "judge-guardian": {"verdict": "REWORK", "score": 0.6},
            "judge-architect": {"verdict": "REWORK", "score": 0.55},
            "judge-pragmatist": {"verdict": "KEEP", "score": 0.9},
        }
        assert self._compute_consensus(verdicts) == "REWORK"

    def test_unanimous_discard(self):
        verdicts = {
            "judge-guardian": {"verdict": "DISCARD", "score": 0.1},
            "judge-architect": {"verdict": "DISCARD", "score": 0.15},
            "judge-pragmatist": {"verdict": "DISCARD", "score": 0.2},
        }
        assert self._compute_consensus(verdicts) == "DISCARD"

    def test_split_triggers_chief(self):
        """1 KEEP + 1 DISCARD + 1 REWORK → chief judge needed."""
        verdicts = {
            "judge-guardian": {"verdict": "KEEP", "score": 0.8},
            "judge-architect": {"verdict": "DISCARD", "score": 0.3},
            "judge-pragmatist": {"verdict": "REWORK", "score": 0.6},
        }
        assert self._compute_consensus(verdicts) == "CHIEF_NEEDED"

    def test_2_discard_1_keep_triggers_chief(self):
        """2 DISCARD + 1 KEEP → not unanimous discard, has keep > 0 → chief."""
        verdicts = {
            "judge-guardian": {"verdict": "DISCARD", "score": 0.2},
            "judge-architect": {"verdict": "DISCARD", "score": 0.25},
            "judge-pragmatist": {"verdict": "KEEP", "score": 0.8},
        }
        # discard_count (2) != len(verdicts) (3), keep_count (1) > 0
        # keep_count (1) < 2, so no majority KEEP
        # discard_count != len → not unanimous DISCARD
        # keep > 0 → CHIEF_NEEDED
        assert self._compute_consensus(verdicts) == "CHIEF_NEEDED"

    def test_all_rework(self):
        verdicts = {
            "judge-guardian": {"verdict": "REWORK", "score": 0.6},
            "judge-architect": {"verdict": "REWORK", "score": 0.55},
            "judge-pragmatist": {"verdict": "REWORK", "score": 0.5},
        }
        assert self._compute_consensus(verdicts) == "REWORK"


# ---------------------------------------------------------------------------
# 6. Rationale and output structure tests
# ---------------------------------------------------------------------------

class TestConflictResolutionOutput:

    def test_result_has_required_keys(self, tmp_path):
        """Conflict resolution result must have all expected keys."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
            "architect": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
            "pragmatist": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
        }
        result = judge._resolve_conflict(profiles)
        assert "resolved" in result
        assert "resolution_method" in result
        assert "conflicts" in result
        assert "conflict_count" in result
        assert "agent_agreement" in result
        assert "rationale" in result

    def test_rationale_mentions_profiles(self, tmp_path):
        """Rationale should mention all three profile names."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
            "architect": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
            "pragmatist": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
        }
        result = judge._resolve_conflict(profiles)
        assert "guardian" in result["rationale"]
        assert "architect" in result["rationale"]
        assert "pragmatist" in result["rationale"]
        assert result["resolution_method"] in result["rationale"]

    def test_resolved_value_is_valid(self, tmp_path):
        """Resolved must be KEEP, DISCARD, or REVIEW."""
        judge = _make_judge_with_tmpdir(tmp_path)
        profiles = {
            "guardian": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
            "architect": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
            "pragmatist": _make_profile_verdict("REVIEW", 0.5, _make_checks()),
        }
        result = judge._resolve_conflict(profiles)
        assert result["resolved"] in ("KEEP", "DISCARD", "REVIEW")
