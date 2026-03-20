Давайте посмотрим на текущее состояние UI файлов, чтобы выбрать подходящую задачу.
Let me check the current message rendering to understand what hover actions exist.
## Experiment 137: Chat — message reference links (#N) + click-to-copy

**Type:** Feature
**Goal:** UI/UX улучшение раздела chat (IDE-like cross-referencing)
**Target:** chat.js, renderer.js, main.css
**Complexity Impact:** +0 файлов

Let me look at the current message rendering to understand where to add references.
Now let me see the user message rendering and the renderChatHTML function.
Now I have a clear picture. Let me implement message reference links. I'll add:

1. A `#N` badge on each message (clickable to copy reference)
2. Auto-linking `#N` patterns in message content to scrollable references
3. `scrollToMsg()` function with highlight animation
Good. Now let me find `renderUserContent` and the end of `linkFilePaths` to understand where to add the message reference linking.
Now let me look at the end of the chat.js to find a good place to add new methods, and check the total line count.
Now let me find the end of chat.js to add the new methods.
Now let me check the end of the CSS file for a good place to add styles.
Now I have everything I need. Let me implement the changes.

**Plan:**
1. Add `linkMsgRefs(html, tabId)` to renderer.js — converts `#N` in text to clickable links
2. Add `scrollToMsg(tabId, msgIdx)` and `copyMsgRef(tabId, msgIdx)` to chat.js
3. Add `#N` badge to message role lines (both user and assistant)
4. Add CSS for `.msg-ref-badge`, `.msg-ref-link`, `.msg-ref-highlight`

Let's start:
Now add the methods to chat.js. Let me add `scrollToMsg`, `copyMsgRef` and modify the rendering.
Now add the `#N` badge into the assistant role line. Let me find the exact line where the role line is assembled.
Now do the same for user messages. Let me find the user role line.
Now add `uRefBadge` to the user role line.
Now I need to add `linkMsgRefs` calls in the message content rendering. Let me update the assistant message content to link refs, and the user message content too.
Now do the same for user message content. Let me find the renderUserContent calls.
Also update the collapsed assistant preview that uses `linkFilePaths`:
Now add the `scrollToMsg` and `copyMsgRef` methods to chat.js. Let me add them near the end, before the closing `};`.
Now add the CSS styles. Let me find the right place in main.css — near the `.msg-ts` styles.
Now let me verify the changes look correct by checking the modified sections.
Good. Now let me run a quick syntax check on the JavaScript files.
Both files parse correctly. Let me also check if there are any existing tests to run.
Tests don't have proper test functions (they're probably just import checks). The JS syntax checks passed. Let me now commit and write the report.

Let me also verify the changes are consistent by checking the diff.
Now let me commit the changes.
Now let me update the experiment logs.
Now update the accumulation context.
Now commit the experiment logs.
## Experiment Report

**Number:** 137
**Title:** Chat — message reference links (#N) with click-to-copy and scroll-to
**Type:** Feature
**Goal:** UI/UX улучшение раздела chat (IDE-like cross-referencing)
**Target:** chat.js, renderer.js, main.css
**Complexity Impact:** +0 файлов / 122 строк добавлено
**Files Modified:** chat.js, renderer.js, main.css

### Results

**What was done:**
1. **`#N` reference badge** — каждое сообщение (user/assistant) получает кликабельный бейдж `#N` в строке роли. Клик копирует ссылку в буфер обмена, fallback — вставка в поле ввода.
2. **`linkMsgRefs(html, tabId)`** — метод рендерера, конвертирует `#N` паттерны в контенте сообщений в кликабельные ссылки (защищённые от модификации внутри code blocks и `<a>` тегов).
3. **`scrollToMsg(tabId, msgIdx)`** — плавный скролл к целевому сообщению с 2-секундной пурпурной подсветкой (keyframe анимация). Автопереключение на нужный таб.
4. **`copyMsgRef(tabId, msgIdx)`** — копирует `#N` в clipboard с toast-уведомлением.
5. **CSS** — `.msg-ref-badge` (маленький monospace бейдж), `.msg-ref-link` (cyan dashed underline), `.msg-ref-highlight` (keyframe flash).

**Working:** yes (JS syntax check passed)
**Tests:** skipped (UI-only change, no Python tests affected)

### Decision

**Result:** KEEP
**Reason:** Полезная фича для длинных разговоров — enables precise cross-referencing. Минимальное изменение, никакой сложности.
**Next:** продолжить улучшения chat UX или cat companion

>>>EXPERIMENT_COMPLETE<<<