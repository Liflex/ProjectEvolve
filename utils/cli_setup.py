#!/usr/bin/env python3
"""
Интерактивная настройка AutoResearch с помощью Claude CLI.

Используется для первичной конфигурации проекта.
"""

import sys
import json
from pathlib import Path

PROJECT_CONFIG_FILE = ".autoresearch.json"


def main():
    if len(sys.argv) < 2:
        print("Usage: cli_setup.py <project_dir>")
        return 1

    project_dir = Path(sys.argv[1]).resolve()
    config_file = project_dir / PROJECT_CONFIG_FILE

    print(f"\n{'='*60}")
    print(f"AutoResearch - Настройка проекта")
    print(f"{'='*60}")
    print(f"\nПроект: {project_dir}")
    print(f"Конфигурация: {config_file}")
    print()

    # Собираем информацию
    config = {
        "name": "",
        "description": "",
        "goals": [],
        "constraints": [],
        "tech_stack": [],
        "focus_areas": []
    }

    # Название
    config["name"] = input("Название проекта: ").strip() or project_dir.name

    # Описание
    config["description"] = input("Краткое описание: ").strip()

    # Цели
    print("\nЦели проекта (по одной на строке, Enter для завершения):")
    while True:
        goal = input("  > ").strip()
        if not goal:
            break
        config["goals"].append(goal)

    # Ограничения
    print("\nОграничения (опционально, Enter для завершения):")
    while True:
        constraint = input("  > ").strip()
        if not constraint:
            break
        config["constraints"].append(constraint)

    # Tech stack
    print("\nТехнологии через запятую (опционально):")
    tech_input = input("  > ").strip()
    if tech_input:
        config["tech_stack"] = [t.strip() for t in tech_input.split(",")]

    # Focus areas
    print("\nФокусные области для улучшения (опционально, Enter для завершения):")
    while True:
        area = input("  > ").strip()
        if not area:
            break
        config["focus_areas"].append(area)

    # Сохраняем
    config_file.parent.mkdir(parents=True, exist_ok=True)
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Конфигурация сохранена: {config_file}")
    print()
    print("Конфигурация:")
    print(f"  Название: {config['name']}")
    print(f"  Целей: {len(config['goals'])}")
    print(f"  Технологий: {len(config['tech_stack'])}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
