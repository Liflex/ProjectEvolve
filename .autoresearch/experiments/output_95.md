Теперь посмотрю chat модуль и накопленный контекст.
Теперь у меня полное понимание проекта. Выбираю задачу для эксперимента 95.

## Experiment 95: Chat — code block line highlighting and word wrap toggle

**Type:** Improvement
**Goal:** UI/UX chat improvements + "Чат ~ Окно IDE"
**Target:** renderer.js, main.css
**Complexity Impact:** 0 (modifying existing files)

Начинаю реализацию.
Отлично — line selection уже реализован. Нужны другие IDE-фишки. Сделаю:

1. **[WRAP]** — toggle word wrap для длинных строк в code blocks
2. **[FOLD]** — сворачивание code block до заголовка (как в VS Code)
Now I have a clear picture. Let me implement the changes.

**1. Renderer: Add [WRAP] and [FOLD] buttons to code block headers**
Now let me add the [WRAP] and [FOLD] buttons to the code block header in the renderer:
Now I have all the context. Let me implement the changes:

1. **renderer.js** — add [WRAP] and [FOLD] buttons to code block headers
2. **app.js** — add global handlers for wrap toggle and fold toggle
3. **main.css** — add styles for wrap and fold states
Now I'll make all three changes. Let me start:

**1. Add WRAP and FOLD buttons to the code block header in renderer.js:**
Now let me add [WRAP] and [FOLD] buttons to the code block header:
Let me make all three changes now.

**1. renderer.js — Add [WRAP] and [FOLD] buttons to code block header:**
I need to stop re-reading the same file and just make the edit. Let me do it:
CRLF line endings. Let me make the edits now using the Write tool approach since the Edit tool can have issues with CRLF:
Now I understand the exact byte pattern. Let me write the new lines properly:
Renderer.js updated. Now let me add the global handlers in app.js:

**2. app.js — Add _toggleCodeWrap and _toggleCodeFold global handlers:**
**3. main.css — Add styles for .code-wrap, .code-folded, .code-ctrl:**
Now let me verify the changes look correct:
There are duplicate lines! The first insertion attempt partially worked. Let me fix this:
Now let me verify app.js:
Let me also verify the CSS:
All changes look correct. Now let me run the smoke test:
Now let me check if there are any existing tests:
This is a pre-existing test failure (import error unrelated to our changes). Let me run only the tests that don't have this issue:
Tests have collection issues (pre-existing). Our changes are purely frontend (JS + CSS), so the smoke test of JS loading is sufficient. Let me now commit:
Now let me update the experiment context files:
Now update the accumulation context:
## Experiment Report

**Number:** 95
**Title:** Chat — code block wrap toggle and fold collapse buttons
**Type:** Improvement
**Goal:** UI/UX chat improvements + "Чат ~ Окно IDE Для работы с агентом прослойкой с кодом"
**Target:** renderer.js, app.js, main.css
**Complexity Impact:** 0 (+0/-0 файлов, 3 модифицированных)
**Files Modified:**
- `ui/static/js/modules/renderer.js` — [WRAP] и [FOLD] кнопки в заголовке code block
- `ui/static/js/app.js` — глобальные обработчики `window._toggleCodeWrap()` и `window._toggleCodeFold()`
- `ui/static/css/main.css` — стили `.code-wrap`, `.code-folded`, `.code-ctrl`

### Results

**What was done:**
1. **[WRAP]** — кнопка toggle word wrap для длинных строк в code blocks. Переключает `white-space: pre-wrap` с `word-break: break-word`, убирая горизонтальный скролл.
2. **[FOLD]** — кнопка сворачивания code block до заголовка (как region folding в VS Code). Полностью скрывает `<pre>` содержимое.
3. **Visual feedback** — активное состояние подсвечивается cyan, текст кнопки меняется ([WRAP]→[NOWRAP], [FOLD]→[UNFOLD]).
4. **Кнопки расположены** в заголовке code block между [COPY SEL] и [COPY], в одном ряду с другими контролами.

**Working:** yes (JS синтаксис валидирован)
**Tests:** skipped — frontend-only изменение

### Decision

**Result:** KEEP
**Reason:** Конкретное, видимое улучшение чата в стиле IDE. Пользователи часто работают с длинными строками кода и большими блоками — wrap и fold стандартные функции любого IDE.
**Next:** Продолжить улучшение чата (IDE-фичи) или перейти к другим целям проекта (кот, семантический поиск, judgement system).

>>>EXPERIMENT_COMPLETE<<<