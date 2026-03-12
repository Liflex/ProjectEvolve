# Quality Loop - Система самотестирования ProjectEvolve

## Overview

Quality Loop — это встроенная система ProjectEvolve для автоматической оценки качества изменений после каждого эксперимента.

**Inspired by:** Quality Gate systems в CI/CD пайплайнах и `/speckit.loop` из spec-kit.

---

## Как это работает

### Cycle: Generate → Apply → Evaluate → Decision

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPERIMENT LOOP                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌───────┐ │
│  │ Generate │───▶│  Apply   │───▶│ Evaluate │───▶│Decide │ │
│  │   Idea   │    │ Changes  │    │ (Score)  │    │       │ │
│  └──────────┘    └──────────┘    └────┬─────┘    └───┬───┘ │
│                                         │               │    │
│                                         │               │    │
│                                    Score 0.0-1.0      │    │
│                                         │               │    │
│                                         ▼               ▼    │
│                                    ┌──────────────────────┐  │
│                                    │   KEEP or DISCARD    │  │
│                                    └──────────┬───────────┘  │
│                                               │ (if kept)    │
│                                               ▼              │
│                                        ┌──────────┐        │
│                                        │  Next    │        │
│                                        │Iteration │────────┘
│                                        └──────────┘
└─────────────────────────────────────────────────────────────┘
```

---

## Автодетект технологий

Quality Loop автоматически определяет стек проекта и находит соответствующие команды:

| Язык/Технология | Файл-детектор | Тесты | Линтинг | Типы | Сборка |
|-----------------|---------------|-------|---------|------|--------|
| **Python** | `requirements.txt`, `pyproject.toml` | `pytest` | `flake8`, `ruff` | `mypy` | `python -m build` |
| **JavaScript** | `package.json` | `npm test` | `eslint` | — | `npm run build` |
| **TypeScript** | `tsconfig.json` | `npm test` | `eslint` | `tsc` | `tsc`, `npm run build` |
| **Go** | `go.mod` | `go test` | `golangci-lint` | `go vet` | `go build` |
| **Rust** | `Cargo.toml` | `cargo test` | `cargo clippy` | — | `cargo build` |
| **Ruby** | `Gemfile` | `rspec` | `rubocop` | — | `bundle exec rake build` |
| **Java** | `pom.xml`, `build.gradle` | `gradle test` | `checkstyle` | `javac` | `gradle build` |

---

## Использование

### Базовый запуск

```bash
# Запустить Quality Loop на проекте
python F:/IdeaProjects/autoresearch/utils/quality_loop.py --project /path/to/project
```

### Кастомные пороги

```bash
# Phase A: 70%, Phase B: 85%
python utils/quality_loop.py --project . --threshold-a 0.7 --threshold-b 0.85

# Строгие пороги
python utils/quality_loop.py --project . --threshold-a 0.8 --threshold-b 0.95
```

### JSON вывод

```bash
# Для парсинга в скриптах
python utils/quality_loop.py --project . --json
```

---

## Конфигурация

### Файл `.autoresearch/quality.yml`

Создаётся автоматически при первом запуске:

```yaml
# Название проекта
project_name: "my-project"

# Метрики качества
metrics:
  tests:
    enabled: true
    command: ""  # Автодетект если пусто
    success_pattern: "pass|success|ok"
    fail_pattern: "fail|error|failed"

  lint:
    enabled: false
    command: ""
    success_pattern: ""
    fail_pattern: "error|warning"

  types:
    enabled: false
    command: ""
    success_pattern: ""
    fail_pattern: "error"

  build:
    enabled: false
    command: ""
    success_pattern: "built|compiled|success"
    fail_pattern: "error|failed"

# Пороги качества
thresholds:
  a:
    min_score: 0.7      # 70% для Phase A
    required_checks: ["tests"]
  b:
    min_score: 0.85     # 85% для Phase B
    required_checks: ["tests", "build"]

# Loop настройки
loop:
  max_iterations: 4
  stagnation_limit: 2
  stagnation_delta: 0.02

# Decision правила
decision:
  keep_if:
    score_improved: true
    no_regressions: true
    required_passed: true
  discard_if:
    score_decreased: true
    critical_fail: true
```

---

## Phase Model

### Phase A (Base Quality)

- **Threshold:** 0.7 (70%)
- **Active metrics:** Базовые проверки (обычно только tests)
- **Focus:** Основная функциональность
- **Pass condition:** Score ≥ 0.7 И все required_checks pass

### Phase B (Strict Quality)

- **Threshold:** 0.85 (85%)
- **Active metrics:** Все проверки (tests + build + lint + types)
- **Focus:** Production-ready качество
- **Pass condition:** Score ≥ 0.85 И все required_checks pass

### Переход A → B

Автоматический переход при:
- Phase A pass (score ≥ threshold_a)
- Все Phase A required_checks pass

---

## Score Calculation

**Formula:**
```
score = sum(passed_weights) / sum(all_active_weights)
```

**Weights:**
- required_checks: weight = 2
- optional checks: weight = 1

**Example:**
```
Phase A, 2 metrics active:
- tests (required): pass → weight = 2
- build (optional): fail → weight = 1

score = 2 / (2 + 1) = 0.67 → FAIL
```

---

## Decision Logic

### KEEP Conditions

Сохранить изменения если ВСЁ:
- ✅ Score ≥ baseline + 0.05 (улучшение на 5%+)
- ✅ Все required_checks pass
- ✅ Нет критических ошибок

### DISCARD Conditions

Отбросить изменения если ЛЮБОЕ:
- ❌ Score < baseline (ухудшение)
- ❌ Required checks fail
- ❌ Критические ошибки

### MANUAL_REVIEW Conditions

Ручная проверка если:
- ⚠️ Score ~ baseline (минимальные изменения)
- ⚠️ Некоторые optional checks fail
- ⚠️ Неоднозначные результаты

---

## Примеры

### Пример 1: Успешный Loop

```
========================================================================
Quality Loop - Started
========================================================================
Project: my-app
Tech Stack: javascript
Max Iterations: 2

========================================================================
Iteration 1/2 | Phase A
Threshold: 0.70
========================================================================

Score: 0.80 / 0.70 | ✓ PASS

  ✓ tests: 1 (3.2s)
  ✓ build: 1 (5.1s)

✓ Phase A passed! Advancing to Phase B...

========================================================================
Iteration 2/2 | Phase B
Threshold: 0.85
========================================================================

Score: 0.88 / 0.85 | ✓ PASS

  ✓ tests: 1 (3.1s)
  ✓ lint: 1 (2.0s)
  ✓ build: 1 (5.0s)

========================================================================
Quality Loop - Summary
========================================================================
Final Score: 0.88
Phase: B
Iterations: 2
Stop Reason: threshold_reached

Decision: ✓ KEEP - Score improved, all checks passed
========================================================================
```

### Пример 2: Stagnation

```
========================================================================
Quality Loop - Started
========================================================================

========================================================================
Iteration 1/4 | Phase A
Threshold: 0.70
========================================================================

Score: 0.60 / 0.70 | ✗ FAIL

  ✗ tests: 0 (2.1s)
    Error: 2 tests failed

========================================================================
Iteration 2/4 | Phase A
Threshold: 0.70
========================================================================

Score: 0.60 / 0.70 | ✗ FAIL

  ✗ tests: 0 (2.0s)
    Error: 2 tests failed

⚠ Stagnation detected (no improvement for 2 iterations)

========================================================================
Quality Loop - Summary
========================================================================
Final Score: 0.60
Phase: A
Iterations: 2
Stop Reason: stagnation

Decision: ✗ DISCARD - Quality too low
========================================================================
```

---

## Интеграция с autoresearch.py

Quality Loop автоматически интегрируется в основной цикл:

```python
# В autoresearch.py
def run_single_experiment(config, iteration, total):
    # ... применение изменений ...

    # Запуск Quality Gate
    quality_result = run_quality_gate(project_dir)

    # Логирование решения
    log(f"Quality Gate: {quality_result['decision']} (score: {quality_result['score']:.2f})")
```

---

## Troubleshooting

### PyYAML не установлен

```bash
pip install pyyaml
```

### Команда не найдена

Quality Loop попытается автодетект команду. Если не сработало:
```yaml
metrics:
  tests:
    command: "npm test"  # Укажите явно
```

### Тесты всегда fail

Проверьте success_pattern и fail_pattern:
```yaml
metrics:
  tests:
    success_pattern: "✓|pass|success"
    fail_pattern: "✗|fail|error"
```

---

## See Also

- [README.md](README.md) — Основная документация
- [QUICKSTART.md](QUICKSTART.md) — Быстрый старт
- [INSTALL.md](INSTALL.md) — Инструкция по установке
