# Last Experiment Summary

**Experiment #168** — Judge weight auto-adjustment from verdict history
**Date:** 2026-03-20 19:53:42

## What Was Done

N/A

## Files Modified

- None

## Key Results

Results

**What was done:**
1. **Weight persistence** — `save_custom_weights()` / `load_custom_weights()` сохраняют кастомные веса в `.autoresearch/judge_weights.json`
2. **Auto-apply logic** — `apply_weight_adjustments()` вычисляет корректировки из check reliability (discriminative score, pass/fail rates) и применяет с blend factor 0.3, зажатый в [0.2, 3.0]. Запускается после 5+ вердиктов
3. **ExperimentJudge загружает кастомные веса** — `_load_custom_weights()` в `__init__` применяет сохранённ

## For Next Iteration

N/A
