#!/usr/bin/env python3
"""
Universal Quality Loop for ProjectEvolve
Универсальная система самотестирования с метриками для любых проектов

Works with:
- Python (pytest, flake8, mypy)
- JavaScript/TypeScript (npm test, eslint, tsc)
- Go (go test, golangci-lint)
- Rust (cargo test, clippy)
- Ruby (rspec, rubocop)
- Java (gradle test, mvn test)
- And any custom command
"""

import os
import sys
import json
import shutil
import time
import shlex
import subprocess
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum


# Built-in auto-detect defaults for common tech stacks
# Used when config doesn't specify auto_detect for a metric
DEFAULT_AUTO_DETECT = {
    "python": {
        "syntax": ["python -m compileall -q ."],
    },
}


class Phase(Enum):
    """Фаза Quality Loop"""
    A = "A"  # Base quality
    B = "B"  # Strict quality


class StopReason(Enum):
    """Причина остановки loop"""
    threshold_reached = "threshold_reached"
    iteration_limit = "iteration_limit"
    stagnation = "stagnation"
    user_stop = "user_stop"
    critical_fail = "critical_fail"


@dataclass
class MetricResult:
    """Результат выполнения одной метрики"""
    name: str
    passed: bool
    output: str
    duration: float
    score: float  # 0.0 - 1.0


@dataclass
class LoopState:
    """Состояние Quality Loop"""
    iteration: int
    phase: Phase
    score: float
    baseline_score: float
    last_score: Optional[float]
    results: List[MetricResult]
    started_at: str
    stop_reason: Optional[str] = None
    threshold_a: float = 0.7
    threshold_b: float = 0.85


class QualityConfig:
    """Конфигурация Quality Gate"""

    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.config_file = project_dir / ".autoresearch" / "quality.yml"
        self.config = self._load_config()

    def _load_config(self) -> Dict:
        """Загружает конфигурацию из YAML файла (с fallback на JSON)"""
        default_config = {
            "project_name": self.project_dir.name,
            "metrics": {"tests": {"enabled": True}, "syntax": {"enabled": True}},
            "thresholds": {
                "a": {"min_score": 0.7, "required_checks": []},
                "b": {"min_score": 0.85, "required_checks": []}
            },
            "loop": {
                "max_iterations": 4,
                "stagnation_limit": 2,
                "stagnation_delta": 0.02
            }
        }

        if not self.config_file.exists():
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            if yaml:
                with open(self.config_file, "w", encoding="utf-8") as f:
                    yaml.dump(default_config, f, default_flow_style=False, allow_unicode=True)
            else:
                # Fallback: сохраняем как JSON если yaml недоступен
                json_file = self.config_file.with_suffix(".json")
                with open(json_file, "w", encoding="utf-8") as f:
                    json.dump(default_config, f, indent=2, ensure_ascii=False)
            return default_config

        with open(self.config_file, "r", encoding="utf-8") as f:
            if yaml and self.config_file.suffix in (".yml", ".yaml"):
                return yaml.safe_load(f)
            else:
                return json.load(f)

    def get_phase_threshold(self, phase: Phase) -> float:
        """Возвращает порог для фазы"""
        phase_key = phase.value.lower()
        return self.config.get("thresholds", {}).get(phase_key, {}).get("min_score", 0.7)

    def get_required_checks(self, phase: Phase) -> List[str]:
        """Возвращает обязательные проверки для фазы"""
        phase_key = phase.value.lower()
        return self.config.get("thresholds", {}).get(phase_key, {}).get("required_checks", [])


class MetricRunner:
    """Запуск метрик и тестов"""

    def __init__(self, project_dir: Path, config: QualityConfig):
        self.project_dir = project_dir
        self.config = config
        self.tech_stacks = self._detect_tech_stacks()

    def _detect_tech_stacks(self) -> List[str]:
        """Автодетект всех стеков технологий проекта.

        Возвращает список всех обнаруженных стеков (с дедупликацией).
        Проект со смешанными стеками (JS+Python) получат метрики для каждого.
        """
        checks = [
            ("package.json", "javascript"),
            ("tsconfig.json", "typescript"),
            ("requirements.txt", "python"),
            ("pyproject.toml", "python"),
            ("go.mod", "go"),
            ("Cargo.toml", "rust"),
            ("Gemfile", "ruby"),
            ("pom.xml", "java"),
            ("build.gradle", "java"),
        ]

        stacks = []
        seen = set()
        for filename, tech in checks:
            if (self.project_dir / filename).exists() and tech not in seen:
                stacks.append(tech)
                seen.add(tech)

        return stacks if stacks else ["unknown"]

    def _find_command(self, metric_type: str) -> Optional[str]:
        """Находит команду для метрики по типу проекта.

        Проверяет config auto_detect для всех обнаруженных стеков,
        затем fallback на DEFAULT_AUTO_DETECT.
        Использует shutil.which() для быстрой проверки без subprocess spawn.
        """
        auto_detect = self.config.config.get("auto_detect", {})

        # Check config auto_detect for all detected tech stacks
        for stack in self.tech_stacks:
            commands = auto_detect.get(stack, {}).get(metric_type, [])
            for cmd in commands:
                base_cmd = shlex.split(cmd)[0]
                if shutil.which(base_cmd):
                    return cmd

        # Fallback to built-in defaults for all detected stacks
        for stack in self.tech_stacks:
            commands = DEFAULT_AUTO_DETECT.get(stack, {}).get(metric_type, [])
            for cmd in commands:
                base_cmd = shlex.split(cmd)[0]
                if shutil.which(base_cmd):
                    return cmd

        return None

    def run_metric(self, name: str, config: Dict) -> MetricResult:
        """Запускает одну метрику"""
        if not config.get("enabled", False):
            return MetricResult(
                name=name,
                passed=True,  # Отключённая метрика считается pass
                output="Metric disabled",
                duration=0.0,
                score=1.0
            )

        command = config.get("command", "")

        # Автодетект команды если не указана
        if not command:
            command = self._find_command(name)
            if not command:
                # Команда не найдена - считаем как warn (не block)
                return MetricResult(
                    name=name,
                    passed=True,
                    output=f"No {name} command found for {', '.join(self.tech_stacks)}",
                    duration=0.0,
                    score=0.5  # Neutral score
                )

        success_pattern = config.get("success_pattern", "")
        fail_pattern = config.get("fail_pattern", "")

        start_time = time.time()

        try:
            result = subprocess.run(
                shlex.split(command),
                shell=False,
                cwd=self.project_dir,
                capture_output=True,
                text=True,
                timeout=300,  # 5 минут
                check=False
            )

            duration = time.time() - start_time
            output = result.stdout + result.stderr

            # Определяем pass/fail по паттернам или exit code
            passed = result.returncode == 0

            if success_pattern and success_pattern.lower() in output.lower():
                passed = True
            elif fail_pattern and fail_pattern.lower() in output.lower():
                passed = False

            # Score: 1.0 if pass, 0.0 if fail
            score = 1.0 if passed else 0.0

            return MetricResult(
                name=name,
                passed=passed,
                output=output,
                duration=duration,
                score=score
            )

        except subprocess.TimeoutExpired:
            return MetricResult(
                name=name,
                passed=False,
                output=f"Timeout after 300 seconds",
                duration=300.0,
                score=0.0
            )
        except Exception as e:
            return MetricResult(
                name=name,
                passed=False,
                output=f"Error: {e}",
                duration=0.0,
                score=0.0
            )

    def run_all_metrics(self, phase: Phase) -> Tuple[List[MetricResult], float]:
        """Запускает все метрики и возвращает результаты с общим score"""
        metrics_config = dict(self.config.config.get("metrics", {}))

        # Auto-add built-in metrics for all detected tech stacks (if not already in config)
        for stack in self.tech_stacks:
            stack_defaults = DEFAULT_AUTO_DETECT.get(stack, {})
            for metric_name in stack_defaults:
                if metric_name not in metrics_config:
                    metrics_config[metric_name] = {"enabled": True}

        required_checks = self.config.get_required_checks(phase)

        results = []
        total_weight = 0.0
        passed_weight = 0.0

        for metric_name, metric_config in metrics_config.items():
            result = self.run_metric(metric_name, metric_config)
            results.append(result)

            # Skip "not applicable" metrics (score 0.5 = no command found)
            # They still appear in results for info, but don't affect the score
            if result.score == 0.5 and result.passed:
                continue

            # required checks имеют вес 2, остальные 1
            weight = 2.0 if metric_name in required_checks else 1.0
            total_weight += weight

            if result.passed:
                passed_weight += weight * result.score

        # Общий score: passed / total
        overall_score = passed_weight / total_weight if total_weight > 0 else 0.0

        return results, overall_score


class QualityLoop:
    """Универсальный Quality Loop для любого проекта"""

    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.config = QualityConfig(project_dir)
        self.runner = MetricRunner(project_dir, self.config)
        self.state: Optional[LoopState] = None

    def run(
        self,
        max_iterations: int = 4,
        threshold_a: float = 0.7,
        threshold_b: float = 0.85,
        quiet: bool = False
    ) -> LoopState:
        """Запускает Quality Loop

        Args:
            max_iterations: Максимальное количество итераций
            threshold_a: Порог для Phase A
            threshold_b: Порог для Phase B
            quiet: Подавить console output (для программного использования)

        Returns:
            Финальное состояние loop
        """
        def _print(msg=""):
            if not quiet:
                print(msg)

        _print("=" * 70)
        _print("Quality Loop - Started")
        _print("=" * 70)
        _print(f"Project: {self.project_dir.name}")
        _print(f"Tech Stack: {', '.join(self.runner.tech_stacks)}")
        _print(f"Max Iterations: {max_iterations}")
        _print()

        # Инициализация состояния
        self.state = LoopState(
            iteration=1,
            phase=Phase.A,
            score=0.0,
            baseline_score=0.0,
            last_score=None,
            results=[],
            started_at=datetime.now().isoformat(),
            threshold_a=threshold_a,
            threshold_b=threshold_b
        )

        stagnation_count = 0
        loop_config = self.config.config.get("loop", {})

        # Запуск итераций
        while self.state.iteration <= max_iterations:
            # Определяем порог для текущей фазы
            threshold = threshold_a if self.state.phase == Phase.A else threshold_b

            _print(f"\n{'=' * 70}")
            _print(f"Iteration {self.state.iteration}/{max_iterations} | Phase {self.state.phase.value}")
            _print(f"Threshold: {threshold:.2f}")
            _print(f"{'=' * 70}\n")

            # Запуск метрик
            results, score = self.runner.run_all_metrics(self.state.phase)
            self.state.results = results
            self.state.score = score

            # Вывод результатов
            self._print_results(results, score, threshold, quiet)

            # Проверка условий остановки
            stop_reason = self._check_stop_conditions(score, threshold, stagnation_count, loop_config, quiet)
            if stop_reason:
                self.state.stop_reason = stop_reason.value
                break

            # Проверка перехода Phase A → B
            if self.state.phase == Phase.A and score >= threshold:
                _print(f"\n✓ Phase A passed! Advancing to Phase B...")
                self.state.phase = Phase.B
                self.state.iteration += 1
                continue

            # Обновление stagnation counter
            if self.state.last_score is not None:
                delta = abs(score - self.state.last_score)
                stagnation_delta = loop_config.get("stagnation_delta", 0.02)
                if delta < stagnation_delta:
                    stagnation_count += 1
                else:
                    stagnation_count = 0

            self.state.last_score = score
            self.state.iteration += 1

        # Финальный отчёт
        self._print_summary(quiet)

        return self.state

    def _check_stop_conditions(
        self,
        score: float,
        threshold: float,
        stagnation_count: int,
        loop_config: Dict,
        quiet: bool = False
    ) -> Optional[StopReason]:
        """Проверяет условия остановки loop"""
        # Phase B passed
        if self.state.phase == Phase.B and score >= threshold:
            return StopReason.threshold_reached

        # Stagnation
        stagnation_limit = loop_config.get("stagnation_limit", 2)
        if stagnation_count >= stagnation_limit:
            if not quiet:
                print(f"\n⚠ Stagnation detected (no improvement for {stagnation_count} iterations)")
            return StopReason.stagnation

        return None

    def _print_results(self, results: List[MetricResult], score: float, threshold: float, quiet: bool = False):
        """Выводит результаты итерации"""
        if quiet:
            return

        passed = score >= threshold
        status = "✓ PASS" if passed else "✗ FAIL"

        print(f"Score: {score:.2f} / {threshold:.2f} | {status}")
        print()

        for result in results:
            icon = "✓" if result.passed else "✗"
            print(f"  {icon} {result.name}: {result.score:.1f} ({result.duration:.1f}s)")

            # Выводим output если есть ошибка
            if not result.passed and result.output:
                # Показываем первые 3 строки ошибки
                lines = result.output.strip().split('\n')[:3]
                for line in lines:
                    print(f"      {line}")

    def _print_summary(self, quiet: bool = False):
        """Выводит финальный отчёт"""
        if quiet:
            return

        print(f"\n{'=' * 70}")
        print("Quality Loop - Summary")
        print(f"{'=' * 70}")
        print(f"Final Score: {self.state.score:.2f}")
        print(f"Phase: {self.state.phase.value}")
        print(f"Iterations: {self.state.iteration - 1}")
        print(f"Stop Reason: {self.state.stop_reason}")
        print()

        # Decision
        decision = self._make_decision()
        print(f"Decision: {decision}")
        print(f"{'=' * 70}\n")

    def _make_decision(self) -> str:
        """Принимает решение: сохранить или отбросить изменения"""
        no_failures = all(r.passed for r in self.state.results)

        if self.state.score >= self.state.threshold_b and no_failures:
            return "✓ KEEP - All checks passed (strict quality)"
        elif self.state.score >= self.state.threshold_a:
            return "⚠ ACCEPT - Quality meets baseline"
        else:
            return "✗ DISCARD - Quality below threshold"


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Universal Quality Loop for ProjectEvolve"
    )
    parser.add_argument(
        "--project", "-p",
        type=Path,
        default=Path.cwd(),
        help="Path to project directory"
    )
    parser.add_argument(
        "--max-iterations", "-i",
        type=int,
        default=4,
        help="Maximum iterations (default: 4)"
    )
    parser.add_argument(
        "--threshold-a",
        type=float,
        default=0.7,
        help="Phase A threshold (default: 0.7)"
    )
    parser.add_argument(
        "--threshold-b",
        type=float,
        default=0.85,
        help="Phase B threshold (default: 0.85)"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON"
    )

    args = parser.parse_args()

    loop = QualityLoop(args.project)
    state = loop.run(
        max_iterations=args.max_iterations,
        threshold_a=args.threshold_a,
        threshold_b=args.threshold_b,
        quiet=args.json  # --json suppresses human-readable output for clean parsing
    )

    if args.json:
        # Вывод в JSON для парсинга — только JSON, без лишнего текста
        decision_text = loop._make_decision()
        decision_key = "KEEP" if "KEEP" in decision_text else ("ACCEPT" if "ACCEPT" in decision_text else "DISCARD")
        output = {
            "score": state.score,
            "phase": state.phase.value,
            "iterations": state.iteration - 1,
            "stop_reason": state.stop_reason,
            "decision": decision_key,
            "results": [
                {
                    "name": r.name,
                    "passed": r.passed,
                    "score": r.score,
                    "duration": r.duration
                }
                for r in state.results
            ]
        }
        print(json.dumps(output, indent=2))

    return 0 if state.score >= state.threshold_a else 1


if __name__ == "__main__":
    sys.exit(main())
