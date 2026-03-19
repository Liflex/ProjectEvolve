# Last Experiment Summary

**Experiment #117** — Research Lab — interactive setup wizard for project config
**Date:** 2026-03-20

## What Was Done

1. **POST /api/setup endpoint** — creates/updates `.autoresearch.json` for any project path, with path traversal protection
2. **GET /api/config?project=...** — now accepts optional `project` query parameter to read config from any path
3. **Setup wizard modal** — 4-step form: PROJECT_INFO → GOALS → STACK & FOCUS → CONSTRAINTS & REVIEW, with progress bar and validation
4. **SETUP button in preflight** — when preflight shows warnings, a SETUP button opens the wizard
5. **Auto-wizard on launch failure** — if `startRun()` fails with "not configured", the wizard opens automatically
6. **Pre-fill from existing config** — wizard loads current config data if `.autoresearch.json` exists
7. **Cat reaction** — happy expression + Russian speech on successful setup

## Files Modified

- `ui/server.py` — `/api/setup` POST endpoint, `/api/config` with `project` query param
- `ui/static/js/modules/lab.js` — setup wizard state, methods (showSetupWizard, saveSetup, etc.), startRun() error handling
- `ui/static/templates/lab-run.js` — wizard modal template, SETUP button in preflight panel
- `ui/static/css/main.css` — setup wizard animation styles

## For Next Iteration

N/A

## What Was Done

N/A

## Files Modified

- Target:** chat.js, chat-section.js, main.css
- `ui/static/js/modules/chat.js` — методы `toggleEditDiff`, `renderEditDiff`, `editDiffStats`; состояние `_editDiffOpen`
- `ui/static/templates/chat-section.js` — diff toggle button, UNCHANGED badge, diff panel с x-html
- `ui/static/css/main.css` — стили `.edit-mode-diff-toggle`, `.edit-diff-panel*`, `.edit-diff-badge-*`

## Key Results

Results

**What was done:**
1. **Кнопка DIFF в edit mode banner** — показывает счётчики `-N/+M` (удалено/добавлено строк), реагирует в реальном времени на изменение input
2. **Раскрывающаяся diff panel** — при клике на DIFF открывается панель с inline diff (оригинал → текущий текст) с word-level highlighting
3. **UNCHANGED indicator** — когда текст совпадает с оригиналом, вместо кнопки DIFF показывается зелёный `✓ UNCHANGED`
4. **Переиспользование существующего кода** — `renderInlineDiff`, `simp

## For Next Iteration

N/A
