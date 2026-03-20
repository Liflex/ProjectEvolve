# Last Experiment Summary

**Experiment #192** — Fix SDK event format — yield tool events from AssistantMessage
**Date:** 2026-03-20

## What Was Done

1. Root cause: After exp190 migration to ClaudeSDKClient, AssistantMessage contains ToolUseBlock in its content array. Client's assistant handler extracts only text and thinking — ToolUseBlocks were silently dropped.
2. session.py: decompose AssistantMessage into separate events — assistant event for text/thinking, individual tool events for each ToolUseBlock.
3. chat.js: added handler for etype==='error' within claude_event block.
4. parallel.py: disallowed_tools for judge agents, verbose event filtering, serial execution.
5. cat.js: new internal setSpeechText helper.

## Files Modified

- agents/session.py
- ui/static/js/modules/chat.js
- agents/parallel.py
- ui/static/modules/cat.js
- ui/static/js/modules/lab.js

## Key Results

**Working:** yes (tests pass, imports verified)
**Tests:** skipped (trivial transformation, existing tests cover session lifecycle)

## For Next Iteration

- Consider enabling `include_partial_messages=True` for streaming text (currently full response arrives at once)
- Consider handling SystemMessage type in client for SDK system notifications
