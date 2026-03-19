# Last Experiment Summary

**Experiment #121** — Chat — turn-level collapse/expand with summary preview
**Date:** 2026-03-20

## What Was Done

1. **Turn collapse/expand** — clicking [-]/[+] on turn separator collapses/expands entire turn (user + assistant + tools)
2. **Collapsed turn summary** — shows one-line preview: turn badge, user message snippet, msg count, tool count, response chars, duration
3. **Turn 1 collapse** — small [-] button in USER_ header for first turn (no separator)
4. **Toolbar buttons** — "TURNS" (collapse all prev) and "TURNS" (expand all) next to FOLD ALL/UNFOLD
5. **Keyboard shortcut** — 't' on focused message toggles its turn collapse (j/k nav)
6. **Streaming protection** — current streaming turn cannot be collapsed

## Files Modified

- `ui/static/js/modules/chat.js` — toggleTurnCollapse, collapsePrevTurns, expandAllTurns, renderCollapsedSummary in renderChatHTML
- `ui/static/js/app.js` — 't' key for chatNavAction('turn')
- `ui/static/templates/chat-section.js` — TURNS toolbar buttons, nav hint update
- `ui/static/css/main.css` — .turn-collapse-btn, .turn-collapsed-summary styles

## Key Results

- Long conversations (50+ turns) can be collapsed to show only summaries, making navigation much easier
- One-click "collapse all previous" for focus on current turn
- Click on collapsed summary to expand

## For Next Iteration

N/A
