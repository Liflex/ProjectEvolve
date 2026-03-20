# Last Experiment Summary

**Experiment #155** — Judge profiles — multiple evaluation perspectives (strict/balanced/lenient)
**Date:** 2026-03-20 17:58:43

## What Was Done

N/A

## Files Modified

- `utils/judge.py` — `JudgeProfile` dataclass, `JUDGE_PROFILES` dict (3 профиля), `evaluate_all()`, поддержка `profile=` параметра
- `ui/server.py` — `/api/judge/{n}/all` endpoint, `profile` query param, авто all-judges после каждого эксперимента
- `ui/static/js/modules/lab.js` — `judgeExperiment(n, profile)`, `judgeExperimentAll(n)`
- `ui/static/js/app.js` — `judgeAllVerdicts`, `judgeProfileView` state
- `ui/static/templates/lab-experiments.js` — ALL JUDGES button, consensus bar, profile cards с expand

## Key Results

Results

**What was done:**
1. 3 judge-профиля с разными фокусами: **STRICT** (код-качество, минимальность), **BALANCED** (равные веса), **LENIENT** (функциональность, толерантность)
2. Каждый профиль имеет свои веса проверок, пороги fail/warn и корректировку финального score
3. `evaluate_all()` запускает все профили, вычисляет consensus (majority vote) и средний score
4. Новый API endpoint `/api/judge/{n}/all` + параметр `profile` для `/api/judge/{n}`
5. UI: кнопка `[ALL JUDGES]` показывает con

## For Next Iteration

N/A
