# Last Experiment Summary

**Experiment #145** — Chat toolbar overflow groups — PANEL/MSG/FILTER dropdowns
**Date:** 2026-03-20

## What Was Done

1. **PANEL dropdown** — RAW LOG, TOOLS, FILE PREVIEW grouped into single "PANEL" dropdown button
2. **MSG dropdown** — FOLD ALL, UNFOLD ALL, COLLAPSE TURNS, EXPAND TURNS grouped into "MSG" dropdown
3. **FILTER dropdown** — USER, CLAUDE, TOOLS, THINKING toggles with checkboxes + SHOW ALL reset
4. Removed duplicate EXPORT button and standalone [X] PANEL button
5. CSS styles for `.tb-dropdown-*` components
6. State variables `_tbPanelOpen`, `_tbMsgOpen`, `_tbFilterOpen` in app.js

## Files Modified

- `ui/static/templates/chat-section.js` — toolbar reorganization
- `ui/static/css/main.css` — dropdown menu styles
- `ui/static/js/app.js` — dropdown state variables

## Key Results

- Toolbar reduced from ~25 visible buttons to ~14 visible + 3 organized dropdown groups
- All functionality preserved (accessible via dropdowns or command palette)

## For Next Iteration

- Consider adding keyboard shortcuts for dropdown menus (e.g., Alt+P for Panel)
- Test on smaller screens (< 1366px) for further optimization
