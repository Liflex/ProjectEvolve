Начинаю эксперимент 30. Сначала прочитаю контекст проекта.
Понял контекст. Теперь посмотрю на текущее состояние файла и выберу задачу.
2687 строк в одном файле! Цель "Разбить HTML на составные элементы" — критически важна. Посмотрю структуру файла.
Структура файла:
- CSS: строки 26-312 (~287 строк)
- HTML: строки 314-1434 (~1120 строк)
- JavaScript: строки 1435-2677 (~1242 строки)
- Matrix toggle: строки 2679-2687

JavaScript — самый большой блок. Прочитаю его.
Прочитаю больше JS-кода и HTML-структуру.
Понял структуру. Файл 2687 строк, из которых ~287 CSS и ~1242 JavaScript. 

## Experiment 30: HTML Architecture Decomposition — Extract CSS and JS

**Type:** Refactoring
**Goal:** Разбить HTML на составные элементы по функционалу
**Target:** `ui/static/index.html` → extract CSS + JS into separate files
**Complexity Impact:** +2 файла, -~1500 строк из index.html

Декомпозиция:
- CSS (287 строк) → `ui/static/css/main.css`
- JavaScript (1242 строки) → `ui/static/js/app.js`
- index.html останется только с HTML-структурой (~1130 строк)

Начинаю извлечение. Сначала прочитаю полные секции CSS и JS.
Теперь прочитаю оставшуюся часть JS (середину).
Теперь у меня полная картина. Создам два файла и обновлю index.html. Сначала проверю CSP в server.py.
CSP разрешает `'self'` — внешние файлы с того же origin будут работать. Создаю файлы.

Сначала создам `ui/static/css/main.css`:
Отлично, у меня есть всё необходимое. Извлеку CSS и JS через bash, чтобы избежать ошибок копирования.
Файлы созданы. Проверю что содержимое корректное.
Файлы извлечены корректно. Теперь обновлю index.html — заменю inline CSS и JS на внешние ссылки.
index.html: 2687 → 1159 строк (-1528 строк, -57%). Проверю результат.
Структура выглядит правильно. Теперь проверю баланс HTML-тегов и запущу smoke-тесты.
HTML сбалансирован (317/317 div, 42/42 template, 12/12 script, 62/62 button), сервер импортируется корректно. Проверю JS на синтаксические ошибки.
JS-синтаксис валиден. Проверю конец app.js.
Все проверки прошли. Обновлю отчёты эксперимента.
Теперь обновлю accumulation context.
Финальная верификация — запущу pytest.
Pre-existing ошибка (отмечена в Exp 5 и далее — не связана с моими изменениями). Проверю остальные тесты.
Только один тест в проекте — с pre-existing ошибкой. Мои изменения — чисто фронтенд (CSS/JS экстракция), Python не затронут.

---

## Experiment Report

**Number:** 30
**Title:** HTML Architecture Decomposition — Extract CSS + JS into separate files
**Type:** Refactoring
**Goal:** Разбить HTML на составные элементы по функционалу
**Target:** `ui/static/index.html`
**Complexity Impact:** +2 файла / -1528 строк из index.html

### Files Modified

- `ui/static/index.html` — заменил inline `<style>` и `<script>` на внешние ссылки
- `ui/static/css/main.css` — **NEW**: 285 строк extracted CSS
- `ui/static/js/app.js` — **NEW**: 1241 строка extracted Alpine.js application logic

### Results

**What was done:**
1. Извлёк 285 строк CSS из inline `<style>` → `ui/static/css/main.css`
2. Извлёк 1241 строку JavaScript (Alpine.js `app()` функция + все методы) → `ui/static/js/app.js`
3. Обновил index.html: заменил блоки на `<link rel="stylesheet" href="/css/main.css">` и `<script src="/js/app.js"></script>`
4. index.html: **2687 → 1159 строк (-57%)** — теперь содержит только HTML-структуру

**Working:** yes
- HTML balanced: 317/317 div, 42/42 template, 12/12 script, 62/62 button
- JavaScript syntax: valid (node -c)
- Server module imports: OK
- CSP: совместимо (`'self'` разрешён для script-src и style-src)
- 0 новых зависимостей

**Tests:** skipped (UI-only refactoring, Python не затронут)

### Decision

**Result:** KEEP
**Reason:**
1. Прямой ответ на цель "Разбить HTML на составные элементы по функционалу, чтобы удобнее было править, и в целом проработать архитектуру UI"
2. index.html уменьшен на 57% — теперь читается и редактируется
3. CSS и JS теперь в отдельных файлах — можно редактировать независимо
4. 0 новых зависимостей, 0 изменений в Python
5. CSP совместим — внешние файлы с того же origin

**Next:**
- Дальнейшая декомпозиция HTML: выделить sidebar, chat panel, experiment views в template-файлы
- Рассмотреть Alpine.js component registration для переиспользуемых UI-паттернов
- Продолжить итерации по коту и UI/UX

>>>EXPERIMENT_COMPLETE<<<