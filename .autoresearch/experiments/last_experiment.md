# Last Experiment Summary

**Experiment #215** — Judge system redesign: specialist profiles with research-backed skills
**Date:** 2026-03-21

## What Was Done

1. Replaced 3 generic profiles (strict/balanced/lenient) with 3 specialist roles based on research:
   - **Guardian** (Security & Safety) — adversarial review methodology (Fagan Inspection)
   - **Architect** (Structure & Maintainability) — architecture review patterns
   - **Pragmatist** (Functionality & Delivery) — DORA metrics philosophy
2. Each profile now has a `skill` attribute — a research-backed system prompt describing the judge's philosophy and focus areas
3. Added new check `goal_alignment` — evaluates if experiment moves toward stated project goals (4 indicators: goal reference, result, rationale, next step)
4. Improved chief judge `_resolve_conflict()` with 5-tier context-aware resolution:
   - Safety veto (Guardian DISCARD for test_safety/syntax_check failures)
   - Goal delivery (Pragmatist KEEP + goal_alignment pass)
   - Architect tiebreaker (structural score)
   - Agent agreement
   - Authority-weighted scoring (Guardian=1.3, Architect=1.1, Pragmatist=0.9)
5. Updated parallel judge prompts in `parallel.py` with specialist role descriptions
6. Updated chief judge prompt with meta-evaluator role and specialist context
7. Backward compatibility via `_PROFILE_ALIASES` mapping old names to new

## Files Modified

- `utils/judge.py` (rewritten profiles, added goal_alignment check, improved conflict resolution)
- `agents/parallel.py` (updated profile names and prompts)
- `ui/server.py` (default profile: balanced → architect)

## Key Results

- All 21 existing tests pass
- All 12 decomposition tests pass
- Full backward compatibility (old profile names still work)
- New profiles have distinct weight distributions matching their roles

## For Next Iteration

- All project goals completed
- Potential improvements: semantic goal alignment (LLM-based), per-profile check exclusions
