Начинаю эксперимент 35. Сначала прочитаю контекст проекта.
Теперь прочитаю настройки и ключевые секции UI.
Тема уже частично реализована. Прочитаю подробнее секцию тем в app.js.
Отлично, я вижу полную картину. Темы уже существуют (synthwave, darcula, one-dark), но селектор тем в настройках — просто текстовые кнопки без визуального превью. Улучшу это.

## Experiment 35: Enhanced Theme Selector with Visual Preview Cards

**Type:** Improvement
**Goal:** Добавление в настройки выбора "Тем" — визуальный выбор темы с цветовыми свотчами
**Target:** Settings page (app.js + index.html + main.css)
**Complexity Impact:** 0 новых файлов
Теперь обновлю HTML — заменю простые кнопки тем на визуальные превью-карточки.
Теперь добавлю CSS для превью-карточек тем.
Smoke-тесты:
Все тесты пройдены. JS синтаксис валиден, HTML сбалансирован (329 div, 44 template, 12 script, 62 button), сервер импортируется.
Теперь обновлю файлы эксперимента и накопленного контекста.
---

## Experiment Report

**Number:** 35
**Title:** Enhanced Theme Selector with Visual Preview Cards
**Type:** Improvement
**Goal:** Добавление в настройки выбора "Тем" — визуальный выбор темы с цветовыми превью
**Target:** Settings page (app.js + index.html + main.css)
**Complexity Impact:** 0 новых файлов
**Files Modified:** `ui/static/js/app.js`, `ui/static/index.html`, `ui/static/css/main.css`

### Results

**What was done:**
1. **themeMeta** — новый объект в app.js с метаданными для каждой темы: label, desc (на русском), swatches (6 ключевых цветов)
2. **Визуальные превью-карточки** — заменены простые текстовые кнопки на grid из 3 карточек. Каждая показывает 6 цветовых свотчей, название темы и описание. Активная тема выделена бордером + glow + бейдж "ACTIVE"
3. **CSS** — .theme-preview-card, .theme-swatch, .theme-preview-active/inactive стили с hover-эффектами

**Working:** yes
**Tests:** skipped — UI-only изменение, smoke пройден (JS valid, HTML balanced, server import OK)

### Decision

**Result:** KEEP
**Reason:** Улучшение UX выбора темы — теперь пользователь видит палитру до переключения, что делает выбор осознанным. Минимальное изменение, 0 новых файлов.
**Next:** Добавить больше тем (GitHub Dark, Nord, Solarized), mini live-preview при наведении

>>>EXPERIMENT_COMPLETE<<<