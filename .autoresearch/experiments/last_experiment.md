# Last Experiment Summary

**Experiment #182** — WebSocket auto-reconnect with exponential backoff
**Date:** 2026-03-20

## What Was Done

1. **Auto-reconnect with exponential backoff** — `ws.onclose` now schedules reconnect instead of just setting 'disconnected'. Backoff: 1s, 2s, 4s, 8s, 16s, max 30s, up to 10 attempts.
2. **Fixed ws.onerror duplicate messages** — `onerror` no longer pushes "[ERROR] WebSocket connection failed" (onclose always fires after onerror, reconnect logic handles state).
3. **`_wsIntentionalClose` flag** — prevents auto-reconnect on intentional close (tab close, session end by server with code 1000).
4. **`reconnectTab()` generalized** — now works for all tabs (not just restored ones). For regular tabs with session_id, just reconnects WebSocket. For restored tabs, creates new session.
5. **UI: 'reconnecting' state** — status bar shows "RECONNECTING (N)..." with attempt count, tab dot pulses faster, banner shows "DISCONNECTED — connection lost" with RECONNECT button.
6. **RECONNECT button on disconnected tabs** — previously only visible on restored tabs, now also on any disconnected tab.
7. **Fixed pre-existing syntax error** — double `},` after `toggleSendMode()` in chat.js (latent bug, node -c always failed).

## Files Modified

- `ui/static/js/modules/chat.js` (+70/-35 lines)
- `ui/static/templates/chat-section.js` (+8/-6 lines)
- `ui/static/css/main.css` (+1 line)

## Key Results

- WebSocket now auto-recovers from transient disconnects (server restart, network glitch, laptop sleep)
- No more duplicate "[ERROR] WebSocket connection failed" messages on temporary drops
- Users can manually trigger reconnect from UI at any time
- After 10 failed attempts, shows clear message with manual reconnect option

## For Next Iteration

- Consider adding notification sound on reconnect success/failure
- Could persist reconnect state across page reloads
