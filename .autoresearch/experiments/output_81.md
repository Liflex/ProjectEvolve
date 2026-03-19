Начинаю эксперимент 81. Сначала читаю контекст проекта.
Теперь посмотрю текущее состояние файлов чата и кота для выбора задачи.
Давайте посмотрим на текущие клавиатурные сокращения и другие функции чата.
Давайте проверим существующие действия с сообщениями и контекстное меню.
Давайте найдем рендеринг чата и контекстное меню.
Проверим, как кот интегрирован в UI.
Давайте посмотрим шаблон сайдбара с котом.
Отлично, у меня есть полная картина. Приступаю к реализации.

## Experiment 81: Cat companion — click interaction and hover proximity awareness

**Type:** Feature
**Goal:** Cat companion improvements — interactive click, hover awareness, idle escalation
**Target:** cat.js, sidebar.js, app.js
**Complexity Impact:** +0 файлов (modification only)

Начинаю с cat.js — добавляю click interaction, hover awareness и idle escalation.
Добавляю новые переменные состояния в cat.js:
Теперь добавляю логику idle escalation в tick():
Теперь добавляю публичные API методы — onClick, setHovering, resetIdle:
Теперь нужно обновить все существующие публичные API методы, чтобы они вызывали `resetIdle()` при взаимодействии. Добавлю resetIdle в key методы:
Теперь обновляю `analyzeChatContext` и `analyzeAgentResponse` чтобы сбрасывали idle:
Теперь добавляю обработчики событий на canvas в sidebar.js:
Теперь добавляю методы в app.js. Сначала найду где добавить `_catHovering` state и `onCatClick`:
Добавляю `_catHovering` state:
Теперь добавляю метод `onCatClick`. Найду место рядом с другими cat-методами:
Также добавляю resetIdle в navigate():
Теперь добавляю CSS для hover-эффекта на cat frame. Найду cat-frame стили:
Теперь проверю, что всё собрано корректно. Посмотрю финальное состояние cat.js:
Проверю idle escalation в tick():
Проверю публичный API:
Всё выглядит корректно. Теперь запущу smoke-тесты — проверю что JS загружается без ошибок:
Все файлы синтаксически корректны. Теперь коммичу изменения:
Коммит прошёл. Теперь обновлю контекст эксперимента:
Обновлю accumulation context:
## Experiment Report

**Number:** 81
**Title:** Cat companion — click interaction, hover awareness, and idle escalation
**Type:** Feature
**Goal:** Cat companion improvements — interactive behaviors and contextual awareness
**Target:** cat.js, sidebar.js, app.js, main.css
**Complexity Impact:** +0 файлов (modification only, +210 lines)
**Files Modified:** cat.js, sidebar.js, app.js, main.css

### Results

**What was done:**
1. **Click interaction** — клик по коту вызывает случайную реакцию (8 вариантов: surprised/happy/thinking + анимации earTwitch/pawWave/purr)
2. **Petting mode** — 3+ быстрых клика активируют режим поглаживания: happy expression + purr vibration + быстрый хвост + речь на русском (6 вариантов)
3. **Hover awareness** — mouseenter/leave на canvas кота; приветственная речь при наведении (25% шанс с cooldown); увеличенная частота ear twitch при наведении; CSS glow-эффект
4. **Idle escalation** — 4 уровня: active (0-45s), restless (45-90s), sleepy (90-180s), deep-sleep (3min+); прогрессивная смена выражения на sleepy, stretch-анимация, idle-речь; реакция пробуждения при клике/hover
5. **resetIdle()** — все внешние API-вызовы (setExpression, say, setSpeechText, analyzeChatContext, analyzeAgentResponse) сбрасывают idle-таймер

**Working:** yes (syntax check passed)
**Tests:** skipped (pure frontend UI feature)

### Decision

**Result:** KEEP
**Reason:** Конкретное, видимое пользователю улучшение. Кот теперь полностью интерактивный — реагирует на клики, наведение мыши, отслеживает бездействие. Petting mode — забавный easter egg. Idle escalation делает кота живым даже при отсутствии активности.
**Next:** Mouse-following eye direction; cat reactions to specific UI events (theme switches, settings changes)

>>>EXPERIMENT_COMPLETE<<<