#!/usr/bin/env python3
"""
AutoResearch - Autonomous AI-Powered Research and Project Improvement System

Universal tool for running AI agent on any project for autonomous research,
improvement, and self-development.

Cross-platform support: Windows, Linux, macOS
See INSTALL.md for platform-specific setup instructions.

Usage:
    python autoresearch.py                          # Interactive mode
    python autoresearch.py --project /path/to/proj  # Specify project
    python autoresearch.py --project . --iter 10    # 10 iterations
    python autoresearch.py --project . --iter 5 --timeout 2  # 2 min interval

Platform Detection:
    This script auto-detects the OS and uses appropriate commands.
    For manual setup or troubleshooting, see INSTALL.md.
"""

import os
import sys
import json
import time
import subprocess
import uuid
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

# Добавляем utils в путь
UTILS_DIR = Path(__file__).parent / "utils"
sys.path.insert(0, str(UTILS_DIR))

# =============================================================================
# CONFIG
# =============================================================================

AUTORESEARCH_HOME = Path(__file__).parent.resolve()
DEFAULT_PROJECT = Path.cwd()
DEFAULT_ITERATIONS = 10
DEFAULT_TIMEOUT = 5  # минут (пауза между экспериментами)
DEFAULT_MAX_TIME = 600  # секунд (максимальная длительность одного эксперимента, 10 минут)

# Директории
CONFIG_DIR = AUTORESEARCH_HOME / "config"
PROMPTS_DIR = AUTORESEARCH_HOME / "prompts"
UTILS_DIR = AUTORESEARCH_HOME / "utils"

# Файлы конфигурации
PROJECT_CONFIG_FILE = ".autoresearch.json"
GLOBAL_CONFIG_FILE = AUTORESEARCH_HOME / "config" / "global.json"

# =============================================================================
# LOGGING
# =============================================================================

def get_next_experiment_number(exp_dir: Path) -> int:
    """Автоматически определяет следующий номер эксперимента.

    Проверяет существующие output_N.md файлы и возвращает следующий свободный номер.

    Args:
        exp_dir: Директория с экспериментами

    Returns:
        int: Следующий номер эксперимента
    """
    if not exp_dir.exists():
        return 1

    # Ищем все output_N.md И prompt_N.md файлы
    existing = []
    for pattern in ["output_*.md", "prompt_*.md"]:
        for file in exp_dir.glob(pattern):
            match = file.stem.split("_")[1]
            try:
                num = int(match)
                existing.append(num)
            except (ValueError, TypeError):
                continue

    if not existing:
        return 1

    max_num = max(existing)
    return max_num + 1

def log(msg: str, level: str = "INFO", project_dir: Optional[Path] = None):
    """Логирование в консоль и файл."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    prefix = f"{timestamp} | {level:8s} |"
    print(f"{prefix} {msg}")

    # Лог в файл если указана директория проекта
    if project_dir:
        log_dir = project_dir / ".autoresearch" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / "autoresearch.log"

        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"{prefix} {msg}\n")

def read_last_entries(path: Path, max_entries: int = 5, max_bytes: int = 10240) -> str:
    """Читает записи помеченные [CRITICAL] или [IMPORTANT] с лимитом по размеру.

    Приоритет: [CRITICAL] > [IMPORTANT]. Записи добавляются до лимита max_bytes.
    Каждая запись обрезается до 40 строк чтобы предотвратить bloat.

    Args:
        path: Путь к файлу памяти (lessons.md, patterns.md, architecture.md)
        max_entries: Максимум записей (по умолчанию 5)
        max_bytes: Лимит общего размера в байтах (по умолчанию 10KB)

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
    max_lines_per_entry = 40

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
# CLAUDE CLI DETECTION
# =============================================================================
# See INSTALL.md for platform-specific installation instructions
# The code below auto-detects the OS and uses appropriate commands

def get_claude_command() -> str:
    """Auto-detects the command to run Claude CLI on any platform.

    Uses shutil.which() for reliable cross-platform detection:
    - Windows: Finds claude.CMD in npm global directory
    - Linux/macOS: Finds claude binary in PATH

    Returns:
        str: Command string to run Claude CLI, or "claude" as fallback
    """
    import shutil

    claude_path = shutil.which("claude")
    if claude_path:
        return claude_path

    return "claude"

def check_claude_cli() -> bool:
    """Checks if Claude CLI is installed and accessible.

    Validates by running `claude --version`.
    Works on all platforms: Windows, Linux, macOS.

    Returns:
        bool: True if Claude CLI is found and working
    """
    claude_cmd = get_claude_command()

    try:
        result = subprocess.run(
            [claude_cmd, "--version"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False
        )
        return result.returncode == 0
    except (subprocess.SubprocessError, OSError, FileNotFoundError):
        return False

# =============================================================================
# PROJECT CONFIG
# =============================================================================

class ProjectConfig:
    """Конфигурация проекта для AutoResearch."""

    DEFAULT_CONFIG = {
        "name": "",
        "description": "",
        "goals": [],
        "constraints": [],
        "tech_stack": [],
        "focus_areas": [],
        "memory_files": [],
        "context_files": []
    }

    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.config_file = project_dir / PROJECT_CONFIG_FILE
        self.config = self.DEFAULT_CONFIG.copy()

    def load(self) -> bool:
        """Загружает конфигурацию из файла."""
        if not self.config_file.exists():
            return False

        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                saved_config = json.load(f)
                self.config.update(saved_config)
            return True
        except Exception as e:
            log(f"Error loading config: {e}", "ERROR", self.project_dir)
            return False

    def save(self):
        """Сохраняет конфигурацию в файл."""
        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_file, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)

    def is_configured(self) -> bool:
        """Проверяет, настроен ли проект."""
        # Сначала загружаем конфигурацию если файл существует
        if self.config_file.exists():
            self.load()
        return bool(
            self.config_file.exists() and
            self.config.get("name") and
            self.config.get("goals")
        )

# =============================================================================
# INTERACTIVE SETUP
# =============================================================================

def run_interactive_setup(project_dir: Path) -> ProjectConfig:
    """Запускает интерактивную настройку с помощью AI."""
    log("=" * 70, project_dir=project_dir)
    log("AutoResearch - First Time Setup", project_dir=project_dir)
    log("=" * 70, project_dir=project_dir)
    log("", project_dir=project_dir)

    config = ProjectConfig(project_dir)

    # Если есть частичная конфигурация, загружаем её
    config.load()

    # Опросник через Claude CLI
    questionnaire = PROMPTS_DIR / "setup_questionnaire.md"
    setup_script = UTILS_DIR / "cli_setup.py"

    if setup_script.exists():
        # Запускаем Python скрипт настройки
        result = subprocess.run(
            [sys.executable, str(setup_script), str(project_dir)],
            cwd=AUTORESEARCH_HOME
        )
        if result.returncode == 0:
            config.load()
            return config

    # Fallback: базовая настройка
    log("Запуск базовой настройки...", project_dir=project_dir)

    print(f"\nПроект: {project_dir}")
    print("\nДавайте настроим AutoResearch для вашего проекта.\n")

    name = input("Название проекта: ").strip() or project_dir.name
    config.config["name"] = name

    desc = input("Краткое описание (одна строка): ").strip()
    if desc:
        config.config["description"] = desc

    print("\nВведите цели проекта (по одной на строку, пустая строка для завершения):")
    goals = []
    while True:
        goal = input("  Цель: ").strip()
        if not goal:
            break
        goals.append(goal)
    config.config["goals"] = goals

    print("\nВведите ограничения/оговорки (опционально, Enter для пропуска):")
    constraints = []
    while True:
        constraint = input("  Ограничение: ").strip()
        if not constraint:
            break
        constraints.append(constraint)
    config.config["constraints"] = constraints

    # Автоопределение tech stack
    tech_stack = detect_tech_stack(project_dir)
    if tech_stack:
        config.config["tech_stack"] = tech_stack
        log(f"Обнаружен tech stack: {', '.join(tech_stack)}", "INFO", project_dir)

    config.save()
    log("\nКонфигурация сохранена!", "INFO", project_dir)

    return config

def detect_tech_stack(project_dir: Path) -> List[str]:
    """Автоопределение tech stack по файлам проекта."""
    tech = []

    # Проверяем основные файлы
    files_to_check = [
        ("package.json", ["JavaScript", "TypeScript", "Node.js"]),
        ("requirements.txt", ["Python"]),
        ("pyproject.toml", ["Python"]),
        ("Gemfile", ["Ruby"]),
        ("go.mod", ["Go"]),
        ("Cargo.toml", ["Rust"]),
        ("pom.xml", ["Java", "Maven"]),
        ("build.gradle", ["Java", "Gradle"]),
        ("composer.json", ["PHP"]),
    ]

    for filename, technologies in files_to_check:
        if (project_dir / filename).exists():
            tech.extend(technologies)

    return list(set(tech))

# =============================================================================
# QUALITY GATE
# =============================================================================

def run_quality_gate(project_dir: Path) -> Dict[str, Any]:
    """Запускает Quality Gate тесты для проекта.

    Returns:
        Dict с результатами тестов:
        {
            "score": 0.85,
            "passed": True,
            "results": [...],
            "decision": "KEEP"
        }
    """
    try:
        # Импортируем QualityLoop
        from quality_loop import QualityLoop

        log("Запуск Quality Gate...", "INFO", project_dir)

        loop = QualityLoop(project_dir)
        state = loop.run(
            max_iterations=1,  # Single snapshot — just check current state
            # Используем QualityLoop defaults: threshold_a=0.7, threshold_b=0.85
            quiet=True  # Подавляем console output — log() в autoresearch.py достаточно
        )

        # Делегируем decision QualityLoop вместо кастомной логики с несовпадающими порогами
        decision_text = loop._make_decision()
        if "KEEP" in decision_text:
            decision = "KEEP"
        elif "ACCEPT" in decision_text:
            decision = "ACCEPT"
        else:
            decision = "DISCARD"

        result = {
            "score": state.score,
            "passed": state.score >= state.threshold_a,
            "phase": state.phase.value,
            "iterations": state.iteration - 1,
            "stop_reason": state.stop_reason,
            "results": [
                {
                    "name": r.name,
                    "passed": r.passed,
                    "score": r.score,
                    "duration": r.duration
                }
                for r in state.results
            ],
            "decision": decision
        }

        log(f"Quality Gate: {decision} (score: {state.score:.2f})", "INFO", project_dir)

        return result

    except ImportError as e:
        # quality_loop не доступен - возвращаем нейтральный результат
        log(f"Quality Loop module not available: {e}", "WARNING", project_dir)
        return {
            "score": 0.5,
            "passed": None,
            "decision": "MANUAL_REVIEW"
        }
    except Exception as e:
        log(f"Quality Gate error: {e}", "WARNING", project_dir)
        return {
            "score": 0.5,
            "passed": None,
            "error": str(e),
            "decision": "MANUAL_REVIEW"
        }


# =============================================================================
# PROMPT GENERATION
# =============================================================================

def build_agent_prompt(config: ProjectConfig, iteration: int, total: int) -> str:
    """Строит промпт для AI-агента."""
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
        lessons = read_last_entries(memory_dir / "lessons.md", max_entries=10, max_bytes=8192)
        patterns = read_last_entries(memory_dir / "patterns.md", max_entries=7, max_bytes=8192)
        architecture = read_last_entries(memory_dir / "architecture.md", max_entries=5, max_bytes=5120)

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

    return prompt

def _smart_truncate(text: str, max_chars: int = 1500) -> str:
    """Truncate text at the last complete line before max_chars.

    Avoids mid-sentence cuts that produce confusing partial text like
    "main() return code: `0 if s..." in last_experiment.md.
    Falls back to character-level truncation if text has no newlines.
    """
    text = text.strip()
    if len(text) <= max_chars:
        return text

    # Find the last newline before the limit
    cut_point = text.rfind('\n', 0, max_chars)
    if cut_point > max_chars // 2:
        return text[:cut_point]

    # No suitable newline — hard truncate
    return text[:max_chars]



def _classify_experiment_type(title: str) -> str:
    """Classify experiment type by title keywords.

    Used as fallback when agent doesn't explicitly report Type.
    Helps the agent enforce "don't do 3+ experiments of same type" rule.
    """
    t = title.lower()
    if any(kw in t for kw in ("fix", "bug", "crash", "nameerror", "error", "truncat", "hang")):
        return "Bug Fix"
    if any(kw in t for kw in ("security", "xss", "injection", "owasp", "path traversal", "protect")):
        return "Security"
    if any(kw in t for kw in ("add", "new", "implement", "introduce", "enable")):
        return "Feature"
    if any(kw in t for kw in ("refactor", "simplif", "clean", "extract", "consolidat", "compress")):
        return "Refactoring"
    if any(kw in t for kw in ("improve", "enhance", "optim", "align")):
        return "Improvement"
    if any(kw in t for kw in ("document", "readme", "guide")):
        return "Docs"
    return "Other"

def parse_experiment_report(output: str, iteration: int) -> Dict[str, Any]:
    """Парсит отчет эксперимента из вывода агента.

    Соответствует формату шаблона из default_prompt.md:
    **Title:** / **Hypothesis:** / **Files Modified:** / ### Results / **Notes for Next:**

    Args:
        output: Вывод Claude CLI
        iteration: Номер эксперимента

    Returns:
        Dict с данными эксперимента
    """
    import re

    title = "Untitled"
    hypothesis = ""
    files_modified = []
    results = "N/A"
    notes_next = "N/A"

    # Title
    match = re.search(r'\*\*Title:\*\*\s*(.+)', output)
    if match:
        title = match.group(1).strip()

    # Type (self-reported with heuristic fallback for backward compatibility)
    exp_type = ""
    type_match = re.search(r'\*\*Type:\*\*\s*(.+)', output)
    if type_match:
        exp_type = type_match.group(1).strip()
    else:
        exp_type = _classify_experiment_type(title)

    # Hypothesis (used as what_done — шаблон не имеет секции "What Was Done")
    # Captures multi-line text until next bold line or heading
    match = re.search(r'\*\*Hypothesis:\*\*\s*(.+?)(?=\n\*\*|\n### |\Z)', output, re.DOTALL)
    if match:
        hypothesis = match.group(1).strip()

    # Files Modified — три поддерживаемых формата:
    # 1. Inline bold: **Files Modified:** file1.py, file2.py
    # 2. Header + bullet: ### Files Modified\n- `file1.py` — desc\n- `file2.py`
    # 3. Header + inline: ### Files Modified\nfile1.py, file2.py
    files_text = ""

    # Формат 1: inline bold **Files Modified:**
    match = re.search(r'\*\*Files Modified:\*\*\s*(.+?)(?:\n###|\n\*\*[A-Z]|\Z)', output, re.DOTALL)
    if match:
        files_text = match.group(1).strip()
    else:
        # Формат 2/3: ### Files Modified (markdown header)
        match = re.search(r'### Files Modified\s*\n(.*?)(?=\n### |\Z)', output, re.DOTALL)
        if match:
            files_text = match.group(1).strip()

    if files_text:
        lines = files_text.split('\n')
        # Detect bullet list by checking if lines start with "- " or "* "
        is_bullet = any(re.match(r'\s*[-*]\s+', line) for line in lines if line.strip())
        if not is_bullet and len(lines) <= 2 and ',' in files_text:
            # Inline: "file1.py, file2.py, file3.md"
            files_modified = [f.strip() for f in files_text.split(',') if f.strip()]
        else:
            # Bullet list: "- file1.py\n- file2.py" (or fallback for multi-line)
            for line in lines:
                line = line.strip().lstrip('- *').strip()
                if line:
                    files_modified.append(line)

        # Strip markdown formatting and trailing descriptions from filenames
        cleaned = []
        for f in files_modified:
            # Strip all markdown formatting chars first
            f = re.sub(r'[`*\[\]]', '', f.strip())
            # Reject non-filename patterns (false positives from report sections)
            if re.match(r'^(Test Plan|Hypothesis|Target|Complexity|Metric|Notes for Next):', f, re.IGNORECASE):
                continue
            # Strip trailing description (after em-dash, en-dash, or long dash)
            f = re.split(r'\s*[—–]\s+', f, maxsplit=1)[0]
            # Strip trailing after "—" with spaces (Unicode dash)
            f = re.split(r'\s+-\s+', f, maxsplit=1)[0]
            f = f.strip(' ,:;')
            # Don't strip leading dots (.gitignore, .env, .autoresearch/)
            f = f.strip()
            if f and f not in ('.', 'None', 'none', 'N/A'):
                cleaned.append(f)
        files_modified = cleaned

    # Results — между ### Results и ### Decision
    match = re.search(r'### Results\s*\n(.*?)(?=\n### )', output, re.DOTALL)
    if match:
        results = _smart_truncate(match.group(1).strip(), max_chars=1500)

    # Agent's self-decision from ### Decision section
    agent_decision = ""
    match = re.search(r'\*\*Result:\*\*\s*(KEEP|DISCARD|MANUAL_REVIEW)', output)
    if match:
        agent_decision = match.group(1)

    # Notes for Next — после **Notes for Next:** до >>>EXPERIMENT_COMPLETE<<<
    match = re.search(r'\*\*Notes for Next:\*\*\s*(.*?)(?=\n>>>|$)', output, re.DOTALL)
    if match:
        notes_next = _smart_truncate(match.group(1).strip(), max_chars=1000)

    what_done = hypothesis if hypothesis else "N/A"

    return {
        "number": iteration,
        "title": title,
        "what_done": what_done,
        "files_modified": [f for f in files_modified if f][:10],
        "results": results,
        "exp_type": exp_type,
        "agent_decision": agent_decision,
        "notes_next": notes_next,
        "date": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

def _replace_entry(content: str, marker: str, new_entry: str) -> str:
    """Заменяет существующую запись эксперимента в контенте.

    Ищет marker (например '## Experiment 5 '), удаляет старую запись
    до следующего '## Experiment' (не включая) и вставляет новую.

    Note: '---' is NOT a separator — it's part of each entry format.
    Only '\n## Experiment' marks the start of the next entry.
    """
    start = content.find(marker)
    if start == -1:
        return content + new_entry

    # Находим начало следующей записи
    rest = content[start:]
    end = len(rest)
    pos = rest.find('\n## Experiment ', 1)
    if pos != -1:
        end = pos

    return content[:start] + new_entry + rest[end:]


def _append_experiment_entry(
    file_path: Path,
    header: str,
    entry: str,
    exp_number: int = None
):
    """Добавляет или обновляет запись эксперимента в лог-файл.

    Если exp_number указан и запись с таким номером уже существует —
    старая запись заменяется новой (deduplication).
    """
    marker = f"## Experiment {exp_number} " if exp_number else None

    if file_path.exists():
        content = file_path.read_text(encoding="utf-8")
        if marker and marker in content:
            content = _replace_entry(content, marker, entry)
        else:
            content += entry
    else:
        content = f"# {header}\n\n{entry}"

    file_path.write_text(content, encoding="utf-8")


def _read_experiment_history(exp_dir: Path, max_entries: int = 5) -> str:
    """Read compact experiment history from accumulation_context.md.

    Returns a markdown table with the last N experiments:
    number, type, title, quality score, and decision.
    Used by build_agent_prompt() for diversity awareness.
    """
    import re

    ctx_file = exp_dir / "accumulation_context.md"
    if not ctx_file.exists():
        return ""

    content = ctx_file.read_text(encoding="utf-8")

    # Split into experiment sections for independent score extraction
    sections = re.split(r'(?=^## Experiment \d+)', content, flags=re.MULTILINE)

    entries = []
    for section in sections:
        header_match = re.match(r'## Experiment (\d+) — (.+)', section)
        if not header_match:
            continue
        num = header_match.group(1)
        title = header_match.group(2).strip()

        # Extract explicit Type from entry or classify from title (backward compat)
        type_match = re.search(r'\*\*Type:\*\*\s*(\S+)', section)
        if type_match:
            exp_type = type_match.group(1).strip()
        else:
            exp_type = _classify_experiment_type(title)

        # Format 1: **Score:** X | **Decision:** Y (well-formed entries)
        score_match = re.search(
            r'\*\*Score:\*\*\s*([\d.]+|N/A)\s*\|\s*\*\*Decision:\*\*\s*(\w+)',
            section
        )
        if score_match:
            score, decision = score_match.group(1), score_match.group(2)
        else:
            # Format 2: **Quality Gate Score:** X ... + **Result:** KEEP (legacy format)
            score_m = re.search(r'\*\*Quality Gate Score:\*\*\s*([\d.]+)', section)
            result_m = re.search(r'\*\*Result:\*\*\s*(KEEP|DISCARD|MANUAL_REVIEW)', section)
            score = score_m.group(1) if score_m else "N/A"
            decision = result_m.group(1) if result_m else "N/A"

        entries.append((num, exp_type, title, score, decision))

    if not entries:
        return ""

    # Take last N
    entries = entries[-max_entries:]

    lines = [
        "| # | Type        | Title | Score | Decision |",
        "|---|-------------|-------|-------|----------|"
    ]
    for num, exp_type, title, score, decision in entries:
        if len(title) > 40:
            title = title[:37] + "..."
        if len(exp_type) > 12:
            exp_type = exp_type[:11] + "..."
        lines.append(f"| {num} | {exp_type:<12} | {title} | {score} | {decision} |")

    return "\n".join(lines)


def save_last_experiment_summary(project_dir: Path, experiment: Dict[str, Any]):
    """Сохраняет краткую сводку ТОЛЬКО последнего эксперимента для агента.

    Этот файл перезаписывается каждой итерацией — в контекст попадает только последний!
    """
    exp_dir = project_dir / ".autoresearch" / "experiments"
    last_exp_file = exp_dir / "last_experiment.md"

    summary = f"""# Last Experiment Summary

**Experiment #{experiment['number']}** — {experiment.get('title', 'Untitled')}
**Date:** {experiment.get('date', '')}
**Duration:** {experiment.get('duration', 0):.0f}s

## What Was Done

{experiment.get('what_done', 'N/A')}

## Files Modified

{chr(10).join(f"- {f}" for f in experiment.get('files_modified', [])) if experiment.get('files_modified') else '- None'}

## Key Results

{experiment.get('results', 'N/A')}
"""
    if experiment.get("quality_score") is not None:
        summary += f"""
## Independent Quality Gate

**Score:** {experiment['quality_score']:.2f}
**Decision:** {experiment.get('quality_decision', 'N/A')}
**Agent self-assessment:** {experiment.get('agent_decision', 'N/A')}
"""
    summary += f"""
## For Next Iteration

{experiment.get('notes_next', 'N/A')}
"""

    last_exp_file.write_text(summary, encoding="utf-8")
    log(f"Saved last_experiment.md", "DEBUG", project_dir)

def save_accumulation_context(project_dir: Path, experiment: Dict[str, Any]):
    """Добавляет эксперимент в полный лог всех экспериментов (с dedup)."""
    exp_dir = project_dir / ".autoresearch" / "experiments"

    entry = f"""
## Experiment {experiment['number']} — {experiment.get('title', 'Untitled')}

**Date:** {experiment.get('date', '')}
**Type:** {experiment.get('exp_type', 'Other')}

### What Was Done

{experiment.get('what_done', 'N/A')}

### Files Modified

{chr(10).join(f"- {f}" for f in experiment.get('files_modified', [])) if experiment.get('files_modified') else '- None'}

### Results

{experiment.get('results', 'N/A')}

### Quality Gate (Independent)
**Score:** {experiment.get('quality_score', 'N/A')} | **Decision:** {experiment.get('quality_decision', 'N/A')}

### Notes for Next

{experiment.get('notes_next', 'N/A')}

---
"""

    _append_experiment_entry(
        exp_dir / "accumulation_context.md",
        "AutoResearch Experiment Log",
        entry,
        experiment['number']
    )
    log(f"Updated accumulation_context.md", "DEBUG", project_dir)

def save_changes_log(project_dir: Path, experiment: Dict[str, Any]):
    """Добавляет запись в хронологию изменений (с dedup)."""
    exp_dir = project_dir / ".autoresearch" / "experiments"

    entry = f"""## Experiment {experiment['number']} — {experiment.get('title', 'Untitled')}

**Time:** {experiment.get('date', '')}
**Duration:** {experiment.get('duration', 0):.0f}s

**Files:** {', '.join(experiment.get('files_modified', [])) if experiment.get('files_modified') else 'None'}

**What was done:**

{experiment.get('what_done', 'N/A')}

**Results:**

{experiment.get('results', 'N/A')}

**Quality Gate:** {experiment.get('quality_score', 'N/A')} ({experiment.get('quality_decision', 'N/A')})


"""

    _append_experiment_entry(
        exp_dir / "changes_log.md",
        "AutoResearch Changes Log",
        entry,
        experiment['number']
    )
    log(f"Updated changes_log.md", "DEBUG", project_dir)

# =============================================================================
# GIT AUTO-COMMIT
# =============================================================================

def _auto_commit_experiment(project_dir: Path, experiment: Dict[str, Any]):
    """Создаёт git commit после успешного эксперимента.

    Коммитит только tracked-файлы (git add -u), чтобы не добавлять
    untracked state (.autoresearch/, .claude/, .env и т.д.).
    Новые файлы из files_modified добавляются явно после валидации.
    """
    number = experiment.get("number", "?")
    title = experiment.get("title", "Untitled")
    score = experiment.get("quality_score")
    decision = experiment.get("quality_decision", "N/A")
    is_complete = experiment.get("is_complete", True)

    try:
        # 1. Stage all modified/deleted tracked files
        subprocess.run(
            ["git", "add", "-u"],
            cwd=project_dir,
            capture_output=True,
            check=False
        )

        # 2. Stage new files explicitly listed in files_modified (with path validation)
        project_dir_resolved = project_dir.resolve()
        for f in experiment.get("files_modified", []):
            # Strip path traversal attempts and normalize
            fpath = (project_dir / f).resolve()

            # Security: reject paths outside project directory
            if not str(fpath).startswith(str(project_dir_resolved) + os.sep) and fpath != project_dir_resolved:
                log(f"Auto-commit: skipping path outside project: {f}", "WARNING", project_dir)
                continue

            if fpath.exists() and not fpath.is_dir():
                # Only add if untracked (git add -u already handles tracked files)
                rel_path = os.path.relpath(fpath, project_dir)
                ls_result = subprocess.run(
                    ["git", "ls-files", "--error-unmatch", rel_path],
                    cwd=project_dir,
                    capture_output=True,
                    check=False
                )
                if ls_result.returncode != 0:
                    subprocess.run(
                        ["git", "add", str(fpath)],
                        cwd=project_dir,
                        capture_output=True,
                        check=False
                    )

        # 3. Check if there's anything to commit
        diff_check = subprocess.run(
            ["git", "diff", "--cached", "--quiet"],
            cwd=project_dir,
            capture_output=True,
            check=False
        )
        if diff_check.returncode == 0:
            log(f"Auto-commit skipped: no changes to commit for experiment {number}", "DEBUG", project_dir)
            return

        # 4. Build commit message
        status = "complete" if is_complete else "incomplete"
        subject = f"autoresearch(exp{number}): {title}"
        body_parts = [f"Experiment: {number}/{status}"]
        if score is not None:
            body_parts.append(f"Quality Gate: {score:.2f} ({decision})")
        body = "\n".join(body_parts)

        msg = f"{subject}\n\n{body}"

        result = subprocess.run(
            ["git", "commit", "-m", msg],
            cwd=project_dir,
            capture_output=True,
            text=True,
            check=False
        )

        if result.returncode == 0:
            log(f"Auto-committed experiment {number}: {title}", "INFO", project_dir)
        else:
            log(f"Auto-commit failed for experiment {number}: {result.stderr[:200].strip()}", "WARNING", project_dir)

    except Exception as e:
        log(f"Auto-commit error: {e}", "WARNING", project_dir)


# =============================================================================
# EXPERIMENT LOOP
# =============================================================================

def run_single_experiment(config: ProjectConfig, iteration: int, total: int, max_time: int = DEFAULT_MAX_TIME) -> Dict[str, Any]:
    """Запускает один эксперимент.

    Args:
        max_time: Максимальная длительность одного эксперимента в секундах (default: 600)
    """
    project_dir = config.project_dir
    exp_dir = project_dir / ".autoresearch" / "experiments"
    exp_dir.mkdir(parents=True, exist_ok=True)

    log(f"Запуск эксперимента {iteration}/{total}", "INFO", project_dir)
    experiment_start = time.time()

    # Строим промпт
    prompt = build_agent_prompt(config, iteration, total)

    # Сохраняем промпт
    prompt_file = exp_dir / f"prompt_{iteration}.md"
    prompt_file.write_text(prompt, encoding="utf-8")

    # Проверяем размер промпта
    prompt_size = len(prompt.encode('utf-8'))
    log(f"Prompt size: {prompt_size:,} bytes ({prompt_size // 1024} KB)", "DEBUG", project_dir)

    # Запускаем Claude CLI
    claude_cmd = get_claude_command()
    output_file = exp_dir / f"output_{iteration}.md"

    try:
        # Build command args — shutil.which returns full path on all platforms
        cmd_args = [claude_cmd, "--print", "--dangerously-skip-permissions"]

        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'

        # CRITICAL: Отключаем CLAUDECODE чтобы избежать nested session check
        # Claude CLI нельзя запускать изнутри другой сессии Claude Code
        env.pop('CLAUDECODE', None)
        env.pop('CLAUDE_SESSION_ID', None)

        log(f"Running: {cmd_args}", "DEBUG", project_dir)

        # Используем subprocess.Popen для контроля над процессом
        process = subprocess.Popen(
            cmd_args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=project_dir,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=env
        )

        try:
            # communicate с timeout - возвращает (stdout, stderr)
            stdout, stderr = process.communicate(input=prompt, timeout=max_time)

            if process.returncode != 0:
                log(f"Claude CLI error (code {process.returncode}): {stderr}", "ERROR", project_dir)
                # Сохраняем даже partial output при ошибке
                if stdout.strip():
                    output_file.write_text(stdout, encoding="utf-8")
                    log(f"Partial output saved to {output_file.name}", "DEBUG", project_dir)
                return {"status": "error", "error": stderr}

            # Логируем stderr для отладки (даже при успехе)
            if stderr.strip():
                log(f"Claude CLI stderr: {stderr[:500]}", "DEBUG", project_dir)

            # Сохраняем вывод
            output_file.write_text(stdout, encoding="utf-8")

            # Проверяем маркер завершения (допускаем частичный маркер — Claude может обрезать)
            duration = time.time() - experiment_start
            if ">>>EXPERIMENT_COMPLETE" in stdout:
                log(f"Эксперимент {iteration} завершён ({duration:.0f}s)", "INFO", project_dir)
                return {"status": "success", "output": stdout, "duration": duration}
            else:
                log(f"Эксперимент {iteration} завершён без маркера ({duration:.0f}s)", "WARNING", project_dir)
                return {"status": "incomplete", "output": stdout, "duration": duration}

        except subprocess.TimeoutExpired:
            # При timeout сначала убиваем процесс, потом получаем остатки вывода
            process.kill()
            try:
                stdout, stderr = process.communicate(timeout=10)
            except (subprocess.TimeoutExpired, subprocess.SubprocessError):
                stdout, stderr = "", ""

            # ВСЕГДА сохраняем partial output при timeout
            if stdout.strip():
                output_file.write_text(stdout, encoding="utf-8")
                log(f"Partial output saved ({len(stdout)} chars) before timeout kill", "WARNING", project_dir)

            log(f"Claude CLI timeout after {max_time}s!", "ERROR", project_dir)
            log(f"Experiment {iteration} timed out - increase with --max-time if needed", "ERROR", project_dir)
            return {"status": "error", "error": f"Timeout after {max_time}s. Increase --max-time if the experiment needs more time.", "partial_output": stdout, "duration": time.time() - experiment_start}

    except KeyboardInterrupt:
        # Ctrl+C — сохраняем partial output перед завершением
        duration = time.time() - experiment_start
        partial = ""
        if 'process' in locals():
            if process.poll() is None:
                try:
                    stdout, _ = process.communicate(timeout=5)
                    partial = stdout or ""
                except (subprocess.TimeoutExpired, subprocess.SubprocessError):
                    partial = ""
        if partial.strip():
            output_file.write_text(partial, encoding="utf-8")
            log(f"Interrupted: partial output saved ({len(partial)} chars)", "WARNING", project_dir)
        return {"status": "interrupted", "output": partial, "duration": duration}

    except Exception as e:
        log(f"Ошибка запуска: {e}", "ERROR", project_dir)
        return {"status": "error", "error": str(e), "duration": time.time() - experiment_start}

    finally:
        # Гарантированная очистка процесса
        if 'process' in locals() and process.poll() is None:
            try:
                process.kill()
                process.wait(timeout=5)
                log(f"Process {process.pid} forcefully terminated", "DEBUG", project_dir)
            except (subprocess.SubprocessError, OSError):
                pass

def run_autoresearch(project_dir: Path, iterations: int, timeout: int, config: Optional[ProjectConfig] = None, start_from: int = 1, max_time: int = DEFAULT_MAX_TIME):
    """Главный цикл AutoResearch."""
    # Вычисляем конечный номер эксперимента
    max_experiment_number = start_from + iterations - 1

    log("=" * 70, project_dir=project_dir)
    log("AutoResearch - запуск", project_dir=project_dir)
    log("=" * 70, project_dir=project_dir)
    log(f"Проект: {project_dir}", project_dir=project_dir)
    log(f"Начинаем с: Experiment {start_from}", project_dir=project_dir)
    log(f"Всего итераций: {iterations}", project_dir=project_dir)
    log(f"Завершить на: Experiment {max_experiment_number}", project_dir=project_dir)
    log(f"Интервал: {timeout} мин", project_dir=project_dir)
    log(f"Макс. время эксперимента: {max_time}с ({max_time // 60} мин)", project_dir=project_dir)
    log("", project_dir=project_dir)

    # Проверка Claude CLI
    if not check_claude_cli():
        log("Claude CLI не найден!", "ERROR", project_dir=project_dir)
        log("Установите: npm install -g @anthropic-ai/claude-code", "INFO", project_dir=project_dir)
        return 1

    # Конфигурация проекта
    if config is None:
        config = ProjectConfig(project_dir)

    if not config.is_configured():
        log("Проект не настроен. Запуск интерактивной настройки...", "INFO", project_dir=project_dir)
        config = run_interactive_setup(project_dir)

    # Создаём backup branch
    try:
        branch = f"autoresearch-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        subprocess.run(
            ["git", "checkout", "-b", branch],
            cwd=project_dir,
            capture_output=True,
            check=True
        )
        log(f"Создана ветка: {branch}", "INFO", project_dir)

        # Initial commit: capture pre-existing uncommitted changes as baseline
        subprocess.run(["git", "add", "-u"], cwd=project_dir, capture_output=True, check=False)
        diff_check = subprocess.run(
            ["git", "diff", "--cached", "--quiet"],
            cwd=project_dir, capture_output=True, check=False
        )
        if diff_check.returncode != 0:
            subprocess.run(
                ["git", "commit", "-m", "autoresearch: baseline (pre-existing changes)"],
                cwd=project_dir, capture_output=True, text=True, check=False
            )
            log("Создан baseline commit", "INFO", project_dir)
    except Exception as e:
        log(f"Не удалось создать ветку: {e}", "WARNING", project_dir)

    # Главный цикл
    results = []

    try:
        for i in range(start_from, max_experiment_number + 1):
            log("", project_dir=project_dir)
            log(f"=" * 70, project_dir=project_dir)
            log(f"Эксперимент {i}/{max_experiment_number}", project_dir=project_dir)
            log("=" * 70, project_dir=project_dir)

            result = run_single_experiment(config, i, max_experiment_number, max_time=max_time)
            results.append(result)

            # Extract output from result (handles success, incomplete, interrupted, timeout)
            # BUG FIX: output was only assigned inside if block, causing NameError on error/timeout
            output = result.get("output") or result.get("partial_output") or ""
            is_complete = ">>>EXPERIMENT_COMPLETE" in output if output else False

            if output and len(output.strip()) > 50:
                # Парсим отчет эксперимента
                exp_data = parse_experiment_report(output, i)
                exp_data["is_complete"] = is_complete
                exp_data["duration"] = result.get("duration", 0)

                # Независимая оценка качества (не зависит от самооценки агента)
                log("Запуск независимой оценки качества...", "INFO", project_dir)
                quality = run_quality_gate(project_dir)
                exp_data["quality_score"] = quality.get("score", 0.5)
                exp_data["quality_decision"] = quality.get("decision", "MANUAL_REVIEW")
                log(f"Quality Gate: {exp_data['quality_decision']} (score: {exp_data['quality_score']:.2f})", "INFO", project_dir)

                # Сохраняем краткую сводку для агента (перезаписывается)
                save_last_experiment_summary(project_dir, exp_data)

                # Добавляем в полный лог (добавляется)
                save_accumulation_context(project_dir, exp_data)

                # Добавляем в хронологию изменений
                save_changes_log(project_dir, exp_data)

                # Автоматический git commit (code changes, не state-файлы)
                _auto_commit_experiment(project_dir, exp_data)

                # Enrich result with parsed data for summary and summary.json
                result["exp_number"] = i
                result["exp_title"] = exp_data.get("title", "")
                result["exp_quality_score"] = exp_data.get("quality_score")
                result["exp_quality_decision"] = exp_data.get("quality_decision", "")
                result["exp_is_complete"] = is_complete

                if not is_complete:
                    log(f"Эксперимент {i} сохранён как incomplete (нет маркера завершения)", "WARNING", project_dir)

        # Пауза перед следующей итерацией
        if i < max_experiment_number and timeout > 0:
            log(f"Ожидание {timeout} минут до следующей итерации...", "INFO", project_dir)
            log(f"Следующий эксперимент в {datetime.now().strftime('%H:%M:%S')}", "INFO", project_dir)
            time.sleep(timeout * 60)

    except KeyboardInterrupt:
        log("", project_dir=project_dir)
        log("Ctrl+C получен — завершаю с сохранением данных...", "WARNING", project_dir)

    # Итоги
    _print_summary(results, iterations, project_dir)

    # Сохраняем итоги
    summary_file = project_dir / ".autoresearch" / "experiments" / "summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    return 0

def _print_summary(results: list, iterations: int, project_dir: Path):
    """Выводит итоги работы AutoResearch (используется при нормальном завершении и при Ctrl+C)."""
    log("", project_dir=project_dir)
    log("=" * 70, project_dir=project_dir)
    log("AutoResearch завершён", project_dir=project_dir)
    log("=" * 70, project_dir=project_dir)

    total = len(results)
    successful = sum(1 for r in results if r.get("status") == "success")
    interrupted = sum(1 for r in results if r.get("status") == "interrupted")
    incomplete = sum(1 for r in results if r.get("status") == "incomplete")
    errors = sum(1 for r in results if r.get("status") == "error")
    log(f"Всего: {total} | Успешно: {successful} | Прервано: {interrupted} | Неполных: {incomplete} | Ошибок: {errors}", project_dir=project_dir)

    # Per-experiment breakdown with quality scores
    enriched = [r for r in results if r.get("exp_title")]
    if enriched:
        log("", project_dir=project_dir)
        log("| # | Status     | Score | Decision | Title", project_dir=project_dir)
        log("|---|------------|-------|----------|-------", project_dir=project_dir)
        for r in enriched:
            num = r.get("exp_number", "?")
            status = (r.get("status", "?")[:9] + ("…" if len(r.get("status", "")) > 9 else ""))
            score = r.get("exp_quality_score")
            score_str = f"{score:.2f}" if score is not None else "  N/A"
            decision = r.get("exp_quality_decision", "N/A")
            title = r.get("exp_title", "Untitled")[:45]
            log(f"| {num} | {status:<10} | {score_str:>5} | {decision:<8} | {title}", project_dir=project_dir)

        # Average quality score
        scores = [r["exp_quality_score"] for r in enriched if r.get("exp_quality_score") is not None]
        if scores:
            avg_score = sum(scores) / len(scores)
            log("", project_dir=project_dir)
            log(f"Средний Quality Gate score: {avg_score:.2f} (из {len(scores)} оценённых)", project_dir=project_dir)

    # Total wall-clock time
    durations = [r.get("duration", 0) or 0 for r in results]
    total_duration = sum(durations)
    if total_duration > 0:
        mins, secs = divmod(int(total_duration), 60)
        log(f"Общее время: {mins}m {secs}s", project_dir=project_dir)

# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="AutoResearch - Автономная система исследования и улучшения проектов",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  python autoresearch.py                              # Интерактивный режим
  python autoresearch.py --project /path/to/project   # Указать проект
  python autoresearch.py . 10 1                         # 10 итераций, 1 мин пауза (кратко)
  python autoresearch.py --project . --iter 10 --timeout 2  # Полный формат
  python autoresearch.py . 10 --max-time 300               # 10 итераций, макс. 5 мин/эксперимент
  python autoresearch.py . 10 --start-from 25            # Продолжение с Experiment 25
        """
    )

    # Позиционные аргументы (для краткого запуска)
    parser.add_argument(
        "project",
        nargs="?",
        type=Path,
        default=DEFAULT_PROJECT,
        help="Путь к проекту (по умолчанию: текущая директория)"
    )

    parser.add_argument(
        "iter",
        nargs="?",
        type=int,
        default=DEFAULT_ITERATIONS,
        help="Количество итераций (по умолчанию: 10)"
    )

    parser.add_argument(
        "timeout",
        nargs="?",
        type=int,
        default=DEFAULT_TIMEOUT,
        help="Интервал между итерациями в минутах (по умолчанию: 5)"
    )

    # Именованные аргументы (переопределяют позиционные)
    parser.add_argument(
        "--project", "-p",
        type=Path,
        dest="project_opt",
        help="Путь к проекту"
    )

    parser.add_argument(
        "--iter", "-i",
        type=int,
        dest="iter_opt",
        help="Количество итераций (переопределяет позиционный)"
    )

    parser.add_argument(
        "--timeout", "-t",
        type=int,
        dest="timeout_opt",
        help="Пауза между итерациями в минутах (переопределяет позиционный)"
    )

    parser.add_argument(
        "--max-time", "-m",
        type=int,
        dest="max_time",
        default=DEFAULT_MAX_TIME,
        help=f"Максимальная длительность одного эксперимента в секундах (default: {DEFAULT_MAX_TIME})"
    )

    parser.add_argument(
        "--start-from",
        type=int,
        default=None,
        dest="start_from",
        help="Начать с указанного номера (если не указано - автоопределение)"
    )

    parser.add_argument(
        "--configure", "-c",
        action="store_true",
        help="Только настроить проект, не запускать эксперименты"
    )

    parser.add_argument(
        "--reconfigure", "-r",
        action="store_true",
        help="Перенастроить проект"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Показать prompt без запуска Claude CLI (для отладки)"
    )

    args = parser.parse_args()

    # Определяем проект (приоритет: опция > позиционный > дефолт)
    project_dir = (args.project_opt or args.project).resolve()

    # Определяем количество итераций
    iterations = args.iter_opt or args.iter

    # Определяем таймаут
    timeout = args.timeout_opt or args.timeout

    # Определяем стартовый номер
    if args.start_from is None:
        # Автоопределяем следующий номер эксперимента
        exp_dir = project_dir / ".autoresearch" / "experiments"
        start_from = get_next_experiment_number(exp_dir)
        log(f"Автоопределён следующий номер: Experiment {start_from}", "INFO", project_dir)
    else:
        start_from = args.start_from
        log(f"Указан стартовый номер: Experiment {start_from}", "INFO", project_dir)

    # Dry-run: показать prompt без запуска Claude CLI
    if args.dry_run:
        config = ProjectConfig(project_dir)
        if not config.is_configured():
            config = run_interactive_setup(project_dir)
        prompt = build_agent_prompt(config, start_from, start_from)
        prompt_size = len(prompt.encode('utf-8'))
        log(f"Dry-run: prompt for Experiment {start_from} ({prompt_size:,} bytes, {prompt_size // 1024} KB)", "INFO", project_dir)
        # Сохраняем в файл для удобного просмотра
        exp_dir = project_dir / ".autoresearch" / "experiments"
        exp_dir.mkdir(parents=True, exist_ok=True)
        prompt_file = exp_dir / f"prompt_{start_from}.md"
        prompt_file.write_text(prompt, encoding="utf-8")
        log(f"Prompt saved to: {prompt_file}", "INFO", project_dir)
        print(prompt)
        return 0

    # Режим только настройки
    if args.configure or args.reconfigure:
        if args.reconfigure:
            # Удаляем старую конфигурацию
            config_file = project_dir / PROJECT_CONFIG_FILE
            if config_file.exists():
                config_file.unlink()
                log("Старая конфигурация удалена", "INFO", project_dir)

        run_interactive_setup(project_dir)
        return 0

    # Запуск AutoResearch
    try:
        return run_autoresearch(
            project_dir=project_dir,
            iterations=iterations,
            timeout=timeout,
            start_from=start_from,
            max_time=args.max_time
        )
    except KeyboardInterrupt:
        log("\nПрервано пользователем (Ctrl+C)", "INFO", project_dir)
        return 130

if __name__ == "__main__":
    sys.exit(main())
