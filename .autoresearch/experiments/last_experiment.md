# Last Experiment Summary

**Experiment #172** — Judge conflict resolution & auto-revert on DISCARD
**Date:** 2026-03-20

## What Was Done

- `_resolve_conflict()` в `ExperimentJudge`: анализ разногласий между судьями при SPLIT
- Tiebreaker логика: agent decision → weighted score → balanced authority → conflict severity
- `evaluate_all()` больше не возвращает SPLIT — вместо этого разрешает конфликт через `_resolve_conflict()`
- Auto-revert в research loop: при DISCARD консенсусе с score < 0.4 автоматически `git revert --no-edit`
- API endpoint: `POST /api/judge/revert/{n}` для ручного revert
- UI: панель conflict resolution (diverging checks, resolution method, agent agreement)
- UI: revert badge (↩), кнопка [REVERT] для DISCARD вердиктов
- Live log: отображение auto-revert событий

## Files Modified

- `utils/judge.py` — `_resolve_conflict()`, обновлённый `evaluate_all()`
- `agents/research.py` — `_auto_revert_discard()`, обновлённый `_run_judge()`
- `agents/parallel.py` — улучшенный consensus logic с score tiebreaker
- `ui/server.py` — `/api/judge/revert/{n}` endpoint
- `ui/static/js/modules/lab.js` — `revertExperiment()`, live log revert display
- `ui/static/templates/lab-experiments.js` — conflict resolution panel, revert UI

## Key Results

- Конфликты между судьями теперь автоматически разрешаются вместо возврата SPLIT
- Auto-revert защищает от накопления плохих изменений (score < 0.4)
- Ручной revert доступен через UI для любого DISCARD вердикта

## For Next Iteration

- Накопление данных для анализа эффективности auto-revert
- Мультиагентность: этап 3 — task decomposition
