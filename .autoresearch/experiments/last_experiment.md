# Last Experiment Summary

**Experiment #122** — Cat companion — cursor-tracking eye glints
**Date:** 2026-03-20

## What Was Done

1. **Cursor-tracking eye glints** — white pixel "catchlight" on each eye follows mouse cursor position
2. **Smooth interpolation** — glint moves with 0.12 lerp factor for natural, fluid tracking
3. **Per-expression glint positions** — EYE_GLINT config defines eye centers for neutral, surprised, angry, thinking
4. **Blink/sleep suppression** — glint hidden during blink frames and idle level 2+ (sleep)
5. **No glint on happy/sleepy expressions** — eyes are lines or mostly closed, glint would look wrong
6. **Global mousemove listener** — tracks cursor across entire page, not just canvas
7. **Clean lifecycle** — listener added in start(), removed in stop()

## Files Modified

- `ui/static/modules/cat.js` — _mouseX/_mouseY state, _glintX/_glintY smoothed offset, EYE_GLINT config, render() glint drawing, start/stop lifecycle

## Key Results

**Working:** yes
**Tests:** skipped (UI feature, visual only)

## For Next Iteration

N/A
