# Last Experiment Summary

**Experiment #125** — Chat — streaming speed indicator (words/sec) + response stats badge
**Date:** 2026-03-20

## What Was Done

1. **Streaming speed in toolbar** — при стриминге ответа агента в toolbar показывается live: `ELAPSED 12s · 847w · 68 w/s`
2. **Response stats badge on messages** — после завершения стриминга на assistant сообщении badge: `12s · 847w · 68 w/s · 1.2K out · $0.032` с цветовым кодированием скорости
3. **`getStreamingSpeed(tab)`** / **`getStreamingWordCount(tab)`** — новые хелперы

## Files Modified

- `ui/static/js/modules/chat.js`
- `ui/static/templates/chat-section.js`

## Key Results

- Working: yes
- Tests: skipped (frontend-only change)

## For Next Iteration

N/A
