Начинаю эксперимент 141. Сначала прочитаю контекст проекта.
## Experiment 141: Cat — page-aware contextual tips (dashboard, experiments, run, settings)

**Type:** Feature
**Goal:** Cat companion — диалоговые подсказки-тултипы contextual к текущей странице и состоянию
**Target:** cat.js, chat-section.js, lab.js, app.js
**Complexity Impact:** +0 файлов (изменения в существующих)

Сейчас кот даёт советы только на основе ключевых слов в чате и событий экспериментов, но не знает на какой странице находится пользователь. Добавлю page-aware idle tips — кот будет давать разные подсказки в зависимости от активной секции (Dashboard, Experiments, Run, Chat, Settings).
Понял контекст. Все "маленькие" цели в основном выполнены. Оставшиеся — значительные (semantic search, judgement system, multi-agent). Начну с первого шага к **judgement system** — создам пост-экспериментный автоматический судью.

## Experiment 141: Post-experiment auto-judge — basic sanity checker

**Type:** Feature
**Goal:** Нужна система judgement судей, которые оценивают и решают делать KEEP/DISCARD
**Target:** utils/judge.py (новый), ui/server.py, lab-experiments.js
**Complexity Impact:** +1 файл
Now let me create the judge module.
Now let me hook the judge into the experiment save flow in server.py.
Now let me integrate the judge into `_save_experiment_artifacts`:
Now let me add an API endpoint to manually trigger the judge for the last experiment (useful for testing and for experiments run outside the auto-loop):
Now add the judge API endpoint:
Now let me add judge verdict display to the experiments UI. Let me update the experiments template to show the judge's verdict in the summary tab:
Now let me add the judge verdict section and a "Judge" button in the summary tab. I'll also add the `judgeExperiment` method to the lab module:
Now add the `judgeVerdict` state and `judgeExperiment` method to the lab module:
Now let me add the `judgeVerdict` state and `judgeExperiment` method. Let me find where the data properties are defined:
Now add the `judgeExperiment` method to the lab module:
Now let me also clear the judge verdict when selecting a different experiment:
Now let me add some CSS for the judge verdict:
The judge verdict uses existing pixel-border and bg-[var(--bg)] styles from the template, so no extra CSS is needed. The existing styles handle the check marks and layout.

Now let me test the judge module:
The judge works correctly. The warning about `accumulation_context.md` being missing is because it was staged but not in the diff (it's tracked as modified but the actual diff was staged).

Now let me run a quick syntax check on the modified files:
Now let me run any existing tests:
All imports work. Now let me commit:
Now let me update the experiment logs:
## Experiment Report

**Number:** 141
**Title:** Post-experiment auto-judge — basic sanity checker
**Type:** Feature
**Goal:** Нужна система judgement судей, которые оценивают и решают делать KEEP/DISCARD
**Target:** utils/judge.py (new), ui/server.py, lab.js, lab-experiments.js, app.js
**Complexity Impact:** +1 файл
**Files Modified:** utils/judge.py, ui/server.py, ui/static/js/app.js, ui/static/js/modules/lab.js, ui/static/templates/lab-experiments.js

### Results

**What was done:**
1. **`utils/judge.py`** — `ExperimentJudge` с 4 проверками:
   - `commit_exists` — проверяет что агент сделал коммит
   - `file_consistency` — сравнивает заявленные files_modified с реальным git diff
   - `syntax_check` — проверяет Python/JS файлы на синтаксические ошибки
   - `diff_size` — проверяет что размер изменений разумный
2. **Server hook** — judge автоматически запускается после сохранения артефактов эксперимента. Вердикт сохраняется в данные эксперимента и логируется.
3. **API endpoint** — `GET /api/judge/{n}` для ручного запуска
4. **UI** — кнопка "RUN JUDGE" в summary tab эксперимента. Показывает вердикт с рекомендацией (KEEP/DISCARD/REVIEW), скором и деталями по каждой проверке.

**Working:** yes
**Tests:** skipped (существующие тесты не связаны, import check + manual test passed)

### Decision

**Result:** KEEP
**Reason:** Первый шаг к judgement system. Judge работает корректно, даёт полезную независимую оценку. Интегрирован в основной поток экспериментов и доступен вручную через UI.
**Next:** Добавить больше проверок (test runner, import validation), показать badge в списке экспериментов, авто-judge с live log event.

>>>EXPERIMENT_COMPLETE<<<