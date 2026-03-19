Начинаю эксперимент 111. Сначала прочитаю контекст проекта.
Понял контекст. Выбираю задачу для эксперимента 111.

## Experiment 111: Chat — message outline/TOC for long assistant messages

**Type:** Feature
**Goal:** UI/UX улучшение раздела chat (Чат ~ Окно IDE)
**Target:** chat.js, renderer.js, main.css
**Complexity Impact:** +0 файлов (изменения в существующих)

**Идея:** Когда assistant message содержит 3+ markdown-заголовков (##, ###), показывать мини-TOC (table of contents) в начале сообщения. Клик по пункту TOC скроллит к соответствующему заголовку. IDE-like фича (как Document Outline в VS Code).

Начинаю реализацию.
Now I'll implement the TOC for long assistant messages. Let me add the helper functions and modify the rendering.
Now modify `renderAssistantMsg` to use the TOC and heading IDs:
Now add CSS styles for the TOC. Let me find a good place in main.css.
Now let me verify the changes are correct by reading the modified sections:
Let me verify JS syntax:
JS syntax OK. Now let me do a quick functional test with Node.js to verify the TOC logic works:
Test 1 "failure" is just the simplified test function missing the "OUTLINE" label text. The actual function in chat.js has it. The 4 sections count is correct (Overview, Details, Sub-item, Summary). All core logic tests pass.

Let me run a proper test with the actual function:
All tests pass. Clean up the test file:
Now let me check if there are any existing tests to run:
Тесты Python имеют предсуществующие проблемы с импортами (не связаны с моими JS-изменениями). Мои изменения только в JS/CSS. Синтаксис JS проверен, логика TOC протестирована.

Теперь коммичу изменения:
Коммит успешен. Теперь обновлю файлы отчёта:
Обновлю accumulation_context.md:
Файлы в `.autoresearch/` в gitignore — это нормально, они для внутреннего использования.

---

## Experiment Report

**Number:** 111
**Title:** Chat — message outline/TOC for long assistant messages
**Type:** Feature
**Goal:** UI/UX улучшение раздела chat (Чат ~ Окно IDE)
**Target:** chat.js, main.css
**Complexity Impact:** 0 новых файлов, 2 изменённых
**Files Modified:**
- `ui/static/js/modules/chat.js` — `_buildMessageTOC()`, `_addHeadingIds()`, modified `renderAssistantMsg()`
- `ui/static/css/main.css` — `.msg-toc*` styles

### Results

**What was done:**
1. `_buildMessageTOC(content, msgId)` — парсит markdown-заголовки (##, ###, ####), фильтрует заголовки внутри code blocks, генерирует collapsible TOC при 3+ headings
2. `_addHeadingIds(html, prefix)` — пост-обработка HTML: добавляет уникальные `id` к `<h2>`, `<h3>`, `<h4>` для якорных ссылок из TOC
3. `renderAssistantMsg()` — для завершённых сообщений: render → heading IDs → TOC + content
4. CSS: collapsible outline panel с indent по уровню заголовка, hover effects, max-height scroll

**Working:** yes (JS syntax valid, logic tested with Node.js)
**Tests:** skipped (no working Python test suite; JS changes don't affect Python)

### Decision

**Result:** KEEP
**Reason:** Полезная IDE-like фича для навигации по длинным ответам агента. Минимальное изменение (130 строк), обратно совместимо, не влияет на streaming/collapsed messages.
**Next:** Продолжить улучшения chat UX или перейти к cat companion / другим целям

>>>EXPERIMENT_COMPLETE<<<