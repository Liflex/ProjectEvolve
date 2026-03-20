Начинаю эксперимент 174. Сначала изучу текущее состояние UI lab и decompose функциональности.
Теперь вижу картину. `decompose` есть в backend, но нет UI toggle в lab-run.js. Читаю шаблон run-панели.
Теперь всё ясно. Нужно добавить `decompose` toggle в UI. Это простой, целенаправленный эксперимент.

## Experiment 174: Decompose toggle в Lab UI

**Type:** Feature
**Goal:** Мультиагентность — UI controls в lab для decompose toggle
**Target:** `ui/static/templates/lab-run.js`, `ui/static/js/app.js`
**Complexity Impact:** +0 / -0 (2 файла изменены)
Теперь добавляю toggle в lab-run.js, сразу после Parallel Judges toggle:
Теперь проверяю, что backend правильно принимает `decompose`:
Backend уже принимает `decompose: bool = Field(default=False)` и передаёт в ResearchRunner. Всё соединено. Теперь проверяю, что нет дублирующихся целей в `.autoresearch.json` и готовлю коммит.
Хорошо. Теперь запускаю smoke-тест — проверяю что Python модули импортируются:
Теперь обновляю `.autoresearch.json` — цель про мультиагентность:
Обновляю цель мультиагентности (UI toggle теперь реализован) и убираю дублирующуюся цель Judge:
Теперь удаляю дублирующуюся цель Judge (строка 17 — точный дубликат строки 15):
Теперь коммит:
Обновляю last_experiment.md:
## Experiment Report

**Number:** 174
**Title:** Decompose toggle в lab UI + deduplicate goals
**Type:** Feature
**Goal:** Мультиагентность — UI controls в lab для decompose toggle
**Target:** `ui/static/js/app.js`, `ui/static/templates/lab-run.js`
**Complexity Impact:** 0 файлов (2 изменены)
**Files Modified:** `ui/static/js/app.js`, `ui/static/templates/lab-run.js`, `.autoresearch.json`

### Results

**What was done:**
1. Добавлен `decompose: false` в `runConfig` Alpine data
2. Добавлен toggle **DECOMPOSE_TASKS** в lab-run.js под PARALLEL_JUDGES (фиолетовый акцент)
3. Backend уже поддерживал `decompose` — никаких серверных изменений не потребовалось
4. Удалён дублирующийся goal "Judge" из `.autoresearch.json`

**Working:** yes
**Tests:** smoke passed (Python imports OK)

### Decision

**Result:** KEEP
**Reason:** Цель достигнута — UI toggle для decompose теперь доступен в Lab, toggle корректно передаётся через API в ResearchRunner
**Next:** Production тесты decomposition, больше анимаций кота

### Goals Updated

**Completed:** нет
**Modified:** "Мультиагентность для исследования" — обновлён текст (UI toggle добавлен в exp174)
**Added:** нет

>>>EXPERIMENT_COMPLETE<<<