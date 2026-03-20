# Last Experiment Summary

**Experiment #141** — Post-experiment auto-judge — basic sanity checker
**Date:** 2026-03-20

## What Was Done

1. **`utils/judge.py`** — ExperimentJudge module with 4 checks: commit_exists, file_consistency, syntax_check, diff_size. Produces verdict with score (0-1), recommendation (KEEP/DISCARD/REVIEW), and per-check details.
2. **Server integration** — judge auto-runs after each experiment save in `_save_experiment_artifacts()`. Verdict stored in experiment data.
3. **API endpoint** — `GET /api/judge/{n}` for manual judge trigger on any experiment.
4. **UI** — "RUN JUDGE" button in experiment summary tab. Shows verdict with recommendation badge, score, and check results.

## Files Modified

- `utils/judge.py` (new)
- `ui/server.py`
- `ui/static/js/app.js`
- `ui/static/js/modules/lab.js`
- `ui/static/templates/lab-experiments.js`

## Key Results

First step towards judgement system goal. Judge validates agent's work independently by checking git state. Score 0.88 on current project (KEEP recommendation with minor warnings).

## For Next Iteration

- Add more checks (test runner, import validation)
- Show judge verdict badge in experiments list (not just detail)
- Auto-judge on experiment end with live log event
