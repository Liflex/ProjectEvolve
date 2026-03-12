#!/usr/bin/env python3
"""
AutoResearch - Автономная система исследования и улучшения проектов

Универсальный инструмент для запуска AI-агента на любом проекте с целью
автономного исследования, улучшения и саморазвития.

Usage:
    python autoresearch.py                          # Интерактивный режим
    python autoresearch.py --project /path/to/proj  # Указать проект
    python autoresearch.py --project . --iter 10    # 10 итераций
    python autoresearch.py --project . --iter 5 --timeout 2  # 2 мин интервал
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

def get_claude_command() -> str:
    """Находит команду для запуска Claude CLI."""
    if sys.platform == "win32":
        # Windows: пробуем powershell.exe
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

        # Fallback через cmd.exe
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

    # Unix или fallback
    return "claude"

def check_claude_cli() -> bool:
    """Проверяет наличие Claude CLI."""
    claude_cmd = get_claude_command()

    if sys.platform == "win32" and "powershell.exe" in claude_cmd:
        import re
        match = re.search(r'-File\s+"([^"]+)"', claude_cmd)
        if not match:
            match = re.search(r'-File\s+(\S+)', claude_cmd)

        if match:
            ps1_path = match.group(1)
            if Path(ps1_path).exists():
                return True

    # Для Unix пробуем прямую команду
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
    }

    return template.format(**context)

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
        if sys.platform == "win32" and "powershell.exe" in claude_cmd:
            import re
            match = re.search(r'-File\s+"([^"]+)"', claude_cmd)
            if match:
                ps1_path = match.group(1)
                cmd_args = [
                    "powershell.exe",
                    "-NoProfile",
                    "-ExecutionPolicy", "Bypass",
                    "-File", ps1_path,
                    "--print",
                ]
            else:
                raise ValueError("Cannot parse PowerShell command")
        else:
            cmd_args = claude_cmd.split() + ["--print"]

        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'

        result = subprocess.run(
            cmd_args,
            input=prompt,
            cwd=project_dir,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=env,
            check=False
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

    except Exception as e:
        log(f"Ошибка запуска: {e}", "ERROR", project_dir)
        return {"status": "error", "error": str(e)}

def run_autoresearch(project_dir: Path, iterations: int, timeout: int, config: Optional[ProjectConfig] = None):
    """Главный цикл AutoResearch."""
    log("=" * 70, project_dir=project_dir)
    log("AutoResearch - запуск", project_dir=project_dir)
    log("=" * 70, project_dir=project_dir)
    log(f"Проект: {project_dir}", project_dir=project_dir)
    log(f"Итераций: {iterations}", project_dir=project_dir)
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

    for i in range(1, iterations + 1):
        log("", project_dir=project_dir)
        log(f"=" * 70, project_dir=project_dir)
        log(f"Эксперимент {i}/{iterations}", project_dir=project_dir)
        log("=" * 70, project_dir=project_dir)

        result = run_single_experiment(config, i, iterations)
        results.append(result)

        # Пауза перед следующей итерацией
        if i < iterations and timeout > 0:
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
  python autoresearch.py --project . --iter 10        # 10 итераций
  python autoresearch.py --project . --iter 5 --timeout 2  # 2 мин интервал
        """
    )

    parser.add_argument(
        "--project", "-p",
        type=Path,
        default=DEFAULT_PROJECT,
        help="Путь к проекту (по умолчанию: текущая директория)"
    )

    parser.add_argument(
        "--iter", "-i",
        type=int,
        default=DEFAULT_ITERATIONS,
        help="Количество итераций (по умолчанию: 10)"
    )

    parser.add_argument(
        "--timeout", "-t",
        type=int,
        default=DEFAULT_TIMEOUT,
        dest="timeout",
        help="Интервал между итерациями в минутах (по умолчанию: 5)"
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

    project_dir = args.project.resolve()

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
        iterations=args.iter,
        timeout=args.timeout
    )

if __name__ == "__main__":
    sys.exit(main())
