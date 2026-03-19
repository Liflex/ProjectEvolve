Начинаю эксперимент 27. Прочитаю контекст проекта.
Let me look at the current settings, themes, and sections structure.
Хорошо, вижу что settings и темы уже есть. Давайте посмотрим детальнее на текущую реализацию тем и чата.
Давайте проверим, что было реализовано в эксперименте 26 — нужно убедиться, что compare mode реально работает.
Давайте проверим backend API для понимания доступных endpoints.
Теперь у меня полное понимание архитектуры. Приступаю к эксперименту 27.

## Experiment 27: Git Diff Viewer для изменённых файлов

**Type:** Feature
**Goal:** "просмотр изменений файлов" + "diff-viewer" (цель 1, фокусная область)
**Target:** `ui/server.py` (backend) + `ui/static/index.html` (frontend)
**Complexity Impact:** +0 файлов (добавляю в существующие)

### План:
1. Backend: `/api/git/diff` endpoint — возвращает git diff для текущего проекта
2. Backend: `/api/git/diff/{filepath}` — diff для конкретного файла
3. Frontend: таб "FILES" в деталях эксперимента — показывает diff каждого файла
4. Frontend: рендеринг diff с подсветкой +/-

Начинаю реализацию.
Теперь добавлю backend endpoints для git diff. Найду подходящее место.
Добавлю git diff endpoints после changes-log.
Теперь добавлю фронтенд — таб "FILES" в деталях эксперимента и рендеринг diff.
Теперь добавлю контент для таба FILES. Найду место после PROMPT template и перед SUMMARY.
Теперь добавлю стейт для fileDiffData и методы loadFileDiff/renderDiffHtml в JS.
Теперь сбрасываю fileDiffData при закрытии/открытии эксперимента.
Теперь добавлю методы `loadFileDiff` и `renderDiffHtml`. Найду место после `loadExperiment`.
Теперь добавлю CSS стили для diff viewer.
Теперь запущу smoke-тесты.
Теперь проверю HTML баланс тегов.
Все теги сбалансированы. Давайте проверим, что tests проходят.
Это pre-existing ошибка (не связана с моими изменениями). Проверю остальные тесты.
Тесты — pre-existing issue (0 collected). Мои изменения не затрагивают тесты. Проверю, что endpoint логика корректна.
Git diff работает корректно. Теперь давайте проверим endpoint через быстрый тест FastAPI.
Есть два бага: 1) `stdout` может быть `None` на Windows, 2) Нужно указать `encoding='utf-8'` в subprocess.run. Исправлю.
Повторю тест.
Все endpoints работают корректно:
- `/api/git/diff` — 200, 15 файлов, 165K chars diff
- `/api/git/diff/ui/server.py` — 200, has changes, ext=py
- Path traversal — 404 (безопасно)

Проверю синтаксис и HTML баланс ещё раз.
Всё чисто. Теперь обновлю накопленный контекст и записываю отчёт.
Теперь обновлю last_experiment.md.
Запишу урок о Windows subprocess encoding в память.
---

## Experiment Report

**Number:** 27
**Title:** Git Diff Viewer for Modified Files
**Type:** Feature
**Goal:** "просмотр изменений файлов" + "diff-viewer" (цель 1, фокусная область UI/UX)
**Target:** `ui/server.py` (backend) + `ui/static/index.html` (frontend)
**Complexity Impact:** +0 файлов
**Files Modified:** `ui/server.py`, `ui/static/index.html`

### Results

**What was done:**
1. **Backend `/api/git/diff`** — возвращает git diff (unstaged + staged) для рабочего дерева. Парсит список файлов из `--stat`.
2. **Backend `/api/git/diff/{filepath:path}`** — diff для конкретного файла. Path traversal защита.
3. **FILES tab** — новый таб в аккордеоне деталей эксперимента (OUTPUT, PROMPT, **FILES**, SUMMARY). Показывает список изменённых файлов → клик → git diff.
4. **Diff renderer** — `renderDiffHtml()` с цветовым кодированием: зелёные добавления (+), красные удаления (-), голубые hunk headers (@@), фиолетовые file headers.
5. **Windows encoding fix** — `subprocess.run` с `encoding="utf-8", errors="replace"`.

**Working:** yes
**Tests:** skipped (UI/backend feature, tested via TestClient manually)

### Decision

**Result:** KEEP
**Reason:**
1. Прямой ответ на goal "просмотр изменений файлов" и focus area "diff-viewer"
2. 0 новых файлов, 0 новых зависимостей
3. Endpoints протестированы через TestClient — 200 OK
4. Path traversal защита работает
5. Интеграция в существующий UI через таб в experiment detail

**Next:**
- Syntax highlighting внутри diff-строк (переиспользовать highlightCode)
- Live diff refresh во время экспериментов
- Expand/collapse для списка файлов

>>>EXPERIMENT_COMPLETE<<<