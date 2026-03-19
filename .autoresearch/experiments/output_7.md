Все проверки прошли. Вот итог:

---

## Experiment Report

**Number:** 7
**Title:** Chat streaming optimization + auto-scroll fix
**Type:** Improvement
**Goal:** Eliminate O(n^2) markdown rendering during chat streaming + fix multi-tab auto-scroll
**Target:** `ui/static/index.html` — `renderChatHTML()`, chat container IDs, scroll logic
**Complexity Impact:** 0 (упрощение кода)

### Results

**What was done:**
1. **Streaming optimization** — `renderChatHTML()` теперь рендерит streaming-сообщения как `pre-wrap` escaped text (O(1) per token) вместо `marked.parse()` + `DOMPurify.sanitize()` (O(n) per token). При завершении стриминга — один финальный markdown-рендер (O(n) once). Итог: O(n^2) → O(n).
2. **Auto-scroll fix** — заменил статический `id="chat-messages-area"` на динамический `:id="'chat-messages-' + tab.tab_id"`. Ранее все вкладки имели одинаковый ID — `getElementById` всегда находил первую, а не активную.
3. **Send-scroll** — добавил auto-scroll после отправки сообщения пользователем.

**Working:** yes
**Tests:** HTML tag balance verified (201 div, 12 script, 16 template), Python modules compile, no stale ID references.

### Decision

**Result:** KEEP
**Reason:**
1. Реальное perf-улучшение — markdown-парсинг на каждом токене убивает производительность при длинных ответах
2. Fix реального бага — auto-scroll не работал для 2+ вкладок
3. 0 новых зависимостей, 0 новых файлов, 3 точечных изменения в HTML
4. Complexity Impact: 0 (упрощение — меньше работы на каждом тике)

**Next:**
- Рассмотреть throttled markdown-рендер для streaming (рендерить markdown раз в 200ms вместо raw text) — trade-off между UX и perf
- Chat message persistence (сохранять историю между сессиями)

>>>EXPERIMENT_COMPLETE<<<
