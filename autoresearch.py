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
DEFAULT_TIMEOUT = 5  # минут

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

    # Ищем все output_N.md файлы
    existing = []
    for file in exp_dir.glob("output_*.md"):
        match = file.stem.split("_")[1]
        try:
            num = int(match)
            existing.append(num)
        except:
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

# =============================================================================
# CLAUDE CLI DETECTION
# =============================================================================
# See INSTALL.md for platform-specific installation instructions
# The code below auto-detects the OS and uses appropriate commands

def get_claude_command() -> str:
    """Auto-detects the command to run Claude CLI on any platform.

    Cross-platform implementation following INSTALL.md guidelines:
    - Windows: Uses PowerShell with ExecutionPolicy Bypass
    - Linux/macOS: Uses direct 'claude' command
    - Falls back to trying all available methods

    Returns:
        str: Command string to run Claude CLI
    """
    # Auto-detect OS and use appropriate method
    if sys.platform == "win32":
        # Windows: Try PowerShell (see INSTALL.md Step 2 - Windows)
        try:
            result = subprocess.run(
                ["powershell.exe", "-Command", "Get-Command claude | Select-Object -ExpandProperty Source"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False
            )
            if result.returncode == 0 and result.stdout.strip():
                ps1_path = result.stdout.strip()
                if ps1_path.endswith(".ps1"):
                    return f'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{ps1_path}"'
        except:
            pass

        # Fallback: Try cmd.exe where command
        try:
            result = subprocess.run(
                ["cmd", "/c", "where claude.ps1"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False
            )
            if result.returncode == 0 and result.stdout.strip():
                ps1_path = result.stdout.strip().split('\n')[0].strip()
                return f'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{ps1_path}"'
        except:
            pass

    # Unix-like systems (Linux, macOS) - see INSTALL.md Step 2
    return "claude"

def check_claude_cli() -> bool:
    """Checks if Claude CLI is installed and accessible.

    Validates installation following INSTALL.md Step 5 (Validation).
    Works on all platforms: Windows, Linux, macOS.

    Returns:
        bool: True if Claude CLI is found and working
    """
    claude_cmd = get_claude_command()

    # Platform-specific validation
    if sys.platform == "win32" and "powershell.exe" in claude_cmd:
        import re
        match = re.search(r'-File\s+"([^"]+)"', claude_cmd)
        if not match:
            match = re.search(r'-File\s+(\S+)', claude_cmd)

        if match:
            ps1_path = match.group(1)
            if Path(ps1_path).exists():
                return True

    # Cross-platform: try running --version
    result = subprocess.run(
        claude_cmd.split() + ["--version"],
        capture_output=True,
        text=True,
        timeout=15,
        check=False
    )

    return result.returncode == 0

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
            max_iterations=2,  # Quick check
            threshold_a=0.6,
            threshold_b=0.7
        )

        decision = "KEEP" if state.score >= 0.6 else "REVIEW"

        result = {
            "score": state.score,
            "passed": state.score >= 0.6,
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

    except ImportError:
        # quality_loop не доступен - возвращаем нейтральный результат
        log("Quality Loop module not found, skipping...", "WARNING", project_dir)
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

    # Читаем накопленный контекст если есть
    accumulated_context = ""
    last_experiment = ""

    project_dir = config.project_dir
    exp_dir = project_dir / ".autoresearch" / "experiments"

    if exp_dir.exists():
        accumulation_file = exp_dir / "accumulation_context.md"
        last_exp_file = exp_dir / "last_experiment.md"

        if accumulation_file.exists():
            accumulated_context = accumulation_file.read_text(encoding="utf-8")

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
    }

    prompt = template.format(**context)

    # Добавляем накопленный контекст если есть
    if accumulated_context or last_experiment:
        prompt += "\n\n## Накопленный контекст\n\n"

        if last_experiment:
            prompt += "### Последний эксперимент\n\n"
            prompt += last_experiment + "\n\n"

        if accumulated_context:
            prompt += "### Полный лог экспериментов\n\n"
            prompt += accumulated_context + "\n\n"

    return prompt

# =============================================================================
# EXPERIMENT LOOP
# =============================================================================

def run_single_experiment(config: ProjectConfig, iteration: int, total: int) -> Dict[str, Any]:
    """Запускает один эксперимент."""
    project_dir = config.project_dir
    exp_dir = project_dir / ".autoresearch" / "experiments"
    exp_dir.mkdir(parents=True, exist_ok=True)

    log(f"Запуск эксперимента {iteration}/{total}", "INFO", project_dir)

    # Строим промпт
    prompt = build_agent_prompt(config, iteration, total)

    # Сохраняем промпт
    prompt_file = exp_dir / f"prompt_{iteration}.md"
    prompt_file.write_text(prompt, encoding="utf-8")

    # Запускаем Claude CLI
    claude_cmd = get_claude_command()
    output_file = exp_dir / f"output_{iteration}.md"

    try:
        # Parse command based on platform (see INSTALL.md Step 2)
        if sys.platform == "win32" and "powershell.exe" in claude_cmd:
            # Windows: Extract .ps1 path and build PowerShell command
            import re
            match = re.search(r'-File\s+"([^"]+)"', claude_cmd)
            if match:
                ps1_path = match.group(1)
                cmd_args = [
                    "powershell.exe",
                    "-NoProfile",
                    "-ExecutionPolicy", "Bypass",
                    "-File", ps1_path,
                    "--print",  # Non-interactive mode
                ]
            else:
                raise ValueError("Cannot parse PowerShell command")
        else:
            # Unix-like (Linux, macOS): direct command
            cmd_args = claude_cmd.split() + ["--print"]

        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'

        # CRITICAL: Отключаем CLAUDECODE чтобы избежать nested session check
        # Claude CLI нельзя запускать изнутри другой сессии Claude Code
        env.pop('CLAUDECODE', None)
        env.pop('CLAUDE_SESSION_ID', None)

        result = subprocess.run(
            cmd_args,
            input=prompt,
            cwd=project_dir,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=env,
            check=False,
            timeout=1800  # 30 минут максимум для одного эксперимента
        )

        if result.returncode != 0:
            log(f"Claude CLI error: {result.stderr}", "ERROR", project_dir)
            return {"status": "error", "error": result.stderr}

        # Сохраняем вывод
        output = result.stdout
        output_file.write_text(output, encoding="utf-8")

        # Проверяем маркер завершения
        if ">>>EXPERIMENT_COMPLETE<<<" in output:
            log(f"Эксперимент {iteration} завершён", "INFO", project_dir)
            return {"status": "success", "output": output}
        else:
            log(f"Эксперимент {iteration} завершён без маркера", "WARNING", project_dir)
            return {"status": "incomplete", "output": output}

    except subprocess.TimeoutExpired as e:
        log(f"Claude CLI timeout after 30 minutes!", "ERROR", project_dir)
        log(f"Experiment {iteration} timed out - may be stuck on permission prompt or hanging", "ERROR", project_dir)
        return {"status": "error", "error": f"Timeout after 30 minutes. Claude CLI may be waiting for permission approval or stuck."}
    except Exception as e:
        log(f"Ошибка запуска: {e}", "ERROR", project_dir)
        return {"status": "error", "error": str(e)}

def run_autoresearch(project_dir: Path, iterations: int, timeout: int, config: Optional[ProjectConfig] = None, start_from: int = 1):
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
    except Exception as e:
        log(f"Не удалось создать ветку: {e}", "WARNING", project_dir)

    # Главный цикл
    results = []

    for i in range(start_from, max_experiment_number + 1):
        log("", project_dir=project_dir)
        log(f"=" * 70, project_dir=project_dir)
        log(f"Эксперимент {i}/{max_experiment_number}", project_dir=project_dir)
        log("=" * 70, project_dir=project_dir)

        result = run_single_experiment(config, i, max_experiment_number)
        results.append(result)

        # Пауза перед следующей итерацией
        if i < max_experiment_number and timeout > 0:
            log(f"Ожидание {timeout} минут до следующей итерации...", "INFO", project_dir)
            log(f"Следующий эксперимент в {datetime.now().strftime('%H:%M:%S')}", "INFO", project_dir)
            time.sleep(timeout * 60)

    # Итоги
    log("", project_dir=project_dir)
    log("=" * 70, project_dir=project_dir)
    log("AutoResearch завершён", project_dir=project_dir)
    log("=" * 70, project_dir=project_dir)

    successful = sum(1 for r in results if r.get("status") == "success")
    log(f"Успешно: {successful}/{iterations}", project_dir=project_dir)

    # Сохраняем итоги
    summary_file = project_dir / ".autoresearch" / "experiments" / "summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    return 0

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
        help="Интервал между итерациями (переопределяет позиционный)"
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

    args = parser.parse_args()

    # Определяем проект (приоритет: опция > позиционный > дефолт)
    project_dir = (args.project_opt or args.project).resolve()

    # Определяем количество итераций
    iterations = args.iter_opt or args.iter

    # Определяем таймаут
    timeout = args.timeout_opt or args.timeout

    # Определяем стартовый номер
    if start_from is None:
        # Автоопределяем следующий номер эксперимента
        exp_dir = project_dir / ".autoresearch" / "experiments"
        start_from = get_next_experiment_number(exp_dir)
        log(f"Автоопределён следующий номер: Experiment {start_from}", "INFO", project_dir)
    else:
        log(f"Указан стартовый номер: Experiment {start_from}", "INFO", project_dir)

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
    return run_autoresearch(
        project_dir=project_dir,
        iterations=iterations,
        timeout=timeout,
        start_from=start_from
    )

if __name__ == "__main__":
    sys.exit(main())
