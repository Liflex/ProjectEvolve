Все изменения внесены и контекст обновлён.

---

## Experiment Report

**Number:** 6
**Title:** Multi-line chat input + dead code cleanup
**Type:** Improvement
**Goal:** Включить многострочный ввод в чат и удалить мёртвый код
**Target:** `ui/static/index.html`, `ui/static/js/`
**Complexity Impact:** -2 файла

### Results

**What was done:**
1. **Chat input** — заменил `<input type="text">` на `<textarea rows="2" resize-none>` с `@keydown.enter` handler: Enter → send, Shift+Enter → newline. Placeholder: "Type a message_ (Shift+Enter for newline)".
2. **Dead code removal** — удалил `chat.js` (38 строк, `fileBrowserOpen()` с `prompt()` никогда не вызывалась) и `file-browser.js` (загружался но не использовался как Alpine-компонент).
3. **Cleanup** — удалил `onPathSelected` метод, `@path-selected.window` event handler, и 2 `<script>` тега из HTML.

**Working:** yes
**Tests:** skipped (UI-only change)

**Smoke checks:**
- HTML теги сбалансированы (201 div, 12 script)
- Нет ссылок на удалённые файлы (grep clean)
- `python -c "from ui.server import app"` — OK
- Shift+Enter handler присутствует (shiftKey + preventDefault)
- `js/` directory: только `terminal.js`

### Decision

**Result:** KEEP
**Reason:**
1. Реальное UX улучшение — однострочный input делал невозможным вставку многострочного кода в code chat
2. Dead code cleanup — 2 файла и 1 метод удалены, уменьшая когнитивную нагрузку
3. Complexity Impact: -2 файла (упрощение), 0 новых зависимостей
4. Note from Experiment 5 ("file-browser.js не используется") закрыт

**Next:** drag-and-drop для пути проекта; chat renderChatHTML re-render optimization

>>>EXPERIMENT_COMPLETE<<<
