# Last Experiment Summary

**Experiment #121** — Chat — turn-level collapse/expand with summary preview
**Date:** 2026-03-20 02:43:17

## What Was Done

N/A

## Files Modified

- Target:** chat.js, app.js, chat-section.js, main.css
- `ui/static/js/modules/chat.js` — toggleTurnCollapse, collapsePrevTurns, expandAllTurns, renderCollapsedSummary
- `ui/static/js/app.js` — 't' key handler
- `ui/static/templates/chat-section.js` — toolbar buttons, nav hint
- `ui/static/css/main.css` — collapse button + summary styles

## Key Results

Results

**What was done:**
1. **Turn collapse/expand** — кнопка `[-]`/`[+]` на turn separator сворачивает/разворачивает весь turn (user + assistant + tools)
2. **Collapsed summary** — однострочный превью: `T3 | "How do I fix the auth bug?" | 4 msgs · 2 tools · 1.2K ch · 12s`
3. **Turn 1 collapse** — маленькая кнопка `[-]` в заголовке USER_ для первого turn
4. **Toolbar** — кнопки `TURNS` (свернуть все предыдущие) и `TURNS` (развернуть все) рядом с FOLD ALL/UNFOLD
5. **Keyboard** — клавиша `t` н

## For Next Iteration

N/A
