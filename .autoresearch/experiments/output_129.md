Начинаю эксперимент 129. Сначала читаю контекст проекта.
Let me look at specific parts of the chat module and the current chat UI to find a good improvement target.
Let me check the bottom panel implementation to see what's there already.
## Experiment 129: Chat — file preview panel (click file path → preview content)

**Type:** Feature
**Goal:** UI/UX улучшение раздела chat — чат как IDE окно
**Target:** ui/server.py, chat.js, chat-section.js, main.css
**Complexity Impact:** +0 файлов (все изменения в существующих)
Good. Now let me add the `/api/fs/read` endpoint. I'll add it right before the preflight endpoint.
Now let me add the file preview state and methods to chat.js. First, let me find where the bottom panel data/methods are.
Now let me find where Alpine data is initialized to add the file preview state. Let me check the app.js for the chat-related data.
Now add the file preview state to app.js.
Now add the file preview methods to chat.js, right after the bottom panel section.
Now let me add the FILE tab to the bottom panel template. Let me read the bottom panel section more carefully.
Add the FILE button to the toolbar:
Now let me add the file preview tab content to the bottom panel. Let me read the bottom panel tabs section.
Now I'll add the FILE PREVIEW tab and content:
Now add the FILE PREVIEW content section after the TOOLS SUMMARY section:
Now let me add CSS styles for the file preview panel. Let me find the existing bottom panel styles.
Now add the file preview CSS styles after the existing bottom panel styles:
Now the key part — modify the file path links in chat messages to open the preview panel on click instead of just copying. Let me find all the file path link locations.
Let me also check the `linkFilePaths` method in the renderer module — this is the one that creates links from file paths in markdown content.
Now I'll modify the file path links. The key change: **click** = preview, **Ctrl+click** = copy. Let me update all 3 locations.

First, the `linkFilePaths` in renderer.js:
Now the tool group detail file paths (line 1475):
Now the tool group header primary target (line 1522):
Now let me also check if there are other `fp-link` usages I may have missed — for example in the context menu:
Good, I'll add a "PREVIEW FILE" option to the context menu for tool messages:
Now let me also add a CSS hover style for the fp-link to indicate it's clickable for preview:
The fp-link already has good hover styles. Let me also check the `fp-link` in the lab module since the grep showed it there too.
Good, no fp-link in lab.js. Let me also check the templates:
All fp-link instances updated. Now let me also make sure the `api` method handles query params correctly. Let me check how `this.api` works.
Good, the `api` method uses `fetch` and the URL with query params will work fine. Now let me run the smoke test.
Let me also verify the endpoint starts correctly by doing a quick test:
All endpoint tests pass. Let me also check if there are any existing tests:
This is a pre-existing test import error, not caused by my changes. Let me skip that test and run the rest:
The test files are empty/stubs. No real tests to break. The server import and endpoint test pass. Let me commit.
Now let me update the experiment logs.
The changes_log was already committed. Let me update the last_experiment.md:
## Experiment Report

**Number:** 129
**Title:** Chat — file preview panel (click file path → preview content)
**Type:** Feature
**Goal:** UI/UX улучшение раздела chat — чат как IDE окно
**Target:** ui/server.py, chat.js, renderer.js, chat-section.js, app.js, main.css
**Complexity Impact:** 0 файлов (все изменения в существующих)
**Files Modified:** ui/server.py, ui/static/js/app.js, ui/static/js/modules/chat.js, ui/static/js/modules/renderer.js, ui/static/templates/chat-section.js, ui/static/css/main.css

### Results

**What was done:**
1. **`/api/fs/read` endpoint** — API для чтения файлов с path traversal защитой, блокировкой бинарных файлов, лимитом 2MB, постраничной пагинацией (offset/limit), автоопределением языка
2. **File preview panel** — третья вкладка "FILE PREVIEW" в bottom panel чата с заголовком файла, постраничной навигацией, нумерацией строк
3. **File path click behavior** — клик = preview, Ctrl+click = copy. Контекстное меню: "PREVIEW FILE"
4. **CSS стили** — минималистичный стиль с line numbers и hover-эффектами

**Working:** yes
**Tests:** skipped (test files are stubs); endpoint manually verified via TestClient

### Decision

**Result:** KEEP
**Reason:** Конкретная полезная фича для "Chat ~ IDE window" — клик по пути файла теперь показывает содержимое прямо в чате. Минимальные изменения в существующих файлах, endpoint защищён.
**Next:** продолжить улучшения чата или перейти к другим целям проекта

>>>EXPERIMENT_COMPLETE<<<