# ProjectEvolve - Краткая инструкция

## ⚠️ Важно: Разрешения Claude Code

ProjectEvolve требует Claude Code с соответствующими разрешениями.

### Режим разрешений

- ✅ **"bypass permissions on"** — Рекомендуется! Никаких подтверждений не нужно
- ⚠️ **Другие режимы** — Могут требоваться подтверждения для Edit, Read, Write и др.
- ❌ **Риск:** Агент может зависнуть в ожидании одобрения инструментов

### Необходимые инструменты (если не bypass)

**Основные:** Edit, Read, Write, Glob, Grep
**Дополнительные:** Bash (для Quality Loop), Agent

### Рекомендуемые настройки

**Вариант 1: Bypass (Лучше)**
```json
{
  "permissionMode": "bypass"
}
```

**Вариант 2: Auto-Approve**
```json
{
  "permissionMode": "auto",
  "alwaysAllowTools": ["Edit", "Read", "Write", "Glob", "Grep"]
}
```

**Если агент завис:** Проверьте, ожидает ли permission prompt, и одобрьте инструмент.

---

## Быстрый старт

### 1. Запуск на любом проекте

```bash
# Краткая форма (позиционные аргументы)
python autoresearch.py . 10 5                    # 10 итераций, 5 минут пауза
python autoresearch.py /path/to/project 20 2          # 20 итераций, 2 минуты пауза

# Полная форма (именованные аргументы)
python autoresearch.py --project . --iter 10 --timeout 5

# Автоопределение следующего номера (если output_1.md есть → начнёт с 2)
python autoresearch.py . 10 1

# Интерактивный режим (задаст вопросы)
python autoresearch.py --project /path/to/your/project
```

### 2. Использование bat-файла (Windows)

```batch
REM Запуск в текущем проекте
autoresearch.bat

REM 10 итераций
autoresearch.bat . 10

REM 10 итераций, интервал 2 минуты
autoresearch.bat . 10 2

REM Указать другой проект
autoresearch.bat F:/IdeaProjects/spec-kit 5 1
```

## Quality Loop - Встроенная система самотестирования

ProjectEvolve включает встроенную систему Quality Gate для автоматической оценки изменений:

### Запуск Quality Loop

```bash
# Автономная проверка качества
python F:/IdeaProjects/autoresearch/utils/quality_loop.py --project /path/to/project

# Кастомные пороги
python utils/quality_loop.py --project . --threshold-a 0.7 --threshold-b 0.85

# JSON вывод
python utils/quality_loop.py --project . --json
```

### Что делает Quality Loop

1. **Автодетект** — автоматически находит команды для тестов (npm test, pytest, cargo test, etc.)
2. **Запускает** — выполняет тесты, сборку, линтинг
3. **Оценивает** — вычисляет score (0.0-1.0)
4. **Решает** — KEEP или DISCARD на основе порогов

### Пример вывода

```
========================================================================
Iteration 1/2 | Phase A
Threshold: 0.70
========================================================================

Score: 0.80 / 0.70 | ✓ PASS

  ✓ tests: 1 (2.3s)
  ✓ build: 1 (5.1s)

========================================================================
Quality Loop - Summary
========================================================================
Final Score: 0.80
Phase: A
Iterations: 1
Stop Reason: threshold_reached

Decision: ✓ KEEP - Score improved, all checks passed
========================================================================
```

### Конфигурация Quality

Файл `.autoresearch/quality.yml` создаётся автоматически:

```yaml
metrics:
  tests:
    enabled: true
    command: ""  # Автодетект
  build:
    enabled: false
    command: ""

thresholds:
  a:
    min_score: 0.7
    required_checks: ["tests"]
  b:
    min_score: 0.85
    required_checks: ["tests", "build"]
```

## Что создаётся в проекте

```
your-project/
├── .autoresearch/
│   ├── .autoresearch.json        # Конфигурация
│   ├── quality.yml               # Quality gate конфигурация
│   ├── experiments/
│   │   ├── prompt_1.md
│   │   ├── output_1.md
│   │   ├── accumulation_context.md
│   │   ├── changes_log.md
│   │   └── summary.json
│   └── logs/
│       └── autoresearch.log
```

## Примеры использования

### Тестирование на spec-kit

```bash
# Быстрый тест: 3 эксперимента, 1 минута интервал
python F:/IdeaProjects/autoresearch/autoresearch.py --project F:/IdeaProjects/spec-kit --iter 3 --timeout 1
```

### Долгий сеанс исследования

```bash
# 50 экспериментов, интервал 10 минут
python F:/IdeaProjects/autoresearch/autoresearch.py --project . --iter 50 --timeout 10
```

## Конфигурация проекта

При первом запуске ProjectEvolve задаст вопросы:

```
ProjectEvolve - First Time Setup
======================================================================

Название проекта: My Project
Краткое описание: Web application

Цели проекта (по одной на строке):
  > Improve performance
  > Add tests
  > Update docs
  > [Enter]

Ограничения (опционально):
  > Don't change API
  > [Enter]

✓ Конфигурация сохранена!
```

## Файл конфигурации (пример)

```json
{
  "name": "My Project",
  "description": "Web application",
  "goals": [
    "Improve performance",
    "Add tests",
    "Update docs"
  ],
  "constraints": [
    "Don't change API"
  ],
  "tech_stack": ["Python", "FastAPI"],
  "focus_areas": ["performance", "testing"]
}
```

## Советы

1. **Начните с теста** — запустите 2-3 эксперимента для проверки
2. **Проверьте логи** — `.autoresearch/logs/autoresearch.log`
3. **Читайте отчёты** — `.autoresearch/experiments/output_*.md`
4. **Git branches** — каждый запуск создаёт backup branch
5. **Настраивайте интервал** — сложные проекты требуют больше времени
6. **Используйте Quality Loop** — запускайте `quality_loop.py` для быстрой проверки

## Troubleshooting

### Claude CLI не найден

```bash
npm install -g @anthropic-ai/claude-code
```

### Python не найден

Установите Python 3.10+ и добавьте в PATH.

### Эксперименты зависают

Увеличьте интервал между итерациями.

### Неправильный контекст

Используйте `--reconfigure` для перенастройки проекта.

### PyYAML не установлен

```bash
pip install pyyaml
```

---

## Изолированный запуск на других проектах

### Важно: Полная изоляция

AutoResearch работает **изолированно** от самого проекта autoresearch. Все файлы создаются в **целевом проекте**.

### Структура файлов в целевом проекте

```
your-project/                          # Целевой проект (например, bybittrader)
├── .autoresearch/                     # Создаётся AutoResearch
│   ├── experiments/
│   │   ├── prompt_1.md               # Промпт для эксперимента 1
│   │   ├── output_1.md               # Ответ AI агента
│   │   ├── prompt_2.md               # Промпт для эксперимента 2
│   │   ├── output_2.md               # Ответ AI агента
│   │   ├── last_experiment.md        # Последний эксперимент
│   │   ├── accumulation_context.md   # Полная история
│   │   └── summary.json              # Все результаты
│   ├── logs/
│   │   └── autoresearch.log          # Логи выполнения
│   └── .autoresearch.json            # Конфигурация проекта
├── .claude/
│   └── memory/
│       ├── lessons.md                # Уроки (с метками приоритета)
│       ├── patterns.md               # Паттерны (с метками приоритета)
│       └── architecture.md           # Архитектура (с метками приоритета)
└── [ваши файлы проекта...]

Git ветки: autoresearch-YYYYMMDD-HHMMSS  # Создаются в целевом проекте
```

### ⚠️ Важно: Нельзя запускать из Claude Code

**Проблема:** AutoResearch использует Claude CLI, который **не может запускаться изнутри сессии Claude Code** (nested session protection).

**Решение:** Запускайте из обычного терминала.

```bash
# ❌ НЕ ЗАПУСКАЙТЕ из Claude Code
# Это не сработает - nested session protection

# ✅ ЗАПУСКАЙТЕ из обычного терминала
cd F:/IdeaProjects/autoresearch
python autoresearch.py --project F:/IdeaProjects/bybittrader --iter 10
```

### Пример: BybitTrader

Тестовый запуск на `F:\IdeaProjects\bybittrader`:

```bash
cd F:/IdeaProjects/autoresearch
python autoresearch.py --project F:/IdeaProjects/bybittrader --iter 1 --timeout 0
```

**Результаты:**
- ✅ `.autoresearch/` создан в bybittrader (НЕ в autoresearch!)
- ✅ Git ветка `autoresearch-20260313-013849` создана в bybittrader
- ✅ Конфигурация `.autoresearch.json` создана
- ✅ Промпт `prompt_1.md` сгенерирован
- ❌ Claude CLI заблокирован (nested session protection)

### Проверка изоляции

После запуска AutoResearch:

```bash
# Проверить целевой проект
ls F:/IdeaProjects/myproject/.autoresearch/experiments/
# Вывод: prompt_1.md, output_1.md, и т.д.

cd F:/IdeaProjects/myproject
git branch
# Вывод: * autoresearch-20260313-013849

# Проверить проект autoresearch (должен быть без изменений)
git -C F:/IdeaProjects/autoresearch status
# Вывод: clean (нет изменений)
```

### Быстрая настройка без интерактивного режима

Если интерактивный режим не работает, создайте `.autoresearch.json` вручную:

```json
{
  "name": "ProjectName",
  "description": "Project description",
  "goals": ["Goal 1", "Goal 2"],
  "constraints": ["Constraint 1"],
  "tech_stack": ["Python", "FastAPI"],
  "focus_areas": ["Performance", "Security"]
}
```

---

## Багфиксы в этой версии

- ✅ **Исправлен `args.start_from`** - был баг: проверял `start_from` вместо `args.start_from`
- ✅ **Исправлен `is_configured()`** - теперь загружает конфиг перед проверкой
- ✅ **Исправлен шаблон `default_prompt.md`** - убраны недопустимые плейсхолдеры
- ✅ **Добавлен пункт "7. UX и Документация"** в default_prompt.md

