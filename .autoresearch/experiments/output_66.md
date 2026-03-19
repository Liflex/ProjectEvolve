Давайте посмотрим на текущее состояние чата и определим эксперимент.
Отлично, я понимаю текущее состояние проекта. Давайте выберем эксперимент.

## Experiment 66: Response timing + per-message token display in chat

**Type:** Feature/Improvement
**Goal:** UI/UX улучшение раздела chat — IDE-like отображение времени ответа агента и токенов на каждое сообщение
**Target:** `ui/static/js/modules/chat.js` (WebSocket handler + render), `ui/static/css/main.css`
**Complexity Impact:** +0 / -0 файлов
Начинаю реализацию. Сначала добавлю отслеживание времени ответа и токенов на сообщение в WebSocket handler.
Теперь я добавлю:
1. В `sendChatMessage` — фиксирую `_msgStartTime` на момент отправки
2. В обработчике `result` — сохраняю токены на текущее assistant-сообщение
3. В обработчике `stream_end` — вычисляю длительность и сохраняю на сообщении
4. В `renderChatHTML` — отображаю время и токены в заголовке
Теперь обновлю обработчик `result` для сохранения токенов на текущем сообщении:
Теперь обновлю обработчик `stream_end` для вычисления длительности:
Теперь добавлю отображение timing/token info в renderChatHTML. Нужно найти место, где рендерится заголовок assistant message и добавить туда duration + tokens.
Now I need to add timing and token info to the assistant message header. I'll add it after the existing meta info (time, chars/lines). I also need to add a helper function to format duration.
Теперь добавлю helper-функцию `fmtDuration` в chat.js. Добавлю её в конец, перед закрытием объекта.
Теперь добавлю CSS для метки `.msg-meta-badge`:
Теперь давайте также добавим duration в экспорт чата:
Отлично. Теперь запущу smoke-тесты:
Всё работает. Теперь давайте проверим что изменения логически корректны — посмотрим финальный вид ключевых участков:
Теперь коммит:
Обновлю накопленный контекст:
---

## Experiment Report

**Number:** 66
**Title:** Response timing and per-message token display in chat
**Type:** Feature
**Goal:** UI/UX улучшение раздела chat — IDE-like отображение времени ответа агента и токенов
**Target:** `ui/static/js/modules/chat.js`, `ui/static/css/main.css`
**Complexity Impact:** 0 файлов (изменения в существующих)
**Files Modified:** `chat.js`, `main.css`

### Results

**What was done:**
1. **Message timing** — при отправке сообщения фиксируется `_msgStartTime`, при `stream_end` вычисляется `duration` (ms) и сохраняется на assistant-сообщении
2. **Per-message tokens** — из события `result` сохраняются токены (`msgTokens: {input, output, cost}`) на текущем сообщении
3. **Meta badge** — в заголовке `CLAUDE_` каждого завершённого assistant-сообщения отображается бейдж с: длительностью ответа (1.2s / 2m 15s), output tokens (3.2K out), стоимостью ($0.0123)
4. **fmtDuration helper** — форматирование миллисекунд в читаемый вид
5. **Export** — markdown-экспорт чата включает время ответа и стоимость

**Working:** yes (Python import OK, JS syntax OK, CSS valid)
**Tests:** skipped (UI change, smoke only)

### Decision

**Result:** KEEP
**Reason:** Полезная IDE-фича — пользователь видит сколько времени занял ответ агента и сколько стоил, прямо в интерфейсе чата. Минимальные изменения (61 строка), никаких новых файлов.
**Next:** продолжить улучшение chat UX (input history, keyboard shortcuts, message pinning)

>>>EXPERIMENT_COMPLETE<<<