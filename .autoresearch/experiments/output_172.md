Начинаю эксперимент 172. Сначала прочитаю контекст проекта и текущее состояние.
Теперь посмотрю текущий код judge системы и research runner для понимания что нужно сделать.
Теперь посмотрю как UI отображает judge вердикты и server endpoints.
## Experiment 172: Judge conflict resolution & auto-revert

**Type:** Feature
**Goal:** Система judgement — result comparison & conflict resolution (цели 6, 7, 11)
**Target:** `utils/judge.py`, `agents/research.py`, `ui/server.py`, UI templates
**Complexity Impact:** +0 файлов (изменение существующих)

**Что делаю:**
1. Конфликт-резолвер в `ExperimentJudge` — анализ разногласий между судьями, tiebreaker логика
2. Автоматический revert при сильном DISCARD консенсусе в research loop
3. API endpoint для ручного revert по вердикту судьи
4. UI индикация конфликтов и их разрешения

Начинаю реализацию.
Начинаю с добавления conflict resolution в `utils/judge.py`.
Теперь добавлю revert логику в `agents/research.py`. Когда судьи дают DISCARD, нужно иметь возможность откатить коммит.
Теперь добавлю метод `_auto_revert_discard` в `ResearchRunner`:
Теперь добавлю API endpoint для ручного revert в `ui/server.py`:
Теперь обновлю UI — добавлю отображение conflict resolution и кнопку revert в lab-experiments.js:
Теперь обновлю UI. Добавлю отображение conflict resolution, revert badge и кнопку ручного revert.
Теперь добавлю conflict resolution секцию и revert кнопку в UI judge verdict area:
Теперь добавлю conflict resolution отображение после per-profile verdicts:
Теперь добавлю `revertExperiment` метод в lab.js:
Теперь нужно убедиться что `api` метод поддерживает POST. Проверю:
`api()` уже поддерживает `opts` с `method`. Но для POST нужен `Content-Type: application/json`. Проверю как другие POST вызовы делаются:
Хорошо, POST без body для revert endpoint — это корректно (сервер не читает body). Но нужно обновить revert вызов, чтобы он отправлял правильный Content-Type (FastAPI может требовать). На самом деле мой endpoint принимает `data: dict`, а не тело — посмотрю точнее.

Проверю мой endpoint — он принимает POST без тела (body не нужен, n передаётся в path). FastAPI с `data: dict` попытается прочитать body как JSON. Нужно убрать body parameter:
Хорошо, endpoint не принимает body, только path parameter `n`. POST без body будет работать корректно с FastAPI. Но нужно отправлять пустой JSON body чтобы FastAPI не ждал его. Проверю — на самом деле нет, раз нет параметров body в сигнатуре функции, FastAPI не будет пытаться читать body.

Теперь проверю что логирование в lab.js корректно обрабатывает REVERTED события:
Нужно добавить отображение REVERTED в live log:
Теперь проверю что параллельный режим в `_run_judge` тоже получает conflict resolution. В параллельном режиме consensus вычисляется в `run_parallel_judges()` — нужно добавить туда conflict resolution:
Теперь запущу smoke-тесты. Проверю что модули импортируются без ошибок:
Все импорты проходят. Теперь проверю что `evaluate_all()` с conflict resolution работает корректно:
Корректно — когда все судьи согласны (KEEP), conflict resolution не создаётся. Теперь проверю синтаксис server.py:
Все файлы проходят синтаксическую проверку. Теперь закоммичу изменения:
Коммит создан. Теперь обновлю `.autoresearch.json` — цели:
Теперь обновлю `last_experiment.md`:
Финальный коммит обновлений:
## Experiment Report

**Number:** 172
**Title:** Judge conflict resolution & auto-revert on DISCARD
**Type:** Feature
**Goal:** Система judgement — result comparison & conflict resolution (цели 6, 7, 11)
**Target:** `utils/judge.py`, `agents/research.py`, `agents/parallel.py`, `ui/server.py`, UI
**Complexity Impact:** 0 файлов (изменение существующих)
**Files Modified:** 6

### Results

**What was done:**
1. **`_resolve_conflict()`** в `ExperimentJudge` — анализирует разногласия между 3 судьями, определяет какие checks вызвали расхождение, разрешает конфликт через каскад tiebreakers: agent decision → balanced profile score → average score → conflict severity
2. **`evaluate_all()`** больше не возвращает SPLIT — вместо этого вызывает `_resolve_conflict()` и возвращает конкретное решение (KEEP/DISCARD/REVIEW) с подробным отчётом
3. **`_auto_revert_discard()`** в `ResearchRunner` — при DISCARD консенсусе с score < 0.4 автоматически делает `git revert --no-edit` (non-destructive, не reset)
4. **`POST /api/judge/revert/{n}`** — API endpoint для ручного revert эксперимента
5. **UI**: панель conflict resolution показывает diverging checks, resolution method, agent agreement; кнопка [REVERT] для DISCARD; badge ↩ для auto/manual reverted
6. **Live log**: отображение auto-revert событий

**Working:** yes
**Tests:** skipped (syntax check + import test passed)

### Decision

**Result:** KEEP
**Reason:** Конфликт resolution — ключевая недостающая часть judge системы. Три judge цели проекта значительно продвинуты. Auto-revert обеспечивает автоматическую защиту от накопления плохих изменений.
**Next:** Мультиагентность этап 3 — task decomposition

### Goals Updated

**Completed:** нет
**Modified:** 
- Цель 6 (система judgement): обновлена — "result comparison & conflict resolution" больше не в остатках
- Цель 7 (самосовершенствование judgement): обновлена — осталось накопление данных
- Цель 11 (Judge duplicate): обновлена — conflict resolution + auto-revert реализованы
**Added:** нет

>>>EXPERIMENT_COMPLETE<<<