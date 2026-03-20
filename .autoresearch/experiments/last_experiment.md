# Last Experiment Summary

**Experiment #165** — Judge verdict history analytics with self-adjustment
**Date:** 2026-03-20 19:31:47

## What Was Done

N/A

## Files Modified

- Target:** `utils/judge.py`, `ui/server.py`, `ui/static/templates/lab-dashboard.js`, `ui/static/js/app.js`, `ui/static/js/modules/lab.js`
- `utils/judge.py` — добавлен `JudgeHistory` класс (~160 строк): load, get_analytics, _compute_weight_adjustments
- `ui/server.py` — endpoint `GET /api/judge/history`
- `ui/static/js/modules/lab.js` — метод `loadJudgeHistory()`
- `ui/static/js/app.js` — свойство `judgeAnalytics`, вызов при init и навигации на dashboard
- `ui/static/templates/lab-dashboard.js` — панель JUDGE_ANALYTICS с consensus distribution, profile agreement, self-adjust suggestions, score trend

## Key Results

Results

**What was done:**
1. **JudgeHistory** — загружает все `judge_*_all.json`, вычисляет: consensus distribution, score trend, per-profile accuracy (насколько профиль согласуется с консенсусом), check reliability (pass/warn/fail rates + discriminative score через entropy), weight adjustment suggestions
2. **Self-adjustment logic** — если check всегда pass (>95%) → reduce weight; если discriminative >0.7 → increase weight; если fail rate >50% → lower threshold; если discriminative <0.3 → red

## For Next Iteration

N/A
