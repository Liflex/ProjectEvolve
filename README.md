<div align="center">

  # 🧪 ProjectEvolve

  ### **Autonomous AI-Powered Research and Project Improvement System**

  [**Русская документация → README_RU.md](README_RU.md)]

  <br/>

  ![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
  ![Platform](https://img.shields.io/badge/platform-windows%20%7C%20linux%20%7C%20macos-lightgrey)
  ![License](https://img.shields.io/badge/license-MIT-green)
  ![Claude](https://img.shields.io/badge/Claude-AI-purple)

</div>

---

## 💡 Philosophy

> *"Give an AI agent a real project and let it experiment autonomously."*
> — Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch)

### Difference from Original

**Original karpathy/autoresearch** — AI agent researches neural network training (nanochat), modifying only `train.py` with a single `val_bpb` metric.

**ProjectEvolve** — extends this idea to **any project**:
- Any programming language (Python, JavaScript, Go, Rust, ...)
- Any task types (backend, frontend, DevOps, documentation, ...)
- Any files and directories (full freedom of action)
- Cross-platform (Windows, Linux, macOS)
- Knowledge persistence across runs

**Key inheritance:** agent works autonomously, iteratively improves project, keeps successful changes, discards failures.

---

## 📖 Overview

**ProjectEvolve** is a universal tool for running an AI agent on any project. The agent autonomously analyzes code, proposes improvements, makes changes, and learns from previous experiments.

### What ProjectEvolve Does?

1. **Analyzes** — studies project structure, code, documentation
2. **Proposes** — generates improvement ideas
3. **Implements** — makes changes to code/structure/docs
4. **Tests** — ensures nothing breaks
5. **Accumulates** — next iteration sees previous results
6. **Repeats** — cycle continues autonomously

### 🎯 Why ProjectEvolve?

- **🔄 Autonomous experiments** — AI independently analyzes, proposes, and implements improvements
- **📚 Knowledge accumulation** — each iteration sees previous results, building project knowledge
- **⚡ Universality** — works with Python, JavaScript, Go, Rust, and any other technology
- **🎨 Flexible setup** — simple questionnaire adapts to project
- **🌐 Cross-platform** — Windows, Linux, macOS
- **🔧 Zero maintenance** — agent handles everything

### 💡 How it works?

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────┐
│  Your Project   │─────▶│ ProjectEvolve│─────▶│  AI Agent   │
│  (any language) │      │  (script)    │      │  (Claude)   │
└─────────────────┘      └──────────────┘      └─────────────┘
                                │                      │
                                ▼                      ▼
                        ┌──────────────┐      ┌─────────────┐
                        │ Configuration│      │ Experiment  │
                        │ .autoresearch│      │ #1, #2, #3  │
                        └──────────────┘      └─────────────┘
                                │                      │
                                ▼                      ▼
                        ┌──────────────┐      ┌─────────────┐
                        │  Improvements│◀─────│  Context    │
                        │  code/docs    │      │  accumulates│
                        └──────────────┘      └─────────────┘
```

---

## 🎨 Features

### ✨ What can ProjectEvolve do?

- 🔍 **Analyze** — studies project structure, code, documentation
- 💡 **Propose** — generates improvement ideas
- 🔨 **Implement** — makes changes to code, structure, documentation
- 🧪 **Quality Loop** — built-in self-testing with quantitative metrics
- 📊 **Evaluate** — automatic scoring (0.0-1.0) with pass/fail decisions
- 📝 **Document** — updates README, creates new documentation
- 🔄 **Iterate** — each iteration learns from previous ones

### 🌐 Cross-platform Support

| Platform | Support | Installation |
|----------|----------|--------------|
| **Windows** | ✅ Full | `autoresearch.bat` |
| **Linux** | ✅ Full | `python autoresearch.py` |
| **macOS** | ✅ Full | `python autoresearch.py` |

### 🔧 Technologies

- Python 3.10+
- Claude CLI (Anthropic)
- Git (optional)

---

## 🔄 Quality Loop

ProjectEvolve includes a **built-in self-testing system** inspired by quality gates:

### How Quality Loop Works

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Generate   │─────▶│    Apply     │─────▶│   Evaluate   │
│   Idea       │      │   Changes    │      │   (Score)    │
└──────────────┘      └──────────────┘      └──────┬───────┘
                                                    │
                                                    ▼
                                             ┌──────────────┐
                                             │   Decision   │
                                             │  KEEP/DISCARD│
                                             └──────────────┘
                                                    │
                              ┌─────────────────────┘
                              │ (if kept)
                              ▼
                      ┌──────────────┐
                      │   Next Iter.  │
                      └──────────────┘
```

### Quality Gate Features

- **Universal** — works with Python, JavaScript, Go, Rust, Ruby, Java, any language
- **Auto-detect** — automatically finds test commands (`npm test`, `pytest`, `cargo test`, etc.)
- **Quantitative** — scores 0.0-1.0 with pass/fail decisions
- **Two-phase** — Phase A (base quality, 70% threshold) → Phase B (strict quality, 85% threshold)
- **Automatic** — runs tests after each experiment, decides to keep or discard changes

### Running Quality Loop

```bash
# Standalone quality check
python F:/IdeaProjects/autoresearch/utils/quality_loop.py --project /path/to/project

# Custom thresholds
python utils/quality_loop.py --project . --threshold-a 0.7 --threshold-b 0.85

# JSON output for parsing
python utils/quality_loop.py --project . --json
```

### Quality Configuration

Configuration file `.autoresearch/quality.yml` is created automatically:

```yaml
metrics:
  tests:
    enabled: true
    command: ""  # Auto-detect: npm test, pytest, cargo test, etc.
  build:
    enabled: false
    command: ""  # Auto-detect: npm run build, cargo build, etc.

thresholds:
  a:
    min_score: 0.7  # Phase A threshold
    required_checks: ["tests"]
  b:
    min_score: 0.85  # Phase B threshold
    required_checks: ["tests", "build"]
```

### Decision Logic

**Keep changes if:**
- ✅ Score ≥ baseline + 0.05 (improvement)
- ✅ All required checks pass
- ✅ No critical failures

**Discard changes if:**
- ❌ Score decreased
- ❌ Critical tests fail
- ❌ Violates project constraints

**Manual review if:**
- ⚠️ Score ~ baseline (minimal change)
- ⚠️ Some non-critical tests fail

---

## ⚠️ Important: Claude Code Permissions

ProjectEvolve requires Claude Code to run with appropriate permissions.

### Permissions Mode

- ✅ **"bypass permissions on"** — Recommended! No approvals needed, full autonomy
- ⚠️ **Other modes (auto/manual)** — May require permission approvals during execution
- ❌ **Risk:** Agent may hang waiting for user to approve tool usage

### Required Tools

ProjectEvolve agent needs these tools to be approved (if not in bypass mode):

**Core tools:**
- `Edit` — Modify files
- `Read` — Read file contents
- `Write` — Create new files
- `Glob` — Find files by pattern
- `Grep` — Search file contents

**Optional tools:**
- `Bash` — Execute shell commands (for Quality Loop)
- `Agent` — Spawn sub-agents

### Recommended Settings

**Option 1: Bypass Mode (Recommended)**
```json
{
  "permissionMode": "bypass"
}
```

**Option 2: Auto-Approve Safe Tools**
```json
{
  "permissionMode": "auto",
  "autoApproveSafeTools": true,
  "alwaysAllowTools": ["Edit", "Read", "Write", "Glob", "Grep"]
}
```

**If agent hangs during experiment execution:**
1. Check if a permission prompt is waiting for approval
2. Approve the required tool (Edit, Read, Write, etc.)
3. Or switch to bypass mode for full autonomy

---

## 🚀 Quick Start

### Step 1️⃣: Environment Setup by AI Agent

**For AI agent:** Read `INSTALL.md` and configure the system:

```bash
# AI agent sets up the environment
# (install Python, Node.js, Claude CLI, create directories)
```

**AI agent will:**
- ✅ Detect OS (Windows/Linux/macOS)
- ✅ Install missing dependencies
- ✅ Create required directories
- ✅ Verify installation

> **See:** `INSTALL.md` — this is the instruction for AI agent on cross-platform setup.

### Step 2️⃣: Run ProjectEvolve

After environment setup, run the script:

```bash
# Basic run (10 iterations, 5 min interval)
python F:/IdeaProjects/autoresearch/autoresearch.py --project /path/to/project

# With parameters
python F:/IdeaProjects/autoresearch/autoresearch.py --project . --iter 50 --timeout 2

# Windows (via bat-file)
F:/IdeaProjects/autoresearch/autoresearch.py . 50 2
```

**Parameters:**
- `--project` — path to your project
- `--iter` — number of iterations (default: 10)
- `--timeout` — interval between iterations in minutes (default: 5)

---

## 📂 Project Structure

```
autoresearch/
├── autoresearch.py          # Main script
├── autoresearch.bat         # Windows launcher
├── INSTALL.md               # Installation guide (for AI)
├── README.md                # This file (English main)
├── README_RU.md             # Russian version (full)
├── QUICKSTART.md            # Quick guide
├── config/
│   ├── default_prompt.md    # Agent prompt template
│   └── quality.yml          # Quality gate configuration
├── utils/
│   ├── cli_setup.py         # Interactive setup
│   └── quality_loop.py      # Quality loop implementation
└── .gitignore               # Git ignore
```

### What's Created in Your Project

```
your-project/
├── .autoresearch/
│   ├── .autoresearch.json        # Project configuration
│   ├── quality.yml               # Quality gate configuration (auto-created)
│   ├── experiments/
│   │   ├── prompt_1.md
│   │   ├── output_1.md
│   │   ├── accumulation_context.md  # Accumulated context
│   │   ├── last_experiment.md      # Last experiment
│   │   ├── changes_log.md          # Changes log
│   │   └── summary.json            # Final summary
│   └── logs/
│       └── autoresearch.log         # Run logs
```

---

## 🔧 Configuration

### First Run

```
========================================================================
   ProjectEvolve - First Time Setup
========================================================================

Project: /path/to/your-project

Project name: My Awesome App
Short description: Web app for task management

Project goals (one per line):
  > Improve performance
  > Add tests
  > Update documentation
  > [Enter]

Constraints (optional):
  > Don't change API
  > [Enter]

✓ Configuration saved!
```

### Configuration File (`.autoresearch.json`)

```json
{
  "name": "My Awesome App",
  "description": "Web app for task management",
  "goals": [
    "Improve performance",
    "Add tests",
    "Update documentation"
  ],
  "constraints": [
    "Don't change API"
  ],
  "tech_stack": ["Python", "FastAPI", "PostgreSQL"],
  "focus_areas": ["performance", "testing", "documentation"]
}
```

---

## 📊 Usage Examples

### Example 1: Quick Test

```bash
# Quick test: 3 experiments, 1 minute interval
python F:/IdeaProjects/autoresearch/autoresearch.py --project . --iter 3 --timeout 1
```

### Example 2: Long Research Session

```bash
# 50 experiments, 10 minutes interval
python F:/IdeaProjects/autoresearch/autoresearch.py --project . --iter 50 --timeout 10
```

### Example 3: Configure Only

```bash
# Initial configuration
python F:/IdeaProjects/autoresearch/autoresearch.py --project /path/to/project --configure

# Later — run
python F:/IdeaProjects/autoresearch/autoresearch.py --project /path/to/project --iter 10
```

---

## 🛠️ Troubleshooting

### Claude CLI not found

```bash
npm install -g @anthropic-ai/claude-code
```

### Python not found

Install Python 3.10+ and add to PATH.

### Experiments hang

Increase interval between iterations (`--timeout`).

### Wrong context

```bash
python F:/IdeaProjects/autoresearch/autoresearch.py --project . --reconfigure
```

---

## 📚 Documentation

- 📖 [INSTALL.md](INSTALL.md) — Installation guide (for AI agent)
- ⚡ [QUICKSTART.md](QUICKSTART.md) — Quick guide
- 🇷🇺 [README_RU.md](README_RU.md) — Русская версия

---

## 🤝 Contributing

Contributions welcome! Create issues and pull requests.

### Ideas for Improvement

- 🌐 Web UI for experiment monitoring
- 📊 Progress visualization
- 🔔 Completion notifications
- 📈 Metrics and analytics
- 🔄 CI/CD integration

---

## 📄 License

MIT License — freely use in any project.

---

## ⭐ Stars

If you find this project useful, please give it a star on GitHub!

<div align="center">

  **Made with ❤️ for autonomous project research**

</div>
