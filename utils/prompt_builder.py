#!/usr/bin/env python3
"""
Prompt Builder — generates agent prompts with accumulated context.

Extracted from autoresearch.py to reduce monolith size.
Responsible for: reading project memory, building context sections,
formatting the final prompt for Claude CLI.
"""

import random
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional

# CONFIG_DIR relative to this file (utils/prompt_builder.py → ../config)
AUTORESEARCH_HOME = Path(__file__).parent.parent.resolve()
CONFIG_DIR = AUTORESEARCH_HOME / "config"

# Re-export from experiment_io for convenience
from experiment_io import _read_experiment_history  # noqa: F401


# =============================================================================
# SEED CHAOS — creative nudges for experiment diversity
# =============================================================================

SEED_CHALLENGES = [
    "Посмотри на проект глазами нового контрибьютора. Что первое бросается в глаза? Что непонятно или неудобно?",
    "Найди самый старый файл в проекте. Зачем он нужен? Можно ли его упростить или удалить?",
    "Проверь TODO/FIXME/HACK комментарии. Есть ли устаревшие? Можно ли что-то из них исправить сейчас?",
    "Найди дублирование кода или логики. Можно ли объединить 2+ похожих функции/модуля?",
    "Проверь обработку ошибок. Что происходит при неверном вводе, пустых данных, неожиданных ситуациях?",
    "Найди код, который сложно читать или понимать. Как его можно упростить без изменения поведения?",
    "Проверь, все ли функции/методы используются. Есть ли мёртвый код, который можно удалить?",
    "Посмотри на тесты (если есть). Покрывают ли они важные сценарии? Не хватает ли edge cases?",
    "Подумай о производительности. Есть ли очевидные узкие места? Лишние аллокации, N+1 запросы?",
    "Найди самый длинный файл или функцию. Можно ли разбить на более мелкие, понятные части?",
    "Проверь документацию/комментарии. Есть ли неточности или устаревшая информация?",
    "Посмотри на API/CLI интерфейс проекта. Удобно ли им пользоваться? Какие ошибки может совершить пользователь?",
]


# =============================================================================
# MEMORY READING
# =============================================================================

def read_last_entries(path: Path, max_entries: int = 10, max_bytes: int = 32768) -> str:
    """Читает записи помеченные [CRITICAL] или [IMPORTANT] с лимитом по размеру.

    Приоритет: [CRITICAL] > [IMPORTANT]. Записи добавляются до лимита max_bytes.
    Каждая запись обрезается до 120 строк чтобы сохранить контекст.

    Args:
        path: Путь к файлу памяти (lessons.md, patterns.md, architecture.md)
        max_entries: Максимум записей (по умолчанию 10)
        max_bytes: Лимит общего размера в байтах (по умолчанию 32KB)

    Returns:
        str: Содержимое помеченных записей в рамках лимита
    """
    if not path.exists():
        return ""

    content = path.read_text(encoding="utf-8")

    # Разбиваем по ## заголовкам
    lines = content.split("\n")
    entries = []
    current_entry = []
    current_header = ""

    for line in lines:
        if line.startswith("## "):
            if current_entry:
                entries.append({"header": current_header, "content": "\n".join(current_entry)})
            current_header = line
            current_entry = [line]
        else:
            if current_entry is not None:
                current_entry.append(line)

    if current_entry:
        entries.append({"header": current_header, "content": "\n".join(current_entry)})

    # Фильтруем и сортируем: CRITICAL первые, затем IMPORTANT
    critical = [e for e in entries if "[CRITICAL]" in e["header"]]
    important = [e for e in entries if "[IMPORTANT]" in e["header"]]
    marked = critical + important

    # Собираем с лимитами
    result_parts = []
    total_bytes = 0
    count = 0
    max_lines_per_entry = 120

    for entry in marked:
        if count >= max_entries:
            break

        # Обрезаем длинные записи
        entry_lines = entry["content"].split("\n")
        if len(entry_lines) > max_lines_per_entry:
            entry_text = "\n".join(entry_lines[:max_lines_per_entry]) + "\n[...truncated]"
        else:
            entry_text = entry["content"]

        entry_size = len(entry_text.encode("utf-8"))

        if total_bytes + entry_size > max_bytes and result_parts:
            break  # Лимит по размеру (но хотя бы одну запись включаем)

        result_parts.append(entry_text)
        total_bytes += entry_size
        count += 1

    return "\n".join(result_parts)


# =============================================================================
# PROMPT GENERATION
# =============================================================================

def _format_completed_goals(goals: list) -> str:
    """Форматирует завершённые цели с заголовком, или пустую строку если нет."""
    if not goals:
        return ""
    lines = "\n".join(f"- {g}" for g in goals)
    return f"### Выполненные цели (НЕ повторять)\n{lines}\n"

def build_agent_prompt(config, iteration: int, total: int) -> str:
    """Строит промпт для AI-агента.

    Args:
        config: ProjectConfig instance with project_dir and config dict
        iteration: Current experiment number
        total: Total experiments count

    Returns:
        str: Complete prompt for Claude CLI
    """
    # Загружаем шаблон
    template_file = CONFIG_DIR / "default_prompt.md"
    if template_file.exists():
        template = template_file.read_text(encoding="utf-8")
    else:
        template = """# AutoResearch Experiment {iteration}/{total}

Вы — автономный исследователь, улучшающий проект "{project_name}".

## Проект

{description}

## Цели

{goals}

## Технический стек

{tech_stack}

## Задача на эксперимент {iteration}

Проведите исследование и улучшение проекта. Результаты сохраните в:
- `.autoresearch/experiments/accumulation_context.md` — полный контекст
- `.autoresearch/experiments/changes_log.md` — лог изменений

## Формат отчёта

В конце эксперимента предоставьте отчёт:

```markdown
## Experiment Report

**Number:** {iteration}
**Title:** [краткое название]
**Hypothesis:** [что тестировали]
**Files Modified:** [список]
**Changes Made:** [описание]
**Results:** [результаты]
**Notes for Next:** [заметки для следующей итерации]

>>>EXPERIMENT_COMPLETE<<<
```

## Ограничения

{constraints}

Начинайте эксперимент {iteration}.
"""

    # Читаем последний эксперимент (accumulation_context.md только для человека, не для агента!)
    last_experiment = ""
    project_dir = config.project_dir
    exp_dir = project_dir / ".autoresearch" / "experiments"

    if exp_dir.exists():
        last_exp_file = exp_dir / "last_experiment.md"
        if last_exp_file.exists():
            last_experiment = last_exp_file.read_text(encoding="utf-8")

    # Заполняем переменные
    cfg = config.config
    context = {
        "iteration": iteration,
        "total": total,
        "project_name": cfg.get("name", "Unknown"),
        "description": cfg.get("description", "Нет описания"),
        "goals": "\n".join(f"- {g}" for g in cfg.get("goals", [])) or "- Не указаны",
        "completed_goals": _format_completed_goals(cfg.get("completed_goals", [])),
        "tech_stack": ", ".join(cfg.get("tech_stack", [])) or "Не определён",
        "constraints": "\n".join(f"- {c}" for c in cfg.get("constraints", [])) or "- Нет",
        "focus_areas": "\n".join(f"- {a}" for a in cfg.get("focus_areas", [])) or "- Исследуй любые улучшения",
        "agent_instructions": cfg.get("agent_instructions", ""),
    }

    prompt = template.format(**context)

    # Добавляем контекст для агента (НЕ весь accumulation_context - он для человека!)
    memory_dir = project_dir / ".claude" / "memory"

    # Читаем память проекта с приоритетами (только [CRITICAL] и [IMPORTANT])
    project_memory = ""
    if memory_dir.exists():
        lessons = read_last_entries(memory_dir / "lessons.md", max_entries=15, max_bytes=32768)
        patterns = read_last_entries(memory_dir / "patterns.md", max_entries=12, max_bytes=32768)
        architecture = read_last_entries(memory_dir / "architecture.md", max_entries=10, max_bytes=20480)

        if lessons or patterns or architecture:
            project_memory += "\n\n## Память проекта\n\n"

            if lessons:
                project_memory += f"### Lessons Learned\n{lessons}\n\n"

            if patterns:
                project_memory += f"### Patterns Found\n{patterns}\n\n"

            if architecture:
                project_memory += f"### Architecture Decisions\n{architecture}\n\n"

    # Добавляем ТОЛЬКО последний эксперимент (не весь лог!)
    if last_experiment:
        project_memory += "## Последний эксперимент\n\n"
        project_memory += last_experiment + "\n\n"

    # Добавляем компактную историю последних экспериментов (для diversity awareness)
    history = _read_experiment_history(exp_dir, max_entries=5)
    if history:
        project_memory += "## История экспериментов\n\n"
        project_memory += history + "\n\n"

    # Добавляем текущее состояние проекта (git status)
    try:
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            check=False
        )
        if result.stdout.strip():
            project_memory += "## Текущее состояние проекта\n\n"
            project_memory += "### Изменённые файлы (git status)\n```\n"
            project_memory += result.stdout.strip()
            project_memory += "\n```\n\n"
    except (subprocess.SubprocessError, OSError, FileNotFoundError):
        pass

    if project_memory:
        prompt += project_memory

    # Seed chaos: random creative nudge to prevent repetitive experiments
    seed = random.choice(SEED_CHALLENGES)
    prompt += f"\n## Случайный Seed (Разнообразие)\n\n{seed}\n"

    return prompt
