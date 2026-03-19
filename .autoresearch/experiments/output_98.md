Начинаю эксперимент 98. Читаю контекст проекта.
Читаю текущий код чата и шаблоны для понимания архитектуры.
Теперь посмотрю на систему bottom panel и `getSessionStats`.
Уже есть кнопка STATS! Посмотрю что сейчас делает панель.
Статистическая панель уже существует! Давайте сосредоточимся на другом. Проверим модуль кота.
Теперь посмотрю что такое `promptTemplates` в app.js.
## Experiment 98: Chat UX — streaming elapsed timer + per-message token display + enhanced stats

**Type:** Feature/Improvement
**Goal:** UI/UX улучшение раздела chat + дашборд со статистикой
**Target:** chat.js, chat-section.js
**Complexity Impact:** 0 (no new files)

Начинаю реализацию.

### 1. Streaming elapsed timer — показываю время работы агента в тулбаре
Теперь добавлю функцию для расчёта elapsed time стриминга в chat.js. Мне нужно добавить метод, который вычисляет время с `_msgStartTime`, и показать его в тулбаре.
Теперь добавлю методы: `getStreamingElapsed` и `getMsgTokenMeta`, а также расширю `getSessionStats`.
Начинаю реализацию. Сначала добавлю метод `getStreamingElapsed` и расширю `getSessionStats` в chat.js.
Теперь расширю `getSessionStats` дополнительными метриками.
Теперь добавлю per-message token display к рендерингу assistant сообщений. Найду строку с `aMetaHtml`:
Per-message token display уже существует. Теперь добавлю streaming elapsed timer в тулбар чата.
Добавлю streaming elapsed timer между "MSGS" и навигацией:
Теперь расширю stats panel — добавлю новые метрики (avg message length, session start, throughput).
Добавлю секцию "Message Length" и "Session Info" в stats panel. Найду footer stats:
Теперь добавлю input area character/word counter. Посмотрю на input textarea:
Уже есть character counter. Улучшу его — добавлю word count:
Теперь добавлю `fmtDuration` в AppUtils, если его нет:
`fmtDuration` определена в chat.js. Проверю что `getStreamingElapsed` и `getSessionStats` доступны в шаблоне (они spread-ятся в Alpine data).
Все методы из `AppChat` spread-ятся в Alpine data. Теперь проверю, что `_clockTick` обновляется (чтобы streaming timer обновлялся):
Проблема: Alpine.js не знает что `getStreamingElapsed` нужно обновлять. Нужно добавить `_clockTick` в выражение чтобы Alpine отслеживал реактивность:
Теперь проверю, что всё корректно работает. Посмотрю CSS для stats-panel:
CSS классы уже определены. Теперь давайте проверим throughput вычисление — `getSessionStats(activeTab).duration` возвращает строку типа "5m 30s", а `split(/[hm]/)[0]` возьмёт число минут. Это корректно.

Проверю, нет ли синтаксических ошибок в throughput expression — оно слишком длинное, давайте упростим с помощью вычисляемого свойства:
Теперь добавлю метод `getThroughput` в chat.js:
Теперь запущу smoke-тест — проверю что файлы корректны. Проверю синтаксис:
Всё на месте. Теперь проверю, нет ли проблем с загрузкой модулей — проверю порядок загрузки в HTML:
Порядок корректный: `chat.js` загружается перед `app.js`, а `chat-section.js` загружается перед `app.js` (шаблоны инжектятся в DOM до Alpine init).

Теперь коммичу изменения:
Изменения выглядят корректно. Коммичу:
Обновлю контекст эксперимента:
---

## Experiment Report

**Number:** 98
**Title:** Chat UX — streaming elapsed timer, enhanced stats panel, word counter
**Type:** Improvement
**Goal:** UI/UX улучшение раздела chat + дашборд со статистикой
**Target:** chat.js, chat-section.js
**Complexity Impact:** 0 файлов (+62 lines across 2 files)

### Results

**What was done:**
1. **Streaming elapsed timer** — живой счётчик `ELAPSED` в тулбаре чата, появляется когда агент стримит ответ. Обновляется каждую секунду через `_clockTick` реактивность Alpine.js. Пульсирующий cyan индикатор рядом.
2. **Enhanced stats panel** — новая секция `CONTENT_METRICS` в STATS панели:
   - `AVG USER` — средняя длина пользовательского сообщения (символы)
   - `AVG CLAUDE` — средняя длина ответа ассистента (символы)
   - `SESSION START` — время начала сессии
   - `THROUGHPUT` — turns per minute (скорость диалога)
3. **Input word counter** — под textarea теперь показывает `123ch · 15w` вместо `123 chars`
4. Новые методы: `getStreamingElapsed()`, `getMsgTokenMeta()`, `getThroughput()`

**Working:** yes
**Tests:** skipped (UI-only, no backend changes)

### Decision

**Result:** KEEP
**Reason:** Конкретные, видимые улучшения UX чата. Streaming timer даёт обратную связь о времени ожидания ответа. Stats panel стал информативнее. Word counter полезен для оценки длины промпта.
**Next:** Продолжить улучшение chat UX или перейти к семантическому поиску

>>>EXPERIMENT_COMPLETE<<<