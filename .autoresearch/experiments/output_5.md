## Experiment Report

**Number:** 5
**Title:** Fix chat session creation and speech bubble visibility
**Type:** Bug Fix
**Goal:** Исправить сломанный чат input и невидимый speech bubble кота
**Target:** `ui/static/index.html`
**Complexity Impact:** 0

### Results

**What was done:**
1. **Speech bubble** — заменил `border-[var(--v-dim)]` (#1e1430, невидимый на тёмном фоне) на `border-[var(--v)]` (#b44aff) + добавил `box-shadow: glow` для заметности
2. **Chat New Session** — заменил прямое создание сессии для `.` на модальное окно с полем ввода пути проекта. Пользователь может ввести любой путь или оставить `.` для текущего проекта. Enter для быстрого подтверждения, автофокус на input.

**Working:** yes
**Tests:** skipped (UI-only change, HTML tag balance verified programmatically)

### Decision

**Result:** KEEP
**Reason:**
1. Два реальных UX бага исправлены минимальными изменениями
2. 0 новых файлов/зависимостей
3. Модальное окно следует существующему паттерну (session picker modal)
4. Обратная совместимость: `.` по умолчанию

**Next:** Удалить или интегрировать `file-browser.js` (зарегистрирован но не используется в HTML)

>>>EXPERIMENT_COMPLETE<<<
