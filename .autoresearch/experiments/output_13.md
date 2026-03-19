## Experiment Report

**Number:** 13
**Title:** IDE-style code blocks in chat + role labels
**Type:** Improvement
**Goal:** Стилизация кода в чат-сообщениях агента под IDE с header-баром, кнопкой копирования и роль-лейблами
**Target:** `ui/static/index.html`
**Complexity Impact:** +0 (CSS + regex post-process в существующем renderMarkdown)
**Files Modified:** `ui/static/index.html`

### Results

**What was done:**
1. **IDE-style code blocks** — markdown `<pre><code class="language-X">` блоки оборачиваются в `.code-block` с header (язык: PYTHON/JS/BASH/etc. + кнопка [COPY])
2. **Chat role labels** — `USER_` (фиолетовый) и `CLAUDE_` (голубой) над каждым message bubble
3. **Theme-aware CSS** — все стили через CSS-переменные, работают с обеими темами
4. **blockquote fix** — `#4a3a5a` заменён на `var(--v3)`

**Working:** yes
**Tests:** skipped — UI-only change, HTML balanced (229/229 div, 12/12 script), Python imports OK

### Decision

**Result:** KEEP
**Reason:** Прямой ответ на goal "стилизация ответа агента под шаблоны тем". 0 новых файлов/зависимостей. COPY кнопка — стандартная IDE UX.
**Next:** Syntax highlighting (highlight.js/Prism), line numbers, collapsible tool sections

>>>EXPERIMENT_COMPLETE<
