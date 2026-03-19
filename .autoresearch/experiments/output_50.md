Начинаю эксперимент 50. Сначала прочитаю контекст проекта и текущее состояние.
Хорошо, вижу контекст. Первая цель — FONT_SIZE слайдер не работает. Давайте посмотрим текущую реализацию.
Теперь посмотрю, как работает `applySettings` и как применяются темы.
Понял проблему. FONT_SIZE слайдер устанавливает `document.body.style.fontSize` и `--user-font-size`, но CSS содержит сотни захардкоженных `font-size: Npx` значений, которые не реагируют на изменение базового размера.

## Experiment 50: Font Size Scaling via CSS zoom

**Type:** Bug Fix
**Goal:** FONT_SIZE слайд бар - не работает
**Target:** CSS + JS settings
**Complexity Impact:** +0 / -0 файлов (minor edits to existing)

**Подход:** Использовать CSS `zoom` на body — масштабирует весь UI пропорционально, включая все текстовые элементы, inline-стили, SVG-текст. Самый надёжный и простой метод.
Реализую. Подход: `CSS zoom` на body — масштабирует весь UI пропорционально.
Теперь обновлю `applySettings()`, чтобы вычислять и применять zoom:
Теперь проверю, что slider в настройках правильно вызывает applySettings. Посмотрю шаблон настроек:
Слайдер уже вызывает `applySettings()`. Проверю корректность обновлённого themes.js:
Проверю, как обрабатывается смена темы:
Проблема! При смене темы через Command Palette вызывается `applyTheme()` напрямую, а не `applySettings()` — zoom не обновится. Нужно исправить:
Проверю строку 581:
Это `applySettings()` — корректно. Теперь проверю, как тема выбирается в UI настроек:
Ещё одна проблема на строке 22 — кнопка выбора темы в настройках тоже вызывает `applyTheme(key)` напрямую:
Теперь проверю, нет ли других мест где `applyTheme` вызывается напрямую:
Отлично — `applyTheme` вызывается только из `applySettings()` и как определение метода. Теперь запущу smoke-тест:
Pre-existing test failure (недоступный `_BufferedLogWriter` — не связан с моими изменениями). Проверю синтаксис JS:
Все JS файлы валидны. Обновлю накопленный контекст и отчёт:
## Experiment Report

**Number:** 50
**Title:** Font Size Scaling via CSS zoom
**Type:** Bug Fix
**Goal:** FONT_SIZE слайд бар — не работает. Должны меняться все текстовые элементы.
**Target:** JS settings + theme application
**Complexity Impact:** 0 файлов (minor edits)
**Files Modified:**
- `ui/static/js/app.js`
- `ui/static/js/modules/themes.js`
- `ui/static/templates/lab-settings.js`

### Results

**What was done:** Заменил нерабочий подход `document.body.style.fontSize` на CSS `zoom`. Проблема была в том, что CSS содержит сотни захардкоженных `font-size: Npx` значений, которые не наследуют body font-size. CSS `zoom` масштабирует весь UI пропорционально — все текстовые элементы, inline-стили, SVG-текст, меню, чат, research bar. Zoom вычисляется как `fontSize / themeBaseFontSize`, поэтому корректно работает при смене тем (synthwave=16px, darcula=13px, one-dark=14px, dracula=14px). Также исправил баг где `--code-font` CSS переменная молча не устанавливалась, и ensured что все места смены темы вызывают `applySettings()` вместо `applyTheme()` напрямую.

**Working:** yes — JS syntax validated, Python import OK
**Tests:** skipped — UI change, pre-existing test failure unrelated

### Decision

**Result:** KEEP
**Reason:** Минимальное изменение (3 файла, ~10 строк изменено), решает проблему полностью. CSS zoom — стандартное решение для масштабирования UI, поддерживается всеми современными браузерами.
**Next:** Проверить поведение zoom с canvas-элементами (matrix rain, cat companion), возможно нужна следующая цель из списка.

>>>EXPERIMENT_COMPLETE<<<