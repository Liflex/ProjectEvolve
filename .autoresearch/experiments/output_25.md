Начинаю эксперимент 25. Сначала прочитаю контекст проекта.
Теперь посмотрю текущее состояние UI и сервера для планирования эксперимента.
Давайте посмотрим на страницу Run в index.html и как сейчас отображаются данные.
Теперь у меня есть полное понимание. Спланирую эксперимент 25.
## Experiment 25: Interactive Quality Trend Graph

**Type:** Improvement
**Goal:** UI/UX улучшения — графики трендов качества (goal 1)
**Target:** Dashboard page, score timeline chart
**Complexity Impact:** +0 файлов

Сейчас базовый SVG-график — простая линия с точками. Улучшу его: hover-тултипы с деталями эксперимента, линия скользящего среднего, цветовые индикаторы типа, клик для навигации к эксперименту.
Now I have everything I need. Let me implement the enhanced quality trend chart.
Теперь добавлю state variable `chartHover` и новые методы `movingAvgPoints()` и `scoreTrendHitTest()`.
Теперь обновлю метод `scoreTrendSvg()` и добавлю новые методы.
Теперь запущу smoke-тесты.
Все теги сбалансированы, серверный модуль загружается. Давайте проверим, что новые методы корректно вставлены и не конфликтуют.
Всё на месте. Давайте проверим корректность всего SVG-блока ещё раз — убедимся, что viewBox и координаты согласованы.
Все выглядит корректно. Проверю координатную систему:
- viewBox height = 110, chart area y: 5 (top, score 1.0) → 85 (bottom, score 0.0) = 80px span
- Score 1.0 → y = 85 - 1.0 * 80 = 5 ✓
- Score 0.0 → y = 85 - 0.0 * 80 = 85 ✓  
- Score 0.5 → y = 85 - 0.5 * 80 = 45 ✓ (line at y=45)
- Score 0.7 → y = 85 - 0.7 * 80 = 29 ≈ 28 ✓ (line at y=28)
- Score 0.85 → y = 85 - 0.85 * 80 = 17 ≈ 16 ✓ (line at y=16)

Теперь обновлю накопительный контекст и last_experiment.md.
Now update the accumulation context.
## Experiment Report

**Number:** 25
**Title:** Interactive Quality Trend Graph
**Type:** Improvement
**Goal:** UI/UX улучшения — графики трендов качества (goal 1)
**Target:** Dashboard page, score timeline chart
**Complexity Impact:** +0 файлов
**Files Modified:** `ui/static/index.html`

### Results

**What was done:**
1. **Enhanced SVG chart** — увеличена высота (h-24 → h-36), gradient fill через SVG linearGradient, glowDot filter для hover-эффекта
2. **Hover tooltip** — при наведении на точку: тултип с номером, заголовком, score и decision эксперимента. Hit-test `scoreTrendHitTest()` определяет ближайшую точку по расстоянию мыши
3. **Moving average line** — 3-точечное скользящее среднее (amber dashed) поверх кривой score
4. **Hover crosshair** — вертикальная пунктирная линия + glow circle при наведении
5. **Click navigation** — клик по точке → переход к эксперименту
6. **Legend** — SCORE, AVG(3), KEEP, DISCARD в шапке графика
7. **Data points redesign** — KEEP=зелёный, DISCARD=красный, N/A=amber

**Working:** yes
**Tests:** skipped (UI-only change, HTML balanced 274/274, Python imports OK)

### Decision

**Result:** KEEP
**Reason:**
1. Прямой ответ на goal "графики трендов качества"
2. 0 новых файлов, 0 новых зависимостей
3. Интерактивный: hover показывает детали, клик ведёт к эксперименту
4. Moving average даёт наглядное представление тренда

**Next:**
- Quality trend per experiment type (colored lines)
- Experiment comparison side-by-side
- File change viewer

>>>EXPERIMENT_COMPLETE<<<