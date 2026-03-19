# Last Experiment Summary

**Experiment #114** — Chat — code block INSERT and RUN action buttons
**Date:** 2026-03-20

## What Was Done

1. **[INSERT] button** on all code blocks — inserts code content into chat input textarea. Useful for asking about code, making modifications, or referencing specific code in follow-up messages.
2. **[RUN] button** on bash/shell/zsh code blocks only — sends the command to the agent for execution with a formatted "Run this command:" message. Includes streaming guard (won't send if agent is busy).
3. **Visual feedback** — buttons show [INSERTED]/[SENT] confirmation for 1.5s after click.
4. **Cat reactions** — INSERT triggers thinking expression + Russian speech, RUN triggers working expression + "running" speech.
5. **Shortcuts panel updated** — added [INSERT] and [RUN] to MESSAGES category.

## Files Modified

- `ui/static/js/modules/renderer.js` — added [INSERT] and [RUN] buttons to code block header HTML, `data-lang` attribute on code-block div
- `ui/static/js/app.js` — `window._insertCode()` and `window._runCode()` global handlers, shortcuts panel entries
- `ui/static/css/main.css` — `.code-action`, `.code-action-insert`, `.code-action-run`, `.code-action-done` styles

## Key Results

**Working:** Yes
**Tests:** Skipped (frontend-only change, no backend impact)

## For Next Iteration

N/A
