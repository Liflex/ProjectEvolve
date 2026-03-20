# Accumulation Context — AutoResearch

> Rotated on 2026-03-20. Full history of experiments #1–#187 is preserved in git.
> This file now contains only the most recent experiments for context.

---

## Experiment 190 — Migrate ClaudeSession to ClaudeSDKClient for proper multi-turn

**Date:** 2026-03-20

### What Was Done

1. **Root cause**: SDK docs explicitly state `query()` is stateless. Previous code used wrong API for multi-turn.
2. **Migrated to ClaudeSDKClient**: Persistent bidirectional connection, true multi-turn context, working `interrupt()` for cancel.
3. **Code reduction**: -94 lines net. Removed unused `_task`, `_query_result`, `continue_conversation` workaround.
4. **Removed dead test**: `test_buffered_log_writer.py` — class under test was removed previously.

### Files Modified

- `agents/session.py` (rewritten)
- `tests/test_buffered_log_writer.py` (deleted)

---

## Experiment 189 — Judge system improvements (uncommitted changes committed)

**Date:** 2026-03-20

### What Was Done

1. **Robust JSON parser** — `_try_parse_judge_json()` with 5 extraction strategies (direct parse, code fences, brace-balanced, regex, bare text).
2. **Chief judge** — 4th tiebreaker judge invoked when 3 profiles disagree (e.g., 2 DISCARD + 1 KEEP).
3. **REWORK verdict** — New verdict between KEEP and DISCARD. Rework remarks propagated to next experiment prompt.
4. **UI fixes** — `lang="ru"`, `defer` on CDN scripts, font-size user preference check.

### Files Modified

- `agents/parallel.py`, `agents/research.py`, `autoresearch.py`, `ui/static/index.html`, `ui/static/js/app.js`, `ui/static/js/modules/themes.js`

---

## Experiment 187 — Session grace period on WebSocket disconnect

**Date:** 2026-03-20

### What Was Done

1. **`SessionManager.deactivate()`** — no longer immediately cancels the session. Instead starts a 60-second grace period timer. If the client reconnects within this window, the timer is cancelled and the session resumes.
2. **`SessionManager.reactivate()`** — new method that cancels the grace period timer when a client reconnects. Returns True if the session was in grace period.
3. **`SessionManager.cancel_session()`** — unchanged: still immediately removes and cleans up (used for explicit user close actions). Overrides any pending grace period timer.
4. **WebSocket handler** — calls `reactivate()` on connect for existing sessions, enabling seamless reconnection.
5. **8 tests** covering: no immediate cancel on deactivate, reactivate cancels timer, grace period expiry cleanup, immediate cancel overrides grace period, double deactivate resets timer.

### Files Modified

- `agents/manager.py` (rewritten: grace period with asyncio timers)
- `ui/server.py` (+7 lines: reactivation on WS connect, logger import)
- `tests/test_session_grace_period.py` (+109 lines, new file)

---

## Experiment 185 — Structured system messages in chat with actionable buttons

**Date:** 2026-03-20

### What Was Done

1. **`_renderSystemBlock()`** — новый helper для рендеринга `[ERROR]`, `[INFO]`, `[WARNING]`, `[RECONNECT FAILED]` сообщений как структурированных блоков вместо обычных assistant bubbles.
2. **CSS стили** — `.chat-sys-block`, `.chat-sys-error/info/warning` с цветовой кодировкой, `.chat-sys-actions` для кнопок действий.
3. **ERROR блоки** — красный фон, иконка предупреждения, текст ошибки, кнопки RECONNECT (для connection errors) + COPY.
4. **INFO блоки** — cyan фон, markdown рендеринг (для текста с **bold**), иконка информации.
5. **WARNING блоки** — amber фон, markdown рендеринг, иконка предупреждения.
6. **Avatar SVG константы** — вынесены `_AVATAR_USER`, `_AVATAR_ASST`, `_AVATAR_TOOL` на уровень модуля для переиспользования в `_renderSystemBlock`.

### Files Modified

- `ui/static/css/main.css` (+67 lines)
- `ui/static/js/modules/chat.js` (+66 lines, -3 lines)

---

## Experiment 182 — WebSocket auto-reconnect with exponential backoff

**Date:** 2026-03-20

### What Was Done

1. **Auto-reconnect with exponential backoff** — `ws.onclose` schedules reconnect (1s→2s→4s→...→30s max, 10 attempts). New `_scheduleWsReconnect()` method.
2. **Fixed ws.onerror duplicate messages** — removed error push from `onerror` (onclose handles state).
3. **`_wsIntentionalClose` flag** — prevents auto-reconnect on intentional tab close.
4. **`reconnectTab()` generalized** — works for all tabs, not just restored ones.
5. **UI: 'reconnecting' state** — status bar, tab dot, banner, RECONNECT button on disconnected tabs.
6. **Fixed pre-existing syntax error** — double `},` after `toggleSendMode()`.

### Files Modified

- `ui/static/js/modules/chat.js` (+70/-35 lines)
- `ui/static/templates/chat-section.js` (+8/-6 lines)
- `ui/static/css/main.css` (+1 line)

---

## Experiment 180 — Security hardening — path traversal fix, secret file blocking, input validation

**Date:** 2026-03-20

### What Was Done

1. **`_validate_project_path()`** — centralized helper using `_is_subpath()` with `Path.relative_to()` for proper containment check. Replaced weak `".." in parts` checks in 4 endpoints.
2. **`_is_subpath()`** — reliable subpath check that works with resolved paths.
3. **Path traversal fix in `/api/sessions` POST** — was completely unprotected.
4. **Secret file blocking** — `SECRET_EXTS` and `SECRET_NAMES` blocked from file APIs.
5. **Prompt payload size limit** — `/api/prompt` PUT now has `max_length=500_000`.
6. **13 new tests** covering path validation and secret blocking.

### Files Modified

- `ui/server.py` (+55/-30 lines)
- `tests/test_server_path_validation.py` (+117 lines)

---

## Experiment 179 — Scroll-to-bottom FAB with new message count indicator

**Date:** 2026-03-20

### What Was Done

1. **`_newMsgCount` tracker** — счётчик на каждом tab, инкрементируется при новом сообщении пока пользователь прокручен вверх.
2. **FAB upgrade** — показывает "↓ N NEW" с cyan-цветом и пульсацией.
3. **Auto-reset** — при клике на FAB, скролле вниз, создании/restore tab.

### Files Modified

- `ui/static/js/modules/chat.js` (+21 lines)
- `ui/static/templates/chat-section.js` (+6 lines)
- `ui/static/css/main.css` (+16 lines)

---

## Experiment 177 — Cat expression overlays + yawn mouth sprite

**Date:** 2026-03-20

### What Was Done

1. **MOUTH_YAWN sprite** (7×5 px) — для stretch фаз.
2. **renderExpressionOverlays()** — blush, sweat drop, tear, angry vein overlays.

### Files Modified

- `ui/static/modules/cat.js` (+60 lines)

---

## Experiment 169 — Remove IDE-like features from chat

**Date:** 2026-03-20

### What Was Done

1. Removed File Search, Global Search, Command Palette, Stats Panel from MORE dropdown.
2. Removed panel HTML (268 lines).
3. Removed keyboard handlers.

### Files Modified

- `ui/static/templates/chat-section.js` (-368 lines, 27% reduction)
- `ui/static/js/app.js`

---

## Experiment 168 — Judge weight auto-adjustment from verdict history

**Date:** 2026-03-20

### What Was Done

1. **Weight persistence** — `save_custom_weights()` / `load_custom_weights()` saves to `.autoresearch/judge_weights.json`.
2. **Auto-apply logic** — discriminative score + blend factor (0.3), clamped to [0.2, 3.0].
3. **API endpoints** — `GET /api/judge/weights`, `POST /api/judge/weights/adjust`, `POST /api/judge/weights/reset`.

### Files Modified

- `utils/judge.py`, `agents/research.py`, `ui/server.py`

---

## Experiment 164 — Auto-judge integration in research loop

**Date:** 2026-03-20

### What Was Done

1. **EVENT_JUDGE** — New event type `judge_verdict`.
2. **_run_judge()** — Runs after each successful experiment. Non-fatal.
3. **Persistence** — Judge verdicts saved to `.autoresearch/experiments/judge_{n}_all.json`.

### Files Modified

- `agents/research.py`, `ui/server.py`, `ui/static/js/modules/lab.js`

---

## Experiment 163 — Chat toolbar cleanup — compact primary toolbar with MORE dropdown

**Date:** 2026-03-20

### What Was Done

1. **Compact primary toolbar** — only THINK, Search, FILTER, MSGS count, streaming stats, budget bar, MORE.
2. **MORE dropdown** — CLEAR, PANELS, MSG folding, PINS, EXPORT, STATS, etc.

### Files Modified

- `ui/static/templates/chat-section.js`, `ui/static/js/app.js`, `ui/static/css/main.css`

---

## Earlier Experiments (#1–#162)

Full details available in git history. Key milestones:
- **#39:** Ctrl+F incremental search in chat
- **#40:** Live experiment logging via WebSocket
- **#46:** JS modularization (app.js + 5 modules)
- **#55:** resume_id fix for regen/edit
- **#56:** Font size rem scaling
- **#58:** File browser + preflight check for research lab
- **#63:** Theme-aware markdown rendering
- **#64:** Skill autocomplete in chat (/commit, /speckit.*, /simplify)
- **#101:** Session/chat persistence via localStorage
- **#102:** Global ALT+9 settings
- **#107:** Warcraft 3 cat phrases
- **#117:** Setup wizard (name, goals, stack, focus, constraints)
- **#130:** Message minimap sidebar
- **#133:** Activity sparkline in status bar
- **#134:** Response regeneration diff view
- **#135:** Text selection floating toolbar
- **#137:** Message reference links (#N)
- **#138:** Cat typing awareness
- **#140:** Collapsible markdown sections
- **#145:** Toolbar overflow groups (dropdowns)
- **#146:** Enhanced markdown rendering
- **#147:** Project documentation search (TF-IDF)
- **#151:** Smart collapsed preview
- **#152:** Send mode toggle (Enter/Ctrl+Enter)
- **#154:** STOP button + ESC shortcut
- **#156:** Ctrl+Up edit last message
- **#158:** Cat contextual skill suggestions
- **#159:** Streaming thinking preview
- **#167:** Cat lying down pose
- **#170:** Parallel agent runner
- **#171:** Parallel judge evaluation
- **#172:** Conflict resolution + auto-revert
- **#173:** Task decomposer + result aggregator
- **#174:** Decompose UI toggle in lab
- **#175:** Configurable judge check weights UI

## Experiment 188 — Untitled

**Date:** 2026-03-20 21:30:28

### What Was Done

N/A

### Files Modified

- None

### Results

## Parallel Execution Summary

**Completed:** 3/3
**Cost:** $2.1281
**Conflicts:** None

**Per-task Results:**

### Notes for Next

N/A

---

## Experiment 190 — Migrate ClaudeSession to ClaudeSDKClient for proper multi-turn

**Date:** 2026-03-20 22:04:53

### What Was Done

N/A

### Files Modified

- None

### Results

Results

**What was done:**
1. Обнаружен root cause: SDK документация прямо говорит что `query()` — **stateless** ("Each query is independent, no conversation state"). Предыдущий код использовал неправильный API для multi-turn.
2. Мигрировал `ClaudeSession` с `query()` на `ClaudeSDKClient` — persistent bidirectional connection:
   - Первое сообщение: `connect(prompt)` — создаёт клиент и подключается
   - Последующие: `query(prompt)` — переиспользует существующее соединение
   - `interrupt()` — т

### Notes for Next

N/A

---
