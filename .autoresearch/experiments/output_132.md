Отлично, начинаю эксперимент 132. Давайте посмотрим на текущее состояние кода, чтобы выбрать конкретную задачу.
Давайте посмотрим на текущую визуализацию tool calls и сообщения в чате.
Отлично, у меня есть чёткая идея для эксперимента. Давайте посмотрим на полную структуру дашборда и lab.js.
Теперь у меня есть полная картина. Начинаю эксперимент 132.
## Experiment 132: Dashboard — Goal Progress Tracker

**Type:** Feature
**Goal:** Web UI — мониторинг, визуализация данных
**Target:** lab-dashboard.js, lab.js, main.css
**Complexity Impact:** +0 файлов (изменения в существующих)

Реализую панель отслеживания прогресса целей проекта в дашборде. Она будет показывать:
- Процент выполнения (прогресс-бар)
- Активные цели с иконками статуса
- Завершённые цели (сворачиваемые)
- Фокус-области как теги

Начинаю с `lab.js` — добавляю метод для вычисления прогресса целей.
Теперь добавлю метод `goalProgressData()` после `streakData()`.
Теперь добавлю панель Goal Progress Tracker в шаблон дашборда. Размещу её между Score Distribution и Last Experiment.
Кажется, уже есть базовая версия Goal Tracker в шаблоне. Давайте проверим, что методы, которые она использует, существуют в lab.js.
Шаблон уже добавлен, но не хватает: методов `goalProgressPct()`, переменной `_goalsShowCompleted`, и CSS. Нужно доработать.
Мой `goalProgressData()` добавлен. Теперь нужно:
1. Добавить `goalProgressPct()` в lab.js (обёртка)
2. Добавить `_goalsShowCompleted` в app.js data
3. Подгрузить config при открытии dashboard
4. Добавить CSS
Добавлю `goalProgressPct()` после `goalStatusWeight()`.
Теперь добавлю `_goalsShowCompleted` в Alpine data в app.js.
Теперь добавлю `loadConfig()` при открытии dashboard.
Отлично — `loadConfig()` уже вызывается при открытии dashboard (строка 755). Теперь добавлю CSS стили.
Теперь давайте доработаем шаблон — текущая версия использует старые классы `goal-item-active` и `goal-item-text`, а я хочу интегрировать новый `goalProgressData()` с иконками статусов и фокус-областями. Давайте обновим шаблон.
Обновлю шаблон с расширенной функциональностью — статус-иконки, информация о проекте, фокус-области.
Smoke-тест — проверяю, что сервер стартует и API работает.
25 целей, 12 завершено (48%). Теперь коммичу.
## Experiment Report

**Number:** 132
**Title:** Dashboard — Goal Progress Tracker with status classification
**Type:** Feature
**Goal:** Web UI — мониторинг, визуализация данных
**Target:** lab.js, lab-dashboard.js, main.css, app.js
**Complexity Impact:** +0 файлов (изменения в 4 существующих)
**Files Modified:** `ui/static/js/modules/lab.js`, `ui/static/templates/lab-dashboard.js`, `ui/static/css/main.css`, `ui/static/js/app.js`

### Results

**What was done:**
1. **`goalProgressData()`** — вычисляет прогресс целей: total/active/completed, процент, классификация активных целей по статусу (WIP/TODO/BACKEND/NOTED)
2. **`goalStatusIcon()` / `goalStatusColor()` / `goalStatusWeight()`** — иконки и цвета для каждого статуса цели: ◉ cyan = in-progress, ○ gray = pending, ◇ amber = needs-backend, ✓ green = done-note
3. **Goal Progress Tracker panel** — прогресс-бар с процентом (48% для текущего проекта), информация о проекте (name, description), фокус-области как теги, список активных целей с иконками статусов и сортировкой, сворачиваемый список завершённых целей, легенда
4. **`_goalsShowCompleted`** — state для toggle completed goals
5. **CSS** — `.goal-item`, `.goal-status-icon`, `.goal-text`, `.goal-focus-tag` и другие стили

**Working:** yes
**Tests:** skipped (UI feature, smoke passed — server module imports OK)

### Decision

**Result:** KEEP
**Reason:** Полезная визуализация прогресса проекта. Позволяет быстро увидеть какие цели активны, какие завершены, и общую картину прогресса (48%). Статус-классификация целей помогает приоритизировать работу.
**Next:** Продолжить работу над активными целями — улучшение chat UI или cat companion

>>>EXPERIMENT_COMPLETE<<<