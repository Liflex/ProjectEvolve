# AutoResearch Installation Guide for AI Agent

> This document is read by the AI agent during first-time setup to configure the environment for the target system.

---

## Overview

**You are an AI agent setting up AutoResearch for a new project.**

Your task: Detect the operating system and configure the environment accordingly.

---

## Step 1: Detect Operating System

First, determine the target operating system:

```bash
# Check OS
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
    # Fallback detection
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

---

## Step 2: Platform-Specific Setup

### Linux (Debian/Ubuntu)

```bash
#!/bin/bash
# Linux Setup

# 1. Check Python 3.10+
if ! command -v python3 &> /dev/null; then
    echo "Installing Python 3..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv
else
    python_version=$(python3 --version | awk '{print $2}')
    echo "Python found: $python_version"
fi

# 2. Check Claude CLI
if ! command -v claude &> /dev/null; then
    echo "Installing Claude CLI..."
    npm install -g @anthropic-ai/claude-code
else
    echo "Claude CLI found: $(claude --version)"
fi

# 3. Check Git
if ! command -v git &> /dev/null; then
    echo "Installing Git..."
    sudo apt-get install -y git
else
    echo "Git found: $(git --version)"
fi

# 4. Create project directories
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

# 4. Install Claude CLI
if ! command -v claude &> /dev/null; then
    npm install -g @anthropic-ai/claude-code
fi

# 5. Create project directories
mkdir -p .autoresearch/experiments .autoresearch/logs

echo "✓ macOS setup complete"
```

### Windows (PowerShell)

```powershell
# Windows PowerShell Setup

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

# 3. Install Claude CLI
$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
    Write-Host "Installing Claude CLI..."
    npm install -g @anthropic-ai/claude-code
}

# 4. Create project directories
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
"""

import os
import sys
import platform
import subprocess
from pathlib import Path

class EnvironmentConfig:
    """Auto-detected environment configuration."""

    def __init__(self):
        self.os_type = self._detect_os()
        self.python_cmd = self._find_python()
        self.node_cmd = self._find_node()
        self.claude_cmd = self._find_claude()
        self.shell_cmd = self._find_shell()
        self.project_root = Path.cwd()

    def _detect_os(self) -> str:
        """Detect operating system."""
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
        """Find Python executable."""
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
        """Find Node.js/npm."""
        try:
            subprocess.run(["npm", "--version"], capture_output=True, timeout=5)
            return "npm"
        except:
            return None

    def _find_claude(self) -> str:
        """Find Claude CLI command."""
        if self.os_type == "windows":
            # Try PowerShell
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
            # Unix-like
            return "claude"

    def _find_shell(self) -> str:
        """Find default shell."""
        if self.os_type == "windows":
            return "powershell.exe"
        elif self.os_type == "macos":
            return "zsh"
        else:
            return "bash"

    def get_autoresearch_command(self, iterations: int = 10, timeout: int = 5) -> list:
        """Get the command to run AutoResearch."""
        autoresearch_py = Path(__file__).parent / "autoresearch.py"

        if self.os_type == "windows":
            return [
                self.python_cmd,
                str(autoresearch_py),
                "--project", str(self.project_root),
                "--iter", str(iterations),
                "--timeout", str(timeout)
            ]
        else:
            return [
                self.python_cmd,
                str(autoresearch_py),
                "--project", str(self.project_root),
                "--iter", str(iterations),
                "--timeout", str(timeout)
            ]

    def check_dependencies(self) -> dict:
        """Check if all dependencies are installed."""
        status = {
            "python": self.python_cmd is not None,
            "node": self.node_cmd is not None,
            "claude": self.claude_cmd is not None,
            "git": self._check_git()
        }
        return status

    def _check_git(self) -> bool:
        """Check if Git is installed."""
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
        """Install missing dependencies based on OS."""
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

**Create `.autoresearch.json` with detected values:**

```json
{
  "environment": {
    "os": "{{OS_TYPE}}",
    "shell": "{{SHELL_TYPE}}",
    "python": "{{PYTHON_CMD}}",
    "node": "{{NODE_CMD}}"
  },
  "project": {
    "name": "{{PROJECT_NAME}}",
    "description": "{{PROJECT_DESCRIPTION}}",
    "root": "{{PROJECT_ROOT}}"
  },
  "paths": {
    "experiments": ".autoresearch/experiments",
    "logs": ".autoresearch/logs",
    "memory": ".autoresearch/memory"
  }
}
```

---

## Step 5: Validation

**After setup, validate the installation:**

```bash
# Validation script
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

---

## Agent Instructions Summary

**When setting up a new project:**

1. Detect OS → Use appropriate install commands
2. Install missing dependencies
3. Create `.autoresearch/` directories
4. Generate `.autoresearch.json` config
5. Validate installation
6. Run first experiment

**Key principle:** Adapt commands to the detected OS, don't assume any specific platform.
