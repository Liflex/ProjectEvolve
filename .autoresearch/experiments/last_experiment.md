# Last Experiment Summary

**Experiment #190** — Migrate ClaudeSession to ClaudeSDKClient for proper multi-turn
**Date:** 2026-03-20

## What Was Done

1. **Root cause identified**: SDK documentation explicitly states `query()` is stateless ("Each query is independent, no conversation state"). The previous code used `query()` with `continue_conversation=True` which is the wrong API for multi-turn conversations.

2. **Migrated to ClaudeSDKClient**: Replaced `query()` with `ClaudeSDKClient` which maintains a persistent bidirectional connection to the SDK subprocess. This provides:
   - Persistent connection: no subprocess spawn per message
   - True multi-turn: SDK maintains conversation state internally
   - `interrupt()`: can stop a running response mid-stream (previously `cancel()` was a no-op)
   - `resume`: first message can resume a previous conversation via `resume_id`

3. **Code reduction**: -177 lines, +83 lines (94 lines net reduction). Removed unused `_task` and `_query_result` fields, eliminated the `continue_conversation` flag workaround.

4. **Removed dead test**: `test_buffered_log_writer.py` tested `_BufferedLogWriter` class that was removed from `autoresearch.py` in a previous experiment.

## Files Modified

- `agents/session.py` (rewritten: ClaudeSDKClient instead of query())
- `tests/test_buffered_log_writer.py` (deleted: class under test no longer exists)

## Key Results

- All 21 tests pass
- Interface fully compatible (FakeSession mock in grace period tests works unchanged)
- Session import verified, server import verified
- cancel() now actually works via `interrupt()` instead of being a no-op

## For Next Iteration

- Monitor ClaudeSDKClient stability in production (first real multi-turn usage)
- If interrupt() causes issues with the persistent connection, may need error recovery logic
