"""Revert analytics — accumulate and analyze auto-revert events.

Records each auto-revert as a single JSON line in ``.autoresearch/revert_history.jsonl``
and provides statistical summaries for the dashboard.

Usage::

    from agents.revert_analytics import RevertAnalytics

    ra = RevertAnalytics(project_dir)
    ra.record_revert(experiment_number=172, consensus="DISCARD", score=0.4, ...)
    stats = ra.get_stats(total_experiments=203)
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_HISTORY_FILE = "revert_history.jsonl"
_LEGACY_FILE = "auto_revert_events.json"


class RevertAnalytics:
    """Append-only JSONL store for auto-revert events with query API."""

    def __init__(self, project_dir: Path) -> None:
        self._dir = project_dir / ".autoresearch"
        self._dir.mkdir(parents=True, exist_ok=True)
        self._history = self._dir / _HISTORY_FILE
        self._legacy = self._dir / _LEGACY_FILE
        self._migrated = False

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def record_revert(
        self,
        experiment_number: int,
        consensus: str,
        score: float,
        reason: str,
        profile_scores: Dict[str, Any],
        files_changed: List[Dict[str, str]],
        conflict_reason: str = "",
    ) -> None:
        """Append a revert event as a single JSON line."""
        self._ensure_migrated()

        event: Dict[str, Any] = {
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
            with open(self._history, "a", encoding="utf-8") as f:
                f.write(json.dumps(event, ensure_ascii=False) + "\n")
            logger.info("Recorded revert event for exp %d", experiment_number)
        except OSError as exc:
            logger.warning("Failed to record revert event for exp %d: %s", experiment_number, exc)

    # ------------------------------------------------------------------
    # Read helpers
    # ------------------------------------------------------------------

    def _ensure_migrated(self) -> None:
        """One-time migration from legacy JSON array to JSONL."""
        if self._migrated:
            return
        self._migrated = True

        if not self._legacy.exists() or self._history.exists():
            return

        try:
            legacy_events = json.loads(self._legacy.read_text(encoding="utf-8"))
            if not isinstance(legacy_events, list) or not legacy_events:
                return

            with open(self._history, "a", encoding="utf-8") as f:
                for ev in legacy_events:
                    f.write(json.dumps(ev, ensure_ascii=False) + "\n")

            logger.info("Migrated %d legacy revert events to JSONL", len(legacy_events))
        except Exception as exc:
            logger.warning("Legacy migration failed: %s", exc)

    def _load_events(self) -> List[Dict[str, Any]]:
        """Read all events from the JSONL file."""
        self._ensure_migrated()
        events: List[Dict[str, Any]] = []
        if not self._history.exists():
            return events
        try:
            text = self._history.read_text(encoding="utf-8")
            for line in text.splitlines():
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        except OSError:
            pass
        return events

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def get_stats(self, total_experiments: int = 0) -> Dict[str, Any]:
        """Compute summary statistics from accumulated revert events.

        Parameters
        ----------
        total_experiments:
            Total number of experiments run so far (used for revert_rate).
            If 0, falls back to the highest experiment_number seen + 1.

        Returns dict with:
        - total_reverts, total_experiments, revert_rate
        - avg_score, min_score, max_score
        - success_rate (fraction of post-revert experiments that were NOT reverted)
        - common_reasons (top 5)
        - affected_files (top 20 by frequency)
        - per_profile_discard_rate
        - recent_reverts (last 10, newest first)
        """
        events = self._load_events()

        if not events:
            return {
                "total_reverts": 0,
                "total_experiments": total_experiments or 0,
                "revert_rate": 0.0,
                "success_rate": None,
                "avg_score": None,
                "min_score": None,
                "max_score": None,
                "common_reasons": [],
                "affected_files": [],
                "per_profile_discard_rate": {},
                "recent_reverts": [],
            }

        total_reverts = len(events)
        reverted_numbers = {e.get("experiment_number") for e in events}

        # Use caller-supplied total or infer from data
        if total_experiments <= 0:
            total_experiments = max(max(reverted_numbers), total_reverts)
        revert_rate = round(total_reverts / total_experiments, 4) if total_experiments else 0.0

        # Scores
        scores = [e.get("score", 0) for e in events if e.get("score") is not None]
        avg_score = round(sum(scores) / len(scores), 4) if scores else None

        # Success rate: among experiments that immediately follow a revert,
        # how many were NOT themselves reverted?
        post_revert_success = 0
        post_revert_total = 0
        for exp_num in sorted(reverted_numbers):
            next_num = exp_num + 1
            # Only count if we have evidence that experiment N+1 ran
            # (either it was reverted, or it appears in the experiment range)
            if next_num in reverted_numbers:
                post_revert_total += 1
                # This next experiment was also reverted — NOT a success
            elif next_num <= total_experiments:
                post_revert_total += 1
                post_revert_success += 1
        success_rate = (
            round(post_revert_success / post_revert_total, 4)
            if post_revert_total
            else None
        )

        # Common reasons — normalise by first 80 chars
        reason_counter: Counter = Counter()
        for e in events:
            reason_counter[e.get("reason", "unknown")[:80]] += 1
        common_reasons = [
            {"reason": r, "count": c}
            for r, c in reason_counter.most_common(5)
        ]

        # Affected files
        file_counter: Counter = Counter()
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
        profile_total: Counter = Counter()
        profile_discard: Counter = Counter()
        for e in events:
            for pname, pdata in e.get("profile_scores", {}).items():
                profile_total[pname] += 1
                if pdata.get("recommendation") == "DISCARD":
                    profile_discard[pname] += 1
        per_profile_discard_rate = {
            p: round(profile_discard[p] / profile_total[p], 4) if profile_total[p] else 0.0
            for p in profile_total
        }

        # Recent reverts (last 10, newest first)
        recent_reverts = [
            {
                "experiment_number": e.get("experiment_number"),
                "timestamp": e.get("timestamp"),
                "score": e.get("score"),
                "reason": e.get("reason", "")[:120],
            }
            for e in events[-10:]
        ][::-1]

        return {
            "total_reverts": total_reverts,
            "total_experiments": total_experiments,
            "revert_rate": revert_rate,
            "success_rate": success_rate,
            "avg_score": avg_score,
            "min_score": round(min(scores), 4) if scores else None,
            "max_score": round(max(scores), 4) if scores else None,
            "common_reasons": common_reasons,
            "affected_files": affected_files,
            "per_profile_discard_rate": per_profile_discard_rate,
            "recent_reverts": recent_reverts,
        }
