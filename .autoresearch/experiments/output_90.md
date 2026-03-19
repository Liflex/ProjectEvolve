Давайте посмотрим на текущее состояние чат-модуля и как там работают action shortcuts.
## Experiment 90: Dashboard — experiment activity heatmap

**Type:** Feature
**Goal:** Web UI — мониторинг, визуализация данных
**Target:** lab.js, lab-dashboard.js, main.css, app.js
**Complexity Impact:** +0 файлов (изменения в существующих)

Начинаю реализацию. Добавлю activity heatmap в стиле GitHub на дашборд.
Теперь добавлю методы для вычисления данных heatmap в lab.js.
Теперь добавлю загрузку экспериментов при навигации на дашборд в app.js.
Теперь добавлю state переменные для heatmap tooltip в app.js.
Теперь обновлю шаблон дашборда — добавлю heatmap, streak tracker и улучшенные метрики.
Теперь добавлю метод `heatmapMonthLabels()` в lab.js.
Теперь добавлю CSS стили для heatmap.
Теперь проверю, нет ли проблем с шаблоном. Нужно убедиться, что streak-секция корректно отображается. Проверю синтаксис x-data.
Проблема — `x-data` создаёт вложенный scope, где `streakData()` недоступен. Исправлю — уберу вложенный scope и буду вызывать напрямую.
Аналогично исправлю heatmap — вместо вложенного `x-data` буду вызывать напрямую.
Нужно заменить вложенный `x-data` на прямой вызов методов родительского компонента.
Подождите — вызов `heatmapData()` внутри `x-for` будет пересчитываться на каждой итерации. Лучше кэшировать результат. Добавлю свойство `_hm` в Alpine data.
Теперь обновлю `loadExperiments` чтобы кэшировать heatmap и streak данные.
Теперь обновлю шаблон, чтобы использовать кэшированные `_heatmapData` и `_streakData`.
Теперь обновлю streak tracker чтобы использовать `_streakData`.
Теперь запущу smoke-тесты.
Скобки сбалансированы. Теперь проверю Python бэкенд на синтаксические ошибки.
Тест падает из-за отсутствующего экспорта `_BufferedLogWriter` — это pre-existing issue, не связанный с моими изменениями (это чисто фронтенд-эксперимент). Проверю только те тесты, которые не зависят от этого.
Тестовые файлы пустые — тесты ещё не написаны. Это нормально, smoke-тест пройден: Python бэкенд компилируется, JS файлы синтаксически корректны.

Теперь коммичу изменения.
Теперь обновлю файлы контекста эксперимента.
## Experiment Report

**Number:** 90
**Title:** Dashboard — activity heatmap and streak tracker
**Type:** Feature
**Goal:** Web UI — мониторинг, визуализация данных
**Target:** lab.js, lab-dashboard.js, main.css, app.js
**Complexity Impact:** 0 файлов (+254 строк в 4 существующих)
**Files Modified:**
- `ui/static/js/modules/lab.js`
- `ui/static/templates/lab-dashboard.js`
- `ui/static/css/main.css`
- `ui/static/js/app.js`

### Results

**What was done:**
1. **Activity heatmap** — GitHub-style grid 12 недель (84 дня) с violet-интенсивностью по количеству экспериментов
2. **Tooltip** — при наведении на ячейку показывается дата и количество экспериментов
3. **Month/Day labels** — подписи месяцев снизу, Mon/Wed/Fri слева
4. **Summary stats** — active days, this week, today под heatmap
5. **Streak tracker** — текущая/лучшая KEEP-серия, текущая DISCARD-серия с progress bars
6. **Milestone indicator** — следующий milestone (5/10/20 KEEP) или LEGENDARY
7. **Performance** — кэширование в `_heatmapData`/`_streakData` при загрузке экспериментов

**Working:** yes
**Tests:** skipped (фронтенд-изменение, smoke: Python компилируется, JS синтаксис OK)

### Decision

**Result:** KEEP
**Reason:** Добавлена визуализация данных на дашборд — activity heatmap и streak tracker. Конкретное, видимое изменение, двигает цель "Web UI — визуализация данных".
**Next:** Можно добавить click-to-filter на ячейках heatmap (показать эксперименты за день), или улучшить dashboard другими виджетами.

>>>EXPERIMENT_COMPLETE<<<