## Experiment Report

**Number:** 15
**Title:** Line numbers in code blocks via CSS counters
**Type:** Improvement
**Goal:** Добавить IDE-style номера строк в code blocks чата
**Target:** `ui/static/index.html`
**Complexity Impact:** +0 (CSS + 4 строки JS)
**Files Modified:** `ui/static/index.html`

### Results

**What was done:**
1. CSS `counter-reset`/`counter-increment` на `.code-line::before` — номер строки с разделителем
2. `renderMarkdown` — каждая строка кода оборачивается в `<span class="code-line">` для CSS counter
3. `user-select: none` на номерах — копирование кода не захватывает номера

**Working:** yes
**Tests:** skipped — UI-only change

### Decision

**Result:** KEEP
**Reason:**
1. Прямое продолжение exp 13-14, завершает IDE-style code blocks
2. 0 новых файлов, 0 зависимостей — чистые CSS counters
3. Алайнится с целью "Chat ~ IDE"
4. `user-select: none` на номерах — copy работает корректно

**Next:** Collapsible tool activity sections / больше языков для подсветки

>>>EXPERIMENT_COMPLETE<
