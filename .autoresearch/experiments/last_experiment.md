# Last Experiment Summary

**Experiment #122** — Cat companion — cursor-tracking eye glints
**Date:** 2026-03-20 02:47:54

## What Was Done

N/A

## Files Modified

- `ui/static/modules/cat.js` — cursor tracking state, EYE_GLINT config, render() glint drawing, lifecycle

## Key Results

Results

**What was done:**
1. **Cursor-tracking eye glints** — белый пиксель-"catchlight" на каждом глазу следит за курсором мыши
2. **Smooth interpolation** — glint перемещается с lerp-фактором 0.12 для плавного, естественного отслеживания
3. **Per-expression positions** — EYE_GLINT конфиг с центрами глаз для neutral, surprised, angry, thinking
4. **Blink/sleep suppression** — glint скрыт во время моргания и при idle level 2+ (сон)
5. **No glint на happy/sleepy** — глаза-линии или закрытые, gl

## For Next Iteration

N/A
