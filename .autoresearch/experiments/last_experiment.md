# Last Experiment Summary

**Experiment #176** — Cat breathing + sneeze animations
**Date:** 2026-03-20

## What Was Done

1. **Breathing animation** — continuous subtle body Y oscillation (±0.3px, sine wave). Always active in sitting pose. Slower amplitude and period when sleeping/idle (±0.4px, 40-tick period vs 25-tick). Makes cat feel alive even during idle.
2. **Sneeze animation** — rare random event (~0.1% per tick, ≈every 2min idle). 3-phase: pre-sneeze pull-back → sneeze jerk (head snaps forward+down) → recovery shake. Expression → surprised, speech "Апчхи!" with 5 Russian variants, ear twitch, small particle burst from nose area.
3. Public API: `triggerSneeze()` method.

## Files Modified

- `ui/static/modules/cat.js` — breathing in render(), sneeze state/logic/tick, SPEECH.sneeze, triggerSneeze(), public API

## Key Results

**Working:** yes (syntax check + server import pass)
**Tests:** syntax only (UI animation — no unit tests needed)
