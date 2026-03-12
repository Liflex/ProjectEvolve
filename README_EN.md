<div align="center">

  # 🤖 AutoResearch

  ### **Autonomous AI-Powered Research and Project Improvement System**

  **Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch)**

  [**Русская документация** → README.md](README.md)

  <br/>

  ![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
  ![Platform](https://img.shields.io/badge/platform-windows%20%7C%20linux%20%7C%20macos-lightgrey)
  ![License](https://img.shields.io/badge/license-MIT-green)
  ![Claude](https://img.shields.io/badge/Claude-AI-purple)

</div>

---

## 💡 Philosophy

> *"Give an AI agent a real project and let it experiment autonomously."*
> — Inspired by Andrej Karpathy's [autoresearch](https://github.com/karpathy/autoresearch)

### The Idea

**AutoResearch** extends the autonomous AI research concept to ANY project:

| Original (karpathy/autoresearch) | AutoResearch |
|----------------------------------|---------------|
| ML training (nanochat) | **Any project** (Python, JS, Go, ...) |
| Only `train.py` | **Any files** — full control |
| Single metric (`val_bpb`) | **Any metrics** — flexibility |
| GPU, training cycles | **CPU, any operations** |
| Specific task | **Universality** |

### What AutoResearch Does?

1. **Analyzes** — studies project structure, code, documentation
2. **Proposes** — generates improvement ideas
3. **Implements** — makes changes to code/structure/docs
4. **Tests** — ensures nothing breaks
5. **Accumulates** — next iteration sees previous results
6. **Repeats** — cycle continues autonomously

---

## 📖 Overview

**AutoResearch** is a universal tool for running an AI agent on any project to autonomously research, improve, and evolve the codebase.

### 🎯 Why AutoResearch?

- **🔄 Autonomous experiments** — AI independently analyzes, proposes, and implements improvements
- **📚 Knowledge accumulation** — each iteration sees previous results, building project knowledge
- **⚡ Universality** — works with Python, JavaScript, Go, Rust, and any other technology
- **🎨 Flexible setup** — simple questionnaire adapts to your project
- **🌐 Cross-platform** — Windows, Linux, macOS

### 💡 How it works?

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────┐
│  Your Project   │─────▶│  AutoResearch│─────▶│  AI Agent   │
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

### Step 2️⃣: Run AutoResearch

After environment setup, run the script:

```bash
# Basic run (10 iterations, 5 min interval)
python F:/IdeaProjects/autoresearch/autoresearch.py --project /path/to/project

# With parameters
python F:/IdeaProjects/autoresearch/autoresearch.py --project . --iter 50 --timeout 2

# Windows (via bat-file)
F:/IdeaProjects/autoresearch/autoresearch.bat . 50 2
```

**Parameters:**
- `--project` — path to your project
- `--iter` — number of iterations (default: 10)
- `--timeout` — interval between iterations in minutes (default: 5)

---

---

## 📂 Project Structure

```
autoresearch/
├── autoresearch.py          # Main script
├── autoresearch.bat         # Windows launcher
├── INSTALL.md               # Installation guide (for AI)
├── README.md                # Russian version
├── README_EN.md             # This file (English)
├── QUICKSTART.md            # Quick guide
├── config/
│   └── default_prompt.md    # Agent prompt template
├── utils/
│   └── cli_setup.py         # Interactive setup
└── .gitignore               # Git ignore
```

### What's created in your project

```
your-project/
├── .autoresearch/
│   ├── .autoresearch.json        # Project configuration
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
   AutoResearch - First Time Setup
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

### Configuration file (`.autoresearch.json`)

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

## 🆚 Karpathy vs AutoResearch

**Improvements over the original:**

| Feature | karpathy/autoresearch | AutoResearch |
|---------|----------------------|---------------|
| **Scope** | ML training (nanochat) | Any project |
| **File restrictions** | Only `train.py` | Any project files |
| **Metrics** | Single (`val_bpb`) | Any (flexible) |
| **Execution** | GPU, training | CPU, any operations |
| **Platform** | Specific | Cross-platform |
| **Knowledge retention** | Within session | Across runs (files) |
| **Setup** | Manual (`program.md`) | Interactive questionnaire |
| **Context** | Instructions | Instructions + previous experiments |

**What's preserved:**
- ✅ Autonomy — agent works independently
- ✅ Iterative improvement — each change is evaluated
- ✅ Human-in-the-loop — human guides via goals/constraints
- ✅ Fail-fast — bad changes are discarded

**What's improved:**
- ✨ Universality — any language, any project type
- 🌐 Cross-platform — Windows, Linux, macOS
- 📚 Persistent memory — context saved across runs
- 🎨 Flexible setup — questionnaire adapts to project
- 🔧 Easy CLI — simple launch for any project

---

## 🎨 Features

### ✨ What can AutoResearch do?

- 🔍 **Analyze** — studies project structure, code, documentation
- 💡 **Propose** — generates improvement ideas
- 🔨 **Implement** — makes changes to code, structure, documentation
- 🧪 **Test** — ensures nothing breaks
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

## 📊 Usage Examples

### Example 1: Quick Test

```bash
# Quick test: 3 experiments, 1 minute interval
python autoresearch.py --project . --iter 3 --timeout 1
```

### Example 2: Long Research Session

```bash
# 50 experiments, 10 minutes interval
python autoresearch.py --project . --iter 50 --timeout 10
```

### Example 3: Configure Only

```bash
# Initial configuration
python autoresearch.py --project /path/to/project --configure

# Later — run
python autoresearch.py --project /path/to/project --iter 10
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
python autoresearch.py --project . --reconfigure
```

---

## 📚 Documentation

- 📖 [INSTALL.md](INSTALL.md) — Installation guide (for AI agent)
- ⚡ [QUICKSTART.md](QUICKSTART.md) — Quick guide
- 🇷🇺 [README.md](README.md) — Русская версия

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
