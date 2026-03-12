# AutoResearch - Краткая инструкция

## Быстрый старт

### 1. Запуск на любом проекте

```bash
# Интерактивный режим (задаст вопросы)
python F:/IdeaProjects/autoresearch/autoresearch.py --project /path/to/your/project

# Быстрый запуск с параметрами
python F:/IdeaProjects/autoresearch/autoresearch.py --project /path/to/project --iter 10 --timeout 5

# Только настройка без запуска
python F:/IdeaProjects/autoresearch/autoresearch.py --project /path/to/project --configure
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

## Что создаётся в проекте

```
your-project/
├── .autoresearch/
│   ├── .autoresearch.json        # Конфигурация
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

При первом запуске AutoResearch задаст вопросы:

```
AutoResearch - First Time Setup
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
