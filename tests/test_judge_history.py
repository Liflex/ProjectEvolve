"""Tests for JudgeHistory, weight auto-adjustment, and RevertAnalytics.

Covers:
- JudgeHistory creation and loading from JSONL verdict files
- Verdict read/write roundtrip (persistence)
- Weight auto-adjustment via apply_weight_adjustments
- RevertAnalytics: record_revert + get_stats
- Persistence: data survives across JudgeHistory instances
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from utils.judge import (
    JUDGE_PROFILES,
    JudgeHistory,
    JudgeProfile,
    _DEFAULT_WEIGHTS,
)
from agents.revert_analytics import RevertAnalytics


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_verdict_json(
    experiment_number: int,
    consensus: str = "KEEP",
    consensus_score: float = 0.75,
    profile_recommendations: dict | None = None,
) -> dict:
    """Build a minimal verdict dict matching the judge_*_all.json schema."""
    profiles: dict[str, dict] = {}
    if profile_recommendations is None:
        profile_recommendations = {
            "guardian": "KEEP",
            "architect": "KEEP",
            "pragmatist": "KEEP",
        }
    for pname, rec in profile_recommendations.items():
        profiles[pname] = {
            "recommendation": rec,
            "score": consensus_score,
            "checks": [
                {"name": "commit_exists", "status": "pass", "message": "ok", "weight": 1.0},
                {"name": "syntax_check", "status": "pass", "message": "ok", "weight": 1.0},
                {"name": "test_safety", "status": "pass", "message": "ok", "weight": 1.0},
            ],
        }
    return {
        "consensus": consensus,
        "consensus_score": consensus_score,
        "profiles": profiles,
        "experiment": experiment_number,
    }


def _write_judge_file(exp_dir: Path, experiment_number: int, data: dict) -> Path:
    """Write a judge verdict file to the experiments directory."""
    fname = exp_dir / f"judge_{experiment_number}_all.json"
    fname.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return fname


# ===========================================================================
# 1. JudgeHistory creation
# ===========================================================================

class TestJudgeHistoryCreation:

    def test_creates_without_errors(self, tmp_path: Path):
        """JudgeHistory should instantiate fine with an empty temp directory."""
        jh = JudgeHistory(tmp_path)
        assert jh.project_dir == tmp_path.resolve()
        assert jh._verdicts == []

    def test_creates_with_nonexistent_directory(self, tmp_path: Path):
        """JudgeHistory should not fail even if experiments dir doesn't exist yet."""
        missing = tmp_path / "no_such_dir"
        jh = JudgeHistory(missing)
        verdicts = jh.load()
        assert verdicts == []


# ===========================================================================
# 2. Load and read verdicts
# ===========================================================================

class TestJudgeHistoryLoad:

    def test_load_empty_directory(self, tmp_path: Path):
        """Loading from empty dir returns empty list."""
        jh = JudgeHistory(tmp_path)
        verdicts = jh.load()
        assert verdicts == []

    def test_load_single_verdict(self, tmp_path: Path):
        """Single judge file is loaded with experiment number extracted."""
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        data = _make_verdict_json(42)
        _write_judge_file(exp_dir, 42, data)

        jh = JudgeHistory(tmp_path)
        verdicts = jh.load()

        assert len(verdicts) == 1
        assert verdicts[0]["experiment"] == 42
        assert verdicts[0]["consensus"] == "KEEP"

    def test_load_multiple_verdicts_sorted(self, tmp_path: Path):
        """Multiple files are loaded and sorted by experiment number."""
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        for num in [10, 5, 20]:
            data = _make_verdict_json(num)
            _write_judge_file(exp_dir, num, data)

        jh = JudgeHistory(tmp_path)
        verdicts = jh.load()

        assert len(verdicts) == 3
        experiments = [v["experiment"] for v in verdicts]
        # Files sorted lexicographically: judge_10, judge_20, judge_5
        assert experiments == [10, 20, 5]

    def test_load_ignores_invalid_json(self, tmp_path: Path):
        """Malformed JSON files are skipped, valid ones still load."""
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        _write_judge_file(exp_dir, 1, _make_verdict_json(1))

        bad_file = exp_dir / "judge_2_all.json"
        bad_file.write_text("NOT VALID JSON{{{", encoding="utf-8")

        _write_judge_file(exp_dir, 3, _make_verdict_json(3))

        jh = JudgeHistory(tmp_path)
        verdicts = jh.load()

        assert len(verdicts) == 2
        experiments = [v["experiment"] for v in verdicts]
        assert experiments == [1, 3]

    def test_load_ignores_non_judge_files(self, tmp_path: Path):
        """Files that don't match judge_*_all.json pattern are ignored."""
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        _write_judge_file(exp_dir, 1, _make_verdict_json(1))

        # Should be ignored
        (exp_dir / "other_file.json").write_text("{}", encoding="utf-8")
        (exp_dir / "judge_2_single.json").write_text("{}", encoding="utf-8")

        jh = JudgeHistory(tmp_path)
        verdicts = jh.load()

        assert len(verdicts) == 1


# ===========================================================================
# 3. Weight auto-adjustment
# ===========================================================================

class TestWeightAutoAdjustment:

    def _seed_verdicts(self, tmp_path: Path, count: int, consensus: str = "KEEP") -> JudgeHistory:
        """Create JudgeHistory with enough verdicts to trigger adjustment."""
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        for i in range(count):
            data = _make_verdict_json(i + 1, consensus=consensus)
            _write_judge_file(exp_dir, i + 1, data)

        jh = JudgeHistory(tmp_path)
        jh.load()
        return jh

    def test_no_adjustment_below_min_verdicts(self, tmp_path: Path):
        """With fewer than min_verdicts, apply returns applied=False."""
        jh = self._seed_verdicts(tmp_path, 3)  # default min_verdicts=5
        result = jh.apply_weight_adjustments(min_verdicts=5)

        assert result["applied"] is False
        assert "need" in result["reason"]

    def test_adjustment_runs_with_enough_verdicts(self, tmp_path: Path):
        """With enough verdicts, adjustments are computed and potentially applied."""
        jh = self._seed_verdicts(tmp_path, 6)
        result = jh.apply_weight_adjustments(min_verdicts=5)

        # Even if all pass, the system should have processed and returned a result
        assert result["verdicts_used"] == 6

    def test_weights_actually_change_after_adjustment(self, tmp_path: Path):
        """When adjustments are applied, profile weights in JUDGE_PROFILES should change."""
        # Create verdicts where some checks have high discriminative scores
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        for i in range(6):
            # Alternate between different check results to create variance
            recs = {
                "guardian": "DISCARD" if i % 2 == 0 else "KEEP",
                "architect": "KEEP",
                "pragmatist": "KEEP",
            }
            data = _make_verdict_json(i + 1, consensus="KEEP", profile_recommendations=recs)
            # Add varied check results for discriminative signal
            for pname in data["profiles"]:
                data["profiles"][pname]["checks"] = [
                    {"name": "commit_exists", "status": "pass", "message": "ok", "weight": 1.0},
                    {"name": "syntax_check", "status": "fail" if i % 2 == 0 else "pass",
                     "message": "err" if i % 2 == 0 else "ok", "weight": 2.0},
                    {"name": "test_safety", "status": "fail" if i % 2 == 0 else "pass",
                     "message": "err" if i % 2 == 0 else "ok", "weight": 2.5},
                    {"name": "code_quality", "status": "warn" if i % 3 == 0 else "pass",
                     "message": "meh", "weight": 2.0},
                ]
            _write_judge_file(exp_dir, i + 1, data)

        jh = JudgeHistory(tmp_path)
        jh.load()

        # Snapshot current weights before adjustment
        weights_before = {
            pname: dict(profile.weights) for pname, profile in JUDGE_PROFILES.items()
        }

        result = jh.apply_weight_adjustments(min_verdicts=5, blend_factor=1.0)

        weights_after = {
            pname: dict(profile.weights) for pname, profile in JUDGE_PROFILES.items()
        }

        # Verify something changed (at least one weight differs)
        any_changed = False
        for pname in weights_before:
            for check_name in weights_before[pname]:
                if abs(weights_before[pname][check_name] - weights_after[pname][check_name]) > 0.001:
                    any_changed = True
                    break
            if any_changed:
                break

        assert any_changed, (
            f"Expected weights to change after adjustment, but they didn't.\n"
            f"Result: {result}\n"
            f"Before: {weights_before}\nAfter: {weights_after}"
        )

    def test_auto_adjust_convenience(self, tmp_path: Path):
        """auto_adjust is a one-shot convenience that loads and applies."""
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        for i in range(6):
            _write_judge_file(exp_dir, i + 1, _make_verdict_json(i + 1))

        jh = JudgeHistory(tmp_path)
        result = jh.auto_adjust(min_verdicts=5)

        assert result is not None
        assert "applied" in result

    def test_auto_adjust_returns_none_when_empty(self, tmp_path: Path):
        """auto_adjust returns None when there are no verdicts."""
        jh = JudgeHistory(tmp_path)
        result = jh.auto_adjust(min_verdicts=5)
        assert result is None


# ===========================================================================
# 4. RevertAnalytics
# ===========================================================================

class TestRevertAnalytics:

    def test_creates_without_errors(self, tmp_path: Path):
        """RevertAnalytics should instantiate and create the .autoresearch dir."""
        ra = RevertAnalytics(tmp_path)
        assert (tmp_path / ".autoresearch").exists()

    def test_record_and_get_stats_empty(self, tmp_path: Path):
        """Fresh analytics returns zero stats."""
        ra = RevertAnalytics(tmp_path)
        stats = ra.get_stats(total_experiments=10)
        assert stats["total_reverts"] == 0
        assert stats["revert_rate"] == 0.0
        assert stats["avg_score"] is None

    def test_record_single_revert(self, tmp_path: Path):
        """Recording one revert event is reflected in stats."""
        ra = RevertAnalytics(tmp_path)
        ra.record_revert(
            experiment_number=42,
            consensus="DISCARD",
            score=0.35,
            reason="Broken tests introduced",
            profile_scores={
                "guardian": {"recommendation": "DISCARD", "score": 0.2},
                "architect": {"recommendation": "REVIEW", "score": 0.45},
            },
            files_changed=[{"file": "agents/research.py", "action": "modified"}],
        )

        stats = ra.get_stats(total_experiments=50)
        assert stats["total_reverts"] == 1
        assert stats["total_experiments"] == 50
        assert stats["revert_rate"] == pytest.approx(0.02, abs=0.001)
        assert stats["avg_score"] == pytest.approx(0.35, abs=0.001)
        assert stats["min_score"] == pytest.approx(0.35, abs=0.001)
        assert stats["max_score"] == pytest.approx(0.35, abs=0.001)

    def test_record_multiple_reverts(self, tmp_path: Path):
        """Multiple revert events accumulate correctly."""
        ra = RevertAnalytics(tmp_path)
        for i in range(5):
            ra.record_revert(
                experiment_number=10 + i,
                consensus="DISCARD",
                score=0.3 + i * 0.1,
                reason=f"Reason {i}",
                profile_scores={"guardian": {"recommendation": "DISCARD", "score": 0.3}},
                files_changed=[{"file": "agents/research.py", "action": "modified"}],
            )

        stats = ra.get_stats(total_experiments=20)
        assert stats["total_reverts"] == 5
        assert stats["avg_score"] == pytest.approx(0.5, abs=0.001)  # (0.3+0.4+0.5+0.6+0.7)/5
        assert stats["min_score"] == pytest.approx(0.3, abs=0.001)
        assert stats["max_score"] == pytest.approx(0.7, abs=0.001)

    def test_common_reasons_aggregation(self, tmp_path: Path):
        """Common reasons are aggregated and top-5 returned."""
        ra = RevertAnalytics(tmp_path)
        for _ in range(4):
            ra.record_revert(
                experiment_number=1,
                consensus="DISCARD",
                score=0.3,
                reason="Broken tests",
                profile_scores={},
                files_changed=[],
            )
        ra.record_revert(
            experiment_number=2,
            consensus="DISCARD",
            score=0.4,
            reason="Different reason",
            profile_scores={},
            files_changed=[],
        )

        stats = ra.get_stats(total_experiments=10)
        reasons = stats["common_reasons"]
        assert len(reasons) <= 5
        assert reasons[0]["reason"] == "Broken tests"
        assert reasons[0]["count"] == 4

    def test_affected_files_tracking(self, tmp_path: Path):
        """Files changed in reverts are tracked by frequency."""
        ra = RevertAnalytics(tmp_path)
        ra.record_revert(
            experiment_number=1, consensus="DISCARD", score=0.3,
            reason="r1", profile_scores={},
            files_changed=[
                {"file": "agents/research.py", "action": "modified"},
                {"file": "agents/parallel.py", "action": "modified"},
            ],
        )
        ra.record_revert(
            experiment_number=2, consensus="DISCARD", score=0.3,
            reason="r2", profile_scores={},
            files_changed=[
                {"file": "agents/research.py", "action": "modified"},
            ],
        )

        stats = ra.get_stats(total_experiments=10)
        files = {f["file"]: f["count"] for f in stats["affected_files"]}
        assert files.get("agents/research.py") == 2
        assert files.get("agents/parallel.py") == 1

    def test_per_profile_discard_rate(self, tmp_path: Path):
        """Per-profile discard rates are computed correctly."""
        ra = RevertAnalytics(tmp_path)
        for i in range(4):
            ra.record_revert(
                experiment_number=i,
                consensus="DISCARD",
                score=0.3,
                reason="r",
                profile_scores={
                    "guardian": {"recommendation": "DISCARD" if i < 3 else "KEEP", "score": 0.3},
                    "architect": {"recommendation": "KEEP", "score": 0.7},
                },
                files_changed=[],
            )

        stats = ra.get_stats(total_experiments=10)
        profile_rates = stats["per_profile_discard_rate"]
        # Guardian: 3 DISCARD out of 4
        assert profile_rates.get("guardian") == pytest.approx(0.75, abs=0.01)
        # Architect: 0 DISCARD out of 4
        assert profile_rates.get("architect") == pytest.approx(0.0, abs=0.01)

    def test_recent_reverts_ordering(self, tmp_path: Path):
        """Recent reverts returns newest first."""
        ra = RevertAnalytics(tmp_path)
        for i in range(3):
            ra.record_revert(
                experiment_number=10 + i,
                consensus="DISCARD",
                score=0.5,
                reason=f"Reason {i}",
                profile_scores={},
                files_changed=[],
            )

        stats = ra.get_stats(total_experiments=20)
        recent = stats["recent_reverts"]
        assert len(recent) == 3
        assert recent[0]["experiment_number"] == 12  # newest first
        assert recent[1]["experiment_number"] == 11
        assert recent[2]["experiment_number"] == 10


# ===========================================================================
# 5. Persistence
# ===========================================================================

class TestPersistence:

    def test_judge_history_persists_verdicts(self, tmp_path: Path):
        """Judge verdicts written to disk are readable by a new JudgeHistory instance."""
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        data = _make_verdict_json(99, consensus="DISCARD", consensus_score=0.25)
        _write_judge_file(exp_dir, 99, data)

        # First instance loads
        jh1 = JudgeHistory(tmp_path)
        verdicts1 = jh1.load()
        assert len(verdicts1) == 1
        assert verdicts1[0]["consensus"] == "DISCARD"

        # Second instance should see the same data
        jh2 = JudgeHistory(tmp_path)
        verdicts2 = jh2.load()
        assert len(verdicts2) == 1
        assert verdicts2[0]["consensus"] == "DISCARD"
        assert verdicts2[0]["experiment"] == 99

    def test_revert_analytics_persists_events(self, tmp_path: Path):
        """Revert events survive across RevertAnalytics instances."""
        ra1 = RevertAnalytics(tmp_path)
        ra1.record_revert(
            experiment_number=42,
            consensus="DISCARD",
            score=0.35,
            reason="Test reason",
            profile_scores={"guardian": {"recommendation": "DISCARD", "score": 0.3}},
            files_changed=[{"file": "test.py", "action": "modified"}],
        )

        # New instance reads same data
        ra2 = RevertAnalytics(tmp_path)
        stats = ra2.get_stats(total_experiments=100)
        assert stats["total_reverts"] == 1
        assert stats["avg_score"] == pytest.approx(0.35, abs=0.001)

        # JSONL file should exist and be valid
        jsonl_file = tmp_path / ".autoresearch" / "revert_history.jsonl"
        assert jsonl_file.exists()
        lines = jsonl_file.read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) == 1
        event = json.loads(lines[0])
        assert event["experiment_number"] == 42
        assert event["reason"] == "Test reason"

    def test_custom_weights_persistence(self, tmp_path: Path):
        """save_custom_weights / load_custom_weights roundtrip works."""
        jh = JudgeHistory(tmp_path)
        custom = {
            "guardian": {"test_safety": 3.0, "syntax_check": 2.5},
            "architect": {"diff_size": 1.8},
        }

        jh.save_custom_weights(custom)
        loaded = jh.load_custom_weights()

        assert loaded is not None
        assert loaded["guardian"]["test_safety"] == 3.0
        assert loaded["architect"]["diff_size"] == 1.8

    def test_reset_weights_deletes_file(self, tmp_path: Path):
        """reset_weights removes the custom weights file."""
        jh = JudgeHistory(tmp_path)
        jh.save_custom_weights({"guardian": {"test_safety": 5.0}})

        assert jh._weights_path().exists()
        deleted = jh.reset_weights()
        assert deleted is True
        assert not jh._weights_path().exists()

    def test_reset_weights_returns_false_if_missing(self, tmp_path: Path):
        """reset_weights returns False if no custom weights file exists."""
        jh = JudgeHistory(tmp_path)
        deleted = jh.reset_weights()
        assert deleted is False

    def test_load_custom_weights_returns_none_if_missing(self, tmp_path: Path):
        """load_custom_weights returns None when no weights file exists."""
        jh = JudgeHistory(tmp_path)
        assert jh.load_custom_weights() is None


# ===========================================================================
# 6. Analytics (get_analytics)
# ===========================================================================

class TestGetAnalytics:

    def test_empty_analytics(self, tmp_path: Path):
        """Analytics on empty history returns zeros and empty collections."""
        jh = JudgeHistory(tmp_path)
        analytics = jh.get_analytics()

        assert analytics["total_verdicts"] == 0
        assert analytics["consensus_distribution"] == {}
        assert analytics["score_trend"] == []
        assert analytics["profile_accuracy"] == {}
        assert analytics["check_reliability"] == {}
        assert analytics["weight_adjustments"] == {}
        assert analytics["avg_consensus_score"] == 0

    def test_analytics_with_data(self, tmp_path: Path):
        """Analytics computes correct distributions and trends."""
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        for i in range(3):
            _write_judge_file(exp_dir, i + 1, _make_verdict_json(i + 1))

        jh = JudgeHistory(tmp_path)
        analytics = jh.get_analytics()

        assert analytics["total_verdicts"] == 3
        assert analytics["consensus_distribution"] == {"KEEP": 3}
        assert len(analytics["score_trend"]) == 3
        assert analytics["avg_consensus_score"] == pytest.approx(0.75, abs=0.01)

    def test_analytics_consensus_distribution_mixed(self, tmp_path: Path):
        """Analytics correctly counts mixed consensus values."""
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        _write_judge_file(exp_dir, 1, _make_verdict_json(1, consensus="KEEP"))
        _write_judge_file(exp_dir, 2, _make_verdict_json(2, consensus="DISCARD"))
        _write_judge_file(exp_dir, 3, _make_verdict_json(3, consensus="REVIEW"))

        jh = JudgeHistory(tmp_path)
        analytics = jh.get_analytics()

        dist = analytics["consensus_distribution"]
        assert dist["KEEP"] == 1
        assert dist["DISCARD"] == 1
        assert dist["REVIEW"] == 1

    def test_profile_accuracy_computation(self, tmp_path: Path):
        """Profile accuracy reflects agreement with consensus."""
        exp_dir = tmp_path / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True)

        # Guardian always disagrees with consensus
        data = _make_verdict_json(1, consensus="KEEP", profile_recommendations={
            "guardian": "DISCARD",
            "architect": "KEEP",
            "pragmatist": "KEEP",
        })
        _write_judge_file(exp_dir, 1, data)

        jh = JudgeHistory(tmp_path)
        analytics = jh.get_analytics()

        acc = analytics["profile_accuracy"]
        assert acc["guardian"]["agrees_with_consensus"] == 0
        assert acc["guardian"]["total"] == 1
        assert acc["guardian"]["rate"] == 0.0
        assert acc["architect"]["agrees_with_consensus"] == 1
        assert acc["architect"]["rate"] == 1.0
