# AutoResearch Installation Guide for AI Agent

> This document is read by the AI agent during first-time setup to configure the environment for the target system.

> **Implementation Reference:** See `autoresearch.py` for the actual code that implements these steps:
> - **Line 60-130:** `get_claude_command()` - Cross-platform Claude CLI detection
> - **Line 133-175:** `check_claude_cli()` - CLI validation
> - **Line 390-450:** `run_single_experiment()` - Experiment execution
> - **Line 280-360:** `build_agent_prompt()` - Prompt generation with context

---

## Overview

**You are an AI agent setting up AutoResearch for a new project.**

Your task: Detect the operating system and configure the environment accordingly.

The implementation follows the patterns defined in `autoresearch.py`.

---

## ⚠️ Important: Claude Code Permissions

**ProjectEvolve requires Claude Code to run with appropriate permissions.**

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

### What This Means

| Mode | Behavior | Recommendation |
|------|----------|----------------|
| **bypass** | No prompts, full autonomy | ✅ Best for ProjectEvolve |
| **auto** | Auto-approve safe tools | ⚠️ Pre-approve core tools |
| **manual** | Prompt for every tool | ❌ Not recommended |

**If agent hangs during experiment execution:**
1. Check if a permission prompt is waiting for approval
2. Approve the required tool (Edit, Read, Write, etc.)
3. Or switch to bypass mode for full autonomy

**Note:** All scripts have a 30-minute timeout per experiment. If Claude CLI hangs (e.g., on permission prompts), the experiment will time out and continue to the next iteration. Check logs for timeout errors.

---

## Step 1: Detect Operating System

First, determine the target operating system:

```bash
# Check OS (implemented in autoresearch.py:60-80)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    export OS="linux"
    export SHELL_TYPE="bash"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    export OS="macos"
    export SHELL_TYPE="zsh"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    export OS="windows"
    export SHELL_TYPE="pwsh"
else
    # Fallback detection (see autoresearch.py:60-80)
    uname_output=$(uname -s)
    case "$uname_output" in
        Linux*)     export OS="linux"; export SHELL_TYPE="bash" ;;
        Darwin*)    export OS="macos"; export SHELL_TYPE="zsh" ;;
        *MINGW**)   export OS="windows"; export SHELL_TYPE="pwsh" ;;
        *MSYS**)   export OS="windows"; export SHELL_TYPE="pwsh" ;;
        *)          export OS="unknown"; export SHELL_TYPE="bash" ;;
    esac
fi

echo "Detected OS: $OS"
echo "Shell type: $SHELL_TYPE"
```

**Reference:** This OS detection logic is mirrored in `autoresearch.py:60-80` in the `get_claude_command()` function.

---

## Step 2: Platform-Specific Setup

### Linux (Debian/Ubuntu)

```bash
#!/bin/bash
# Linux Setup

# 1. Check Python 3.10+ (autoresearch.py requires Python 3.10+)
if ! command -v python3 &> /dev/null; then
    echo "Installing Python 3..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv
else
    python_version=$(python3 --version | awk '{print $2}')
    echo "Python found: $python_version"
fi

# 2. Check Claude CLI (detected by autoresearch.py:60-130)
if ! command -v claude &> /dev/null; then
    echo "Installing Claude CLI..."
    npm install -g @anthropic-ai/claude-code
else
    echo "Claude CLI found: $(claude --version)"
fi

# 3. Check Git (used for backup branches)
if ! command -v git &> /dev/null; then
    echo "Installing Git..."
    sudo apt-get install -y git
else
    echo "Git found: $(git --version)"
fi

# 4. Create project directories (autoresearch.py:395-400)
mkdir -p .autoresearch/experiments
mkdir -p .autoresearch/logs

# 5. Set permissions
chmod +x autoresearch.py 2>/dev/null || true

echo "✓ Linux setup complete"
```

### Linux (Fedora/RHEL)

```bash
#!/bin/bash
# Fedora/RHEL Setup

sudo dnf install -y python3 python3-pip npm git
npm install -g @anthropic-ai/claude-code

mkdir -p .autoresearch/experiments .autoresearch/logs
chmod +x autoresearch.py 2>/dev/null || true

echo "✓ Fedora/RHEL setup complete"
```

### macOS

```bash
#!/bin/bash
# macOS Setup

# 1. Check Homebrew
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# 2. Install Python 3
if ! command -v python3 &> /dev/null; then
    echo "Installing Python 3..."
    brew install python@3.11
fi

# 3. Install Node.js & npm
if ! command -v npm &> /dev/null; then
    echo "Installing Node.js..."
    brew install node
fi

# 4. Install Claude CLI (detected in autoresearch.py:60-130)
if ! command -v claude &> /dev/null; then
    npm install -g @anthropic-ai/claude-code
fi

# 5. Create project directories (autoresearch.py:395-400)
mkdir -p .autoresearch/experiments .autoresearch/logs

echo "✓ macOS setup complete"
```

### Windows (PowerShell)

```powershell
# Windows PowerShell Setup
# Implementation reference: autoresearch.py:60-130 (Windows detection)

# 1. Check Python
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "Python not found. Please install from https://python.org"
    Write-Host "Recommended: Python 3.11+ with 'Add to PATH' enabled"
    exit 1
}

# 2. Check Node.js & npm
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Host "Node.js not found. Installing via winget..."
    winget install OpenJS.Node.js
}

# 3. Install Claude CLI (detected by autoresearch.py:60-130)
$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
    Write-Host "Installing Claude CLI..."
    npm install -g @anthropic-ai/claude-code
}

# 4. Create project directories (autoresearch.py:395-400)
New-Item -ItemType Directory -Force -Path ".autoresearch\experiments" | Out-Null
New-Item -ItemType Directory -Force -Path ".autoresearch\logs" | Out-Null

Write-Host "✓ Windows setup complete"
```

---

## Step 3: Environment Detection Template

**Use this template to auto-detect and configure:**

```python
#!/usr/bin/env python3
"""
AutoResearch Environment Detector
Auto-detects OS and configures paths for AutoResearch

Implementation reference: This is the template version.
See autoresearch.py for production implementation:
- Line 60-130: get_claude_command() - Claude CLI detection
- Line 133-175: check_claude_cli() - CLI validation
"""

import os
import sys
import platform
import subprocess
from pathlib import Path

class EnvironmentConfig:
    """Auto-detected environment configuration.

    Reference: This class demonstrates the detection logic used
    throughout autoresearch.py for cross-platform support.
    """

    def __init__(self):
        self.os_type = self._detect_os()  # See autoresearch.py:68
        self.python_cmd = self._find_python()
        self.node_cmd = self._find_node()
        self.claude_cmd = self._find_claude()  # See autoresearch.py:60-130
        self.shell_cmd = self._find_shell()
        self.project_root = Path.cwd()

    def _detect_os(self) -> str:
        """Detect operating system.

        Reference: autoresearch.py:68 - uses sys.platform for detection
        """
        system = platform.system().lower()
        if system == "linux":
            return "linux"
        elif system == "darwin":
            return "macos"
        elif system == "windows":
            return "windows"
        else:
            return "unknown"

    def _find_python(self) -> str:
        """Find Python executable.

        Reference: autoresearch.py assumes Python 3.10+ is available
        """
        candidates = ["python3", "python", "py"]
        for cmd in candidates:
            try:
                result = subprocess.run(
                    [cmd, "--version"],
                    capture_output=True,
                    timeout=5
                )
                if result.returncode == 0:
                    return cmd
            except:
                continue
        return "python3"  # Default

    def _find_node(self) -> str:
        """Find Node.js/npm.

        Reference: Required for Claude CLI installation
        """
        try:
            subprocess.run(["npm", "--version"], capture_output=True, timeout=5)
            return "npm"
        except:
            return None

    def _find_claude(self) -> str:
        """Find Claude CLI command.

        Reference: autoresearch.py:60-130 - get_claude_command()
        This demonstrates the detection logic used there.
        """
        if self.os_type == "windows":
            # Try PowerShell (see autoresearch.py:72-81)
            try:
                result = subprocess.run(
                    ["powershell.exe", "-Command", "Get-Command claude | Select-Object -ExpandProperty Source"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    return f'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{result.stdout.strip()}"'
            except:
                pass
            return "claude"
        else:
            # Unix-like (see autoresearch.py:104)
            return "claude"

    def _find_shell(self) -> str:
        """Find default shell.

        Reference: Used in autoresearch.py:409-418 for command execution
        """
        if self.os_type == "windows":
            return "powershell.exe"
        elif self.os_type == "macos":
            return "zsh"
        else:
            return "bash"

    def get_autoresearch_command(self, iterations: int = 10, timeout: int = 5) -> list:
        """Get the command to run AutoResearch.

        Reference: autoresearch.py:390-450 - run_single_experiment()
        This shows how commands are constructed for different platforms.
        """
        autoresearch_py = Path(__file__).parent / "autoresearch.py"

        if self.os_type == "windows":
            # Windows: PowerShell with Claude CLI (see autoresearch.py:409-418)
            return [
                self.python_cmd,
                str(autoresearch_py),
                "--project", str(self.project_root),
                "--iter", str(iterations),
                "--timeout", str(timeout)
            ]
        else:
            # Unix: direct command (see autoresearch.py:418)
            return [
                self.python_cmd,
                str(autoresearch_py),
                "--project", str(self.project_root),
                "--iter", str(iterations),
                "--timeout", str(timeout)
            ]

    def check_dependencies(self) -> dict:
        """Check if all dependencies are installed.

        Reference: autoresearch.py:133-175 - check_claude_cli()
        """
        status = {
            "python": self.python_cmd is not None,
            "node": self.node_cmd is not None,
            "claude": self.claude_cmd is not None,
            "git": self._check_git()
        }
        return status

    def _check_git(self) -> bool:
        """Check if Git is installed.

        Reference: Git is used in autoresearch.py for backup branches
        """
        try:
            subprocess.run(["git", "--version"], capture_output=True, timeout=5)
            return True
        except:
            return False

    def print_status(self):
        """Print environment status."""
        print(f"\n{'='*60}")
        print(f"AutoResearch Environment Detection")
        print(f"{'='*60}")
        print(f"OS Type:     {self.os_type}")
        print(f"Python:      {self.python_cmd}")
        print(f"Node.js:     {self.node_cmd or 'NOT FOUND'}")
        print(f"Claude CLI:  {self.claude_cmd}")
        print(f"Shell:       {self.shell_cmd}")
        print(f"Git:         {'✓' if self._check_git() else '✗'}")
        print(f"{'='*60}\n")

    def install_missing_dependencies(self):
        """Install missing dependencies based on OS.

        Reference: These commands match the platform detection in autoresearch.py:60-130
        """
        missing = [k for k, v in self.check_dependencies().items() if not v]

        if not missing:
            print("✓ All dependencies found!")
            return

        print(f"Missing dependencies: {', '.join(missing)}")
        print("\nTo install, run:")

        if self.os_type == "linux":
            print("  sudo apt-get install python3 python3-pip npm git")
        elif self.os_type == "macos":
            print("  brew install python node git")
        elif self.os_type == "windows":
            print("  # Install from:")
            print("  # Python: https://python.org")
            print("  # Node.js: winget install OpenJS.Node.js")
            print("  # Git: winget install Git.Git")


if __name__ == "__main__":
    env = EnvironmentConfig()
    env.print_status()
    env.install_missing_dependencies()
```

---

## Step 4: Configuration File Template

**AutoResearch auto-creates `.autoresearch.json` on first run.**

If you want to create it manually, here's the template:

```json
{
  "name": "ProjectName",
  "description": "Brief project description",
  "goals": [
    "Goal 1: Improve code quality",
    "Goal 2: Add tests",
    "Goal 3: Update documentation"
  ],
  "constraints": [
    "Don't break existing API",
    "All changes must be tested"
  ],
  "tech_stack": ["Python", "FastAPI", "PostgreSQL"],
  "focus_areas": ["Performance", "Security", "Documentation"],
  "memory_files": [
    ".claude/memory/lessons.md",
    ".claude/memory/patterns.md",
    ".claude/memory/architecture.md"
  ],
  "context_files": [
    "README.md",
    "CLAUDE.md"
  ]
}
```

**Auto-detection:** On first run, AutoResearch tries to detect:
- `name` from directory name or `package.json`/`pyproject.toml`
- `tech_stack` from project files (package.json, requirements.txt, etc.)

**Reference:** This config is loaded by `ProjectConfig` class in `autoresearch.py:209-240`

---

## Step 5: Validation

**After setup, validate the installation:**

```bash
# Validation script (implements checks from autoresearch.py:133-175)
python3 << 'EOF'
import subprocess
import sys

checks = [
    ("Python", ["python3", "--version"]),
    ("Claude CLI", ["claude", "--version"]),
    ("Git", ["git", "--version"]),
]

print("Validating installation...")
all_ok = True

for name, cmd in checks:
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=5)
        if result.returncode == 0:
            print(f"✓ {name}: {result.stdout.decode().strip()}")
        else:
            print(f"✗ {name}: NOT FOUND")
            all_ok = False
    except:
        print(f"✗ {name}: NOT FOUND")
        all_ok = False

if all_ok:
    print("\n✓ All dependencies installed!")
    sys.exit(0)
else:
    print("\n✗ Some dependencies missing. Install them first.")
    sys.exit(1)
EOF
```

**Reference:** Validation logic mirrors `check_claude_cli()` in `autoresearch.py:133-175`

---

## Step 6: Running Experiments

**Once configured, experiments run as follows:**

```bash
# Command construction (see autoresearch.py:390-450)
python autoresearch.py --project /path/to/project --iter 10 --timeout 5

# For each experiment (autoresearch.py:409-425):
# - Build prompt with context (autoresearch.py:280-360)
# - Execute via detected Claude CLI command
# - Save output to .autoresearch/experiments/output_N.md
# - Parse results and check for completion marker
```

---

## Agent Instructions Summary

**When setting up a new project:**

1. **Detect OS** → Use appropriate install commands (ref: `autoresearch.py:68`)
2. **Install dependencies** → Python, Node.js, Claude CLI (ref: `autoresearch.py:60-130`)
3. **Create directories** → `.autoresearch/experiments`, `.autoresearch/logs` (ref: `autoresearch.py:395-400`)
4. **Generate config** → `.autoresearch.json` (ref: `autoresearch.py:180-220`)
5. **Validate** → Check all dependencies (ref: `autoresearch.py:133-175`)
6. **Run experiments** → Use detected Claude CLI command (ref: `autoresearch.py:390-450`)

**Key principle:** All commands in `autoresearch.py` are designed to work cross-platform. Follow the same patterns.

---

## Code Reference Summary

| Function | Lines | Purpose |
|----------|-------|---------|
| `get_claude_command()` | 60-130 | Cross-platform Claude CLI detection |
| `check_claude_cli()` | 133-175 | Validates Claude CLI installation |
| `build_agent_prompt()` | 280-360 | Generates prompt with accumulated context |
| `run_single_experiment()` | 390-450 | Executes one experiment using detected CLI |
| `run_autoresearch()` | 470-540 | Main loop, orchestrates experiments |

**For platform-specific details:** See the inline comments in each function referencing `INSTALL.md`.

---

## Memory Entry Priority System

Когда AI агент добавляет записи в `.claude/memory/`, он должен использовать систему приоритетов:

### Метки для записей

**[CRITICAL]** — Фундаментальные вещи
```markdown
## [CRITICAL] Lesson: Priority Scoring System Architecture
## [CRITICAL] Pattern: AutoResearch Experiment Structure
```

**[IMPORTANT]** — Важные паттерны
```markdown
## [IMPORTANT] Pattern: Cascade Merge Strategies
## [IMPORTANT] Lesson: Profile Recommender Improves Discoverability
```

**Без метки** — minor improvements (не попадут в контекст)

### Лимиты контекста

AutoResearch agent использует `read_last_entries()` которая:
- Включает только `[CRITICAL]` и `[IMPORTANT]` записи
- Исключает обычные записи
- Ограничивает промпт до 30-50 KB вместо 200+ KB

### Когда использовать метки

- **CRITICAL**: key features, фундаментальная архитектура
- **IMPORTANT**: значимые UX улучшения, reusable patterns
- **Без метки**: minor fixes, generic quality rules

---

## Running AutoResearch on Other Projects

### Overview

AutoResearch runs **isolated** from the autoresearch project itself. All files are created in the **target project** directory.

### File Structure in Target Project

When you run AutoResearch on project `F:\IdeaProjects\myproject`:

```
F:\IdeaProjects\myproject\
├── .autoresearch/
│   ├── experiments/
│   │   ├── prompt_N.md          # Generated prompt for experiment N
│   │   ├── output_N.md          # AI agent's response
│   │   ├── last_experiment.md   # Last experiment summary (for agent, rewritten)
│   │   ├── accumulation_context.md  # Full experiment history (for human, appended)
│   │   ├── changes_log.md       # Changes chronology (for human, appended)
│   │   └── summary.json         # All results summary
│   ├── logs/
│   │   └── autoresearch.log     # Execution logs
│   └── .autoresearch.json       # Project configuration
├── .claude/
│   └── memory/
│       ├── lessons.md           # Lessons learned (use [CRITICAL]/[IMPORTANT] tags)
│       ├── patterns.md          # Reusable patterns (use [CRITICAL]/[IMPORTANT] tags)
│       └── architecture.md      # Architecture decisions (use [CRITICAL]/[IMPORTANT] tags)
└── [project files...]
```

**Git branches:** Created in target project (e.g., `autoresearch-20260313-013849`)

### Quick Start

```bash
# 1. Navigate to autoresearch directory
cd F:/IdeaProjects/autoresearch

# 2. Run on target project
python autoresearch.py --project F:/IdeaProjects/bybittrader --iter 10 --timeout 5

# 3. Or run from anywhere with full path
python F:/IdeaProjects/autoresearch/autoresearch.py --project /path/to/target --iter 5
```

### Configuration File

AutoResearch auto-creates `.autoresearch.json` in the target project:

```json
{
  "name": "ProjectName",
  "description": "Project description",
  "goals": ["Goal 1", "Goal 2"],
  "constraints": ["Constraint 1"],
  "tech_stack": ["Python", "FastAPI"],
  "focus_areas": ["Performance", "Security"]
}
```

### ⚠️ Important: Cannot Run from Within Claude Code

**Issue:** AutoResearch cannot execute Claude CLI from within a Claude Code session due to nested session protection.

**Solution:** Run AutoResearch from a regular terminal:

```bash
# ❌ DON'T: Run from within Claude Code
# This will fail with nested session error

# ✅ DO: Run from regular terminal
cd F:/IdeaProjects/autoresearch
python autoresearch.py --project F:/IdeaProjects/bybittrader --iter 10
```

### Example: BybitTrader Experiment

Test run on `F:\IdeaProjects\bybittrader`:

```bash
cd F:/IdeaProjects/autoresearch
python autoresearch.py --project F:/IdeaProjects/bybittrader --iter 1 --timeout 0
```

**Results:**
- ✅ `.autoresearch/` created in bybittrader (not in autoresearch)
- ✅ Git branch `autoresearch-20260313-013849` created in bybittrader
- ✅ Configuration `.autoresearch.json` created
- ✅ Prompt `prompt_1.md` generated
- ❌ Claude CLI blocked (nested session protection)

### Verification

After running AutoResearch, verify isolation:

```bash
# Check target project
ls F:/IdeaProjects/myproject/.autoresearch/experiments/
# Output: prompt_1.md, output_1.md, etc.

cd F:/IdeaProjects/myproject
git branch
# Output: * autoresearch-YYYYMMDD-HHMMSS

# Check autoresearch project (should be unchanged)
git -C F:/IdeaProjects/autoresearch status
# Output: clean (no changes)
```

### Troubleshooting

**Error: "Claude CLI not found"**
```bash
# Install Claude CLI
npm install -g @anthropic-ai/claude-code
```

**Error: "Nested session detected"**
- Run from regular terminal, not from within Claude Code

**Error: "Permission denied"**
- Check Claude Code permissions mode
- Use `bypass permissions on` for full autonomy

**No output files created**
- Check logs: `cat .autoresearch/logs/autoresearch.log`
- Verify Claude CLI: `claude --version`

