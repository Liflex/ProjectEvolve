# Last Experiment Summary

**Experiment #195** — Streaming text buffer for smoother chat rendering
**Date:** 2026-03-20

## What Was Done

1. **requestAnimationFrame batching for text streaming** — replaced per-event `chatTick++` with rAF-based batching for `text` and `assistant` event types. Reduces DOM re-renders from 10-30/sec to max 60/sec (display refresh rate).
2. **Smart scroll coalescing** — `smartScroll()` now called inside the rAF callback instead of separate `setTimeout(50ms)` per event, eliminating scroll jitter.
3. **Cleanup on stream_end and ws.onclose** — `_streamRafPending` flag cleared to prevent stale callbacks.
4. **Committed uncommitted changes** from previous sessions: serial judge execution in parallel.py (rate limit fix), experiment logs.

## Files Modified

- `ui/static/js/modules/chat.js` (+18/-6 lines: rAF batching for text/assistant events)
- `agents/parallel.py` (serial judge execution, rate limit fix — previously uncommitted)
- `.autoresearch/experiments/accumulation_context.md`
- `.autoresearch/experiments/last_experiment.md`
- `.autoresearch/experiments/changes_log.md`

## Key Results

- All 21 tests pass
- JS syntax valid
- No visual regression expected (same content, fewer renders)

## For Next Iteration

- Monitor streaming performance in production
- Consider extending rAF batching to `thinking` events if needed
