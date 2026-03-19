## Experiment Report

**Number:** 14
**Title:** Lightweight syntax highlighting for chat code blocks
**Type:** Improvement
**Goal:** Подсветка синтаксиса в code blocks чата для IDE-подобного отображения кода
**Target:** `ui/static/index.html`
**Complexity Impact:** +0 (CSS классы `.tok-*` уже существовали)
**Files Modified:** `ui/static/index.html`

### Results

**What was done:**
1. `highlightCode(code, lang)` — regex-токенизатор с keyword sets для Python, JS/TS, Bash и generic fallback
2. Подсвечивает 5 типов токенов: keywords (`tok-kw`, фиолетовый), strings (`tok-str`, зелёный), comments (`tok-cmt`, серый курсив), numbers (`tok-num`, розовый), function calls (`tok-fn`, циан)
3. Алиасы языков: py→python, sh/shell/zsh→bash, ts/tsx/jsx→javascript
4. Интегрировано в `renderMarkdown()` — code blocks автоматически подсвечиваются

**Working:** yes
**Tests:** skipped — UI-only, HTML balanced 233/233 div, 12/12 script

### Decision

**Result:** KEEP
**Reason:** Прямое продолжение exp 13, 0 зависимостей, использует уже существующие CSS классы
**Next:** Line numbers (CSS counter), collapsible tool sections

>>>EXPERIMENT_COMPLETE<
