Начинаю эксперимент 26. Сначала прочитаю контекст проекта.
Файл большой. Прочитаю ключевые секции — текущие темы, настройки, и чат.
Проверю API и бэкенд для понимания доступных данных.
Посмотрю детальный вид эксперимента и секцию experiments.
Понял контекст. Сейчас реализую Experiment 26 — **сравнение экспериментов side-by-side**. Это прямо двигает цель 1 ("сравнение экспериментов side-by-side") и отмечено в Notes for Next экспериментов 25, 24, 22.
Теперь прочитаю секции state и методов для экспериментов.
Отлично, теперь у меня полная картина. Приступаю к реализации.
## Experiment 26: Experiment Comparison Side-by-Side

**Type:** Feature
**Goal:** UI/UX улучшения — сравнение экспериментов side-by-side
**Target:** Experiments page (ui/static/index.html)
**Complexity Impact:** +0 файлов

Добавляю:
1. Состояние `compareMode`, `compareExps[]`, `compareData{}`
2. Кнопки Compare Mode в хедере экспериментов
3. Чекбоксы в строках экспериментов (видны в compare mode)
4. Кнопку "COMPARE (N)" при выборе 2 экспериментов
5. Side-by-side comparison view

Шаг 1 — добавляю state переменные:
Шаг 2 — добавляю Compare Mode toggle и кнопку в хедере экспериментов:
Шаг 3 — добавляю чекбоксы в строки экспериментов и модифицирую клик:
Шаг 4 — добавляю side-by-side comparison view. Он должен быть ПОСЛЕ списка экспериментов, но ПЕРЕД pagination:
Вставляю comparison view после списка экспериментов, перед pagination:
Шаг 5 — добавляю JS методы: `toggleCompare()`, `runCompare()`, `compareFields()`, `compareSharedFiles()`:
Теперь проверю баланс HTML тегов и запущу smoke-тест.
Есть mismatch span (162/161). Проверю, не pre-existing ли это.
Mismatch span — pre-existing (88/87 в оригинале), не мой баг. Мой код добавил 74/74, пропорция сохранена.

Проверю JS на синтаксические ошибки:
Проверю лучше с учётом строковых литералов:
Все теги сбалансированы (div 308/308, template 37/37, script 12/12, select 2/2, option 11/11, button 54/54). Span mismatch pre-existing (88/87 в оригинале).
Обновляю контекст эксперимента:
Обновляю accumulation_context.md:
## Experiment Report

**Number:** 26
**Title:** Experiment Comparison Side-by-Side
**Type:** Feature
**Goal:** UI/UX улучшения — сравнение экспериментов side-by-side
**Target:** Experiments page (`ui/static/index.html`)
**Complexity Impact:** +0 файлов
**Files Modified:** `ui/static/index.html`

### Results

**What was done:**
1. **Compare Mode toggle** — кнопка `[COMPARE]` в хедере включает режим выбора экспериментов для сравнения
2. **Checkboxes** — визуальные чекбоксы в строках (макс 2 эксперимента)
3. **COMPARE (2) button** — загружает данные обоих экспериментов параллельно через `Promise.all`
4. **Side-by-side comparison view** — панель с полями Title/Type/Score/Decision/Date + индикаторы DIFF/SAME, Files Modified с подсветкой общих файлов (SHARED_FILES), Notes for Next. Цветовое кодирование: violet (левый) / cyan (правый)
5. **CLEAR/CLOSE** — очистка выбора и закрытие панели

**Working:** yes
**Tests:** smoke only (HTML balance 308/308 div, 37/37 template, server import OK)

### Decision

**Result:** KEEP
**Reason:**
1. Прямой ответ на goal 1 "сравнение экспериментов side-by-side"
2. 0 новых файлов, 0 новых зависимостей — только index.html
3. Минимальное изменение: 4 state поля + 4 метода + HTML template
4. Параллельная загрузка данных через Promise.all
5. Индикаторы DIFF/SAME + shared files подсветка

**Next:**
- File change viewer (git diff per experiment)
- Quality trend per experiment type (colored lines)

>>>EXPERIMENT_COMPLETE<<<