Let me examine the current state of the chat UI and cat companion to pick the next improvement.
Теперь у меня хорошее понимание текущего состояния. Давайте выберем и реализуем эксперимент 112.

## Experiment 112: Chat — message edit/regenerate tracking indicators

**Type:** Feature
**Goal:** UI/UX улучшение раздела chat
**Target:** chat.js, main.css
**Complexity Impact:** 0 файлов (модификация существующих)

Что будет сделано:
1. "(edited)" бейдж на отредактированных пользовательских сообщениях
2. "(regen)" бейдж на регенерированных ответах ассистента
3. CSS стили для индикаторов

Начинаю реализацию.
Now let me implement the changes. First, mark edited user messages in `sendChatMessage`:
Now let me update `regenerateResponse` to set a flag:
Now mark the next assistant message in the WebSocket handler. Let me find where new assistant messages are created:
Now do the same for the `assistant` event type handler (second place where new messages are created):
Now add the badges in the render functions. First, the user message render:
Now find where the user message role label is rendered and add the badge:
Now add the regenerated badge to the assistant message render:
Now add the regen badge to the assistant role label. Let me find the exact line:
Now add the CSS styles for the badges:
Now let me also make sure the `_regenerating` flag is cleared in the stream_end handler (in case regeneration is cancelled or fails):
Also clear it on error:
Now let me run the smoke tests to make sure everything works:
The changes are purely frontend (JS + CSS), so Python tests are irrelevant. Let me verify the JS is syntactically correct:
JS syntax is valid. Now let me commit:
Now let me update the experiment tracking files:
Now commit the tracking files:
OK, `.autoresearch` is gitignored. No need to track it. The main commit is already done. Let me verify:
## Experiment Report

**Number:** 112
**Title:** Chat — message edit/regenerate tracking indicators
**Type:** Feature
**Goal:** UI/UX улучшение раздела chat
**Target:** chat.js, main.css
**Complexity Impact:** 0 файлов (модификация 2 существующих)
**Files Modified:** `ui/static/js/modules/chat.js`, `ui/static/css/main.css`

### Results

**What was done:**
1. **Edited message tracking** — при редактировании и повторной отправке пользовательского сообщения, новое сообщение помечается флагом `edited: true`
2. **Regenerated response tracking** — `regenerateResponse()` устанавливает `tab._regenerating = true`, обработчик WebSocket помечает следующий ответ ассистента флагом `regenerated: true`
3. **"(edited)" бейдж** — жёлтый italic индикатор на отредактированных пользовательских сообщениях
4. **"(regen)" бейдж** — cyan italic индикатор на регенерированных ответах ассистента
5. **Cleanup** — флаг `_regenerating` очищается при stream_end, error и создании сообщения

**Working:** yes (JS syntax verified)
**Tests:** skipped — frontend-only change

### Decision

**Result:** KEEP
**Reason:** Стандартная функция прозрачности чата — пользователи видят какие сообщения были изменены. Минимальные изменения, нет риска.
**Next:** Продолжить улучшения UI/UX чата или перейти к следующей активной цели

>>>EXPERIMENT_COMPLETE<<<