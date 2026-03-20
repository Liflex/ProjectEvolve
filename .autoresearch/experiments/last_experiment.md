# Last Experiment Summary

**Experiment #167** — Cat lying down pose — horizontal body, front paws, auto-lie on deep sleep
**Date:** 2026-03-20

## What Was Done

1. **BODY_LYING sprite** — Horizontal body (26x10 pixels) for lying down pose, outline + fill 1bpp encoded.
2. **PAWS_LYING sprite** — Front paws (13x4 pixels) positioned between head and body.
3. **Lying pose positions** — Separate position constants (LIE_HEAD_POS, LIE_BODY_POS, LIE_PAWS_POS, LIE_TAIL_POS).
4. **Pose state** — `_pose` variable ('sitting' | 'lying') controls sprite/position selection.
5. **Render refactor** — render() dynamically selects sprites and positions based on pose. Eye positions computed relative to head base.
6. **Auto-lie on deep sleep** — Cat lies down at idle level 3 (3+ min inactivity).
7. **Auto-stand on interaction** — Click, hover, typing, resetIdle cause cat to stand up.
8. **Speech messages** — New SPEECH.lying_down (6 phrases) and SPEECH.standing_up (6 phrases), all in Russian.
9. **Public API** — CatModule.setPose('sitting'|'lying'), CatModule.getPose().
10. **Tooltip update** — getContextTooltip() shows lying-specific tooltips.

## Files Modified

- `ui/static/modules/cat.js` (+233/-61)

## Key Results

- Cat now lies down when idle for 3+ minutes (deep sleep)
- Standing up on any user interaction (click, hover, typing)
- API available for external pose control
- All speech in Russian

## For Next Iteration

- More animations for lying pose (tail curl, breathing)
- Lying pose could have different ear twitch behavior
