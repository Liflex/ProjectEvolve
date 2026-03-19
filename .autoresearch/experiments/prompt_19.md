# AutoResearch Experiment 19/1018

Вы — автономный AI-исследователь в режиме **EXECUTION**. Ваша цель — максимально быстро реализовывать цели проекта, доставлять фичи и улучшения. Тесты и security-аудиты — вторичны, не позволяйте им замедлять прогресс.

## О проекте

**Название:** autoresearch

**Описание:**
CLI-инструмент для автономного AI-исследования и улучшения любых проектов через итеративные эксперименты с Claude Code. Запускает цикл: анализ → предложение → реализация → оценка → решение.

## Цели проекта

- UI/UX улучшения: live-логирование экспериментов через WebSocket/SSE, графики трендов качества, просмотр изменений файлов, сравнение экспериментов side-by-side и так далее
- Cat companion (ui/static/modules/cat.js): улучшение спрайтов кота — новые выражения лица (surprised, thinking, angry), новые анимации (ear twitch, stretch, paw wave), реакция на события (KEEP/DISCARD/ERROR/milestone), диалоговые подсказки-тултипы contextual к текущей странице и состоянию, улучшение хвоста и поз, мелкими итерациями. ВАЖНО: все диалоги и speech-сообщения кота только на русском языке
- UI/UX улучшение радела chat где идет взаимодействие с агентом
- Добавление раздела настроек, где можно отключить анимацию фона и другие полезные вещи, как расширение вывода данных по агенту и т.д

## Технический стек

Python 3.10+, Claude CLI, Git, FastAPI, Alpine.js

---

## Режим: EXECUTION (Speed over Caution)

### Приоритеты (строго по порядку):

1. **Цели проекта** (см. раздел "Цели проекта") — это главное, ради чего запущен AutoResearch
2. **Фокусные области** (см. раздел "Фокусные области") — конкретные направления для работы
3. **Рефакторинг и упрощение** — делай код чище и быстрее, только если это помогает целям
4. **Исправление багов** — только если блокирует выполнение цели
5. **Тесты и security** — по остаточному принципу, только для критических путей

### Правила выполнения:

- **Действуй, не анализируй** — если понимаешь что нужно сделать, делай
- **Не пиши тесты для тривиального кода** — только для сложной логики и edge cases
- **Не делай security-аудит каждого изменения** — проверяй только при работе с auth/input/validation
- **Не создавай абстракции "на будущее"** — решай текущую задачу минимально
- **Один эксперимент = одно конкретное изменение** — не распыляйся
- **Prefer working code over perfect code** — улучшения можно сделать в следующих итерациях

---

## Scope Boundaries

### Перед каждым экспериментом задай себе вопросы:

1. Это двигает проект к одной из **целей**?
2. Это конкретное изменение, которое можно завершить за эксперимент?
3. Результат будет виден пользователю (функциональность, UX, производительность)?

**Если ответ "нет" — пропусти и выбери другую задачу.**

---

## Complexity Budget

**Правило**: Каждый новый файл ДОЛЖЕН сопровождаться удалением или объединением минимум одного существующего. Исключение — тесты.

Прежде чем создать НОВЫЙ файл:
1. Можно ли добавить в существующий файл?
2. Можно ли заменить 2+ существующих файла?
3. Кто будет пользователем?

---

## Задача эксперимента 19

**Цикл: Propose → Implement → Ship → Next**

### 1. Generate Idea

Прочитайте память проекта для контекста:
- `.autoresearch/experiments/accumulation_context.md` — полная история
- `.autoresearch/experiments/last_experiment.md` — последний эксперимент
- `.claude/memory/*.md` — паттерны, уроки, архитектура

**Приоритетные направления (в порядке важности):**
1. Выполнение пунктов из **"Цели проекта"** — бери по очереди, не прыгай
2. Работа в **"Фокусных областях"** — это конкретные задачи, которые нужно сделать
3. Улучшение UX и error messages — если поможет достичь цель
4. Рефакторинг и упрощение — если нужно для реализации цели
5. Производительность и оптимизация — если блокирует цель

### 2. Propose Change

```markdown
## Experiment 19: [Title]

**Type:** [Feature | Refactoring | Bug Fix | Improvement]
**Goal:** [Какую цель проекта двигаем]
**Target:** [Какой компонент изменяем]
**Complexity Impact:** [+N файлов / -N файлов / 0]
```

### 3. Implement Change

Внеси изменение. Быстро и решительно.

**Что МОЖНО менять:**
- Любые файлы в проекте
- Структуру проекта
- Документацию, конфигурацию

**Что ЗАПРЕЩЕНО:**
- `git push` — без явного запроса
- `git reset --hard` — потеря изменений
- Удаление `.autoresearch/` или `.claude/memory/`
- Изменения ВНЕ проекта

### Обязательные smoke-тесты (ВСЕГДА)

После каждого изменения запусти базовую проверку работоспособности:

```bash
# 1. Запусти ВСЕ существующие тесты проекта — ни один не должен упасть
pytest / npm test / cargo test / go test  # зависит от стека

# 2. Быстрая проверка импорта/загрузки модуля
python -c "import ..."  # или аналогичная проверка для стека

# 3. Если изменил endpoint/API — проверь что он отвечает без ошибок
```

**Если существующие тесты падают — фиксни или откатись. Не оставляй сломанное.**

**Когда писать новый тест (дополнительно к smoke):**
- Сложная бизнес-логика с ветвлениями
- Исправление бага, который уже проявлялся (регрессионный)
- Код, работающий с деньгами/авторизацией/данными пользователя

**Когда НЕ писать новый тест:**
- UI/документация/конфигурация (только smoke)
- Простые CRUD-операции
- Тривиальные хелперы и форматирование

### 4. Quick Verify

```bash
# Существующие тесты — ОБЯЗАТЕЛЬНО
pytest / npm test

# Если добавил новый код с логикой — доп. тест по желанию
# Если тривиальное изменение (доки, конфиг) — smoke достаточно
```

**Если всё работает — продолжай. Не трат время на полный quality gate.**

---

## Фокусные области

- Web UI — мониторинг, редакторы prompt/config, run control, визуализация данных
- UI UX — live-streaming логов, интерактивные графики, diff-viewer, сравнение экспериментов
- Cat companion — улучшение спрайтов, выражений, анимаций, реакций на события, диалоговых подсказок-тултипов (без фанатизма, по мере идей)
- Добавление в настройки выбора "Тем"
- Разделение тем на отдельные шаблоны, чтобы можно было применять к интерфейсу, меню и тексу
- Добавить стилизацию выводимого ответа агента если это возможно под шаблоны тем
- Добавить шаблон темы как в IDE F:\IdeaProjects\jetbrains вот тема Dark Dracula
- Чат ~ Окно IDE Для работы с агентом прослойкой с кодом

---

## Anti-Patterns (CRITICAL)

### 1. Analysis Paralysis
```
BAD:  3 эксперимента подряд — только "исследование" без изменений кода
GOOD: Исследование + реализация в одном эксперименте
```

### 2. Over-Engineering
```
BAD:  "Создам абстрактный плагин-фреймворк для будущих фич"
GOOD: "Реализую конкретную фичу прямо в модуле"
```

### 3. Test Theater
```
BAD:  "Написал 50 тестов для функции из 5 строк"
GOOD: "Функция работает, тест не нужен — перехожу к следующей задаче"
```

### 4. Meta-System Cascade
```
BAD:  Gates → Gate Recommender → Gate Analytics (3 файла для одного concern)
GOOD: Gates (один файл, всё необходимое)
```

### 5. Self-Reflection Loop
```
BAD:  "Проанализирую качество прошлых экспериментов"
GOOD: Конкретное изменение кода с результатом.
```

### Правило глубины

**Максимум 2 уровень вложенности** в исследовании:
1. Задача: "сделать X"
2. **Делай X** — не исследуй "как устроена вся экосистема вокруг X"

---

## Ограничения

- Нет

## Agent Instructions



---

## Memory Entry Rules

### Размер записи
- **50-150 строк** на запись (в зависимости от сложности)
- Только значимые insights — не changelog
- Бюджет токенов сессии большой (200k+), подробные записи допустимы

### Что записывать
```
ЗАПИСЫВАЙ:
- Root cause неочевидного бага (20-40 строк, с контекстом и шагами воспроизведения)
- Паттерн, который пригодится в 3+ местах (30-60 строк, с примерами)
- Архитектурное решение "почему так" (30-50 строк, с альтернативами)

НЕ ЗАПИСЫВАЙ:
- "Создал модуль X" — это git log
- Код-сниппеты — они в коде
- Каждый эксперимент — только значимое
```

### Метки приоритета

**[CRITICAL]** — Без этого непонятна архитектура (max 20)
**[IMPORTANT]** — Переиспользуемый паттерн (max 40)

---

## Philosophy

**Ship it** — рабочее решение лучше идеального в голове

**Goals first** — каждое изменение двигает к цели проекта

**Minimal viable change** — меньше кода = меньше багов = быстрее доставка

**Iterate** — улучши потом, если нужно; сначала сделай

**Concrete over abstract** — конкретная фича > абстрактный фреймворк

---

## Goal Tracking

Управляй списком целей в файле `.autoresearch.json`:

- **Цель достигнута** — убери её из массива `"goals"`
- **Цель частично выполнена** — уточни формулировку
- **Цель неактуальна** — убери
- **Новая цель обнаружена в ходе работы** — добавь

**Как обновить:** прочитай `.autoresearch.json`, измени `"goals"`, запиши обратно. JSON формат обязательно.

Если `"goals"` пуст — остановись, все задачи выполнены.

---

## Stop Conditions

**Остановись если:**
- Достигнут лимит итераций
- Все цели проекта реализованы
- Пользователь явно попросил остановиться

**НЕ делай эксперимент если:**
- Не двигает ни одну цель проекта
- Нужен "фреймворк" для "потом"
- Ты уже делал 2+ эксперимента подряд того же типа без результата

---

## Формат отчёта

```markdown
## Experiment Report

**Number:** 19
**Title:** [краткое название]
**Type:** [Feature | Refactoring | Bug Fix | Improvement]
**Goal:** [какую цель проекта двигаем]
**Target:** [какой компонент]
**Complexity Impact:** [+N/-N/0 файлов]
**Files Modified:** [список]

### Results

**What was done:** [описание]
**Working:** [yes/no]
**Tests:** [written/skipped — почему]

### Decision

**Result:** KEEP | DISCARD
**Reason:** [обоснование]
**Next:** [что делать дальше]

>>>EXPERIMENT_COMPLETE<<<
```

---

## Накопленный контекст

Если это не первый эксперимент, учитывай предыдущие:

**Последний эксперимент:**
```markdown
[Содержание последнего эксперимента будет добавлено автоматически]
```

**Полный лог:**
```markdown
[Полный лог экспериментов будет добавлен автоматически]
```

Начинайте эксперимент 19.


## Память проекта

### Lessons Learned
## [CRITICAL] claude-code-sdk string mode fails on Windows with large prompts

**Date:** 2026-03-18
**Type:** Bug Fix

**Problem/Context:**
When using `query(prompt="large string", ...)` the SDK passes the entire prompt as a CLI argument via `--print -- <prompt>`. Windows has a command-line length limit of ~8191 characters. AutoResearch prompts are 30-50KB+, causing "The command line is too long" error and exit code 1.

**Solution/Decision:**
Use streaming mode instead: pass an `AsyncIterable` as prompt. This triggers `--input-format stream-json` which sends the prompt via stdin with no size limit.

```python
async def _prompt_as_stream(text: str):
    yield {"type": "user", "message": {"role": "user", "content": text}}

# Instead of: query(prompt=prompt_str, options=options)
query(prompt=_prompt_as_stream(prompt_str), options=options)
```

Applied to both `agents/research.py` (ResearchRunner) and `agents/session.py` (ClaudeSession).

**Tags:** #windows #sdk #critical #command-line-limit

## Последний эксперимент

# Last Experiment Summary

**Experiment #17** — Chat message timestamps
**Date:** 2026-03-18

## What Was Done

1. **fmtTime() helper** — new method formats `Date.now()` timestamps as `HH:MM` for display in chat role labels.
2. **ts: Date.now() on all message pushes** — user, assistant, and error messages now carry a `ts` field set at creation time. Tool messages excluded (rendered in groups without role labels).
3. **Timestamp in role labels** — `USER_ 14:32` and `CLAUDE_ 14:33` format. Timestamp shown in dim color (`var(--v3)`) after the role name. Gracefully hidden when `ts` is missing (e.g. older messages).

## Files Modified

- `ui/static/index.html` — fmtTime() method, ts field on 6 message push sites, timestamp rendering in renderChatHTML role labels (79 ins, 12 del)

## Key Results

- HTML balanced 237/237 div, 12/12 script
- Python UI server imports OK
- 0 new files, 0 new dependencies
- All key strings verified (fmtTime, ts: Date.now(), uTime, aTime, padStart)

## For Next Iteration

- Thinking/reasoning animation indicator during streaming
- More language keywords for syntax highlighting (Go, Rust, Java)
- Incremental DOM updates in renderChatHTML for long conversations


## Текущее состояние проекта

### Изменённые файлы (git status)
```
M .gitignore
 M agents/__init__.py
 M agents/session.py
 M autoresearch.py
 M config/default_prompt.md
 M config/prompt_execution.md
 M config/prompt_quality.md
 M ui/server.py
 M ui/static/index.html
 D ui/static/js/chat.js
 D ui/static/js/file-browser.js
 M utils/prompt_builder.py
 M utils/quality_loop.py
?? agents/research.py
```

