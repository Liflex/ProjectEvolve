#!/usr/bin/env python3
"""
AutoResearch UI - Web Dashboard for running and monitoring experiments.

Usage:
    python ui/server.py                        # Serve current directory's project
    python ui/server.py --project /path/to     # Serve specific project
    python ui/server.py --port 3000            # Custom port
"""

import asyncio
import json
import logging
import os
import re
import subprocess
import sys
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

from starlette.middleware.base import BaseHTTPMiddleware

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "utils"))

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import HTMLResponse, FileResponse
    from fastapi.staticfiles import StaticFiles
    from pydantic import BaseModel, Field, field_validator
except ImportError:
    print("ERROR: FastAPI not installed. Run:")
    print("  pip install fastapi uvicorn")
    sys.exit(1)

# =============================================================================
# CONFIG
# =============================================================================

AUTORESEARCH_HOME = Path(__file__).parent.parent.resolve()
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="AutoResearch UI", docs_url="/api/docs")

# CSP policy: allow CDN scripts (Tailwind, Alpine, marked, DOMPurify, Google Fonts)
# and inline scripts/styles (required by Alpine.js directives + Tailwind).
# connect-src restricted to same-origin to prevent data exfiltration.
CSP_POLICY = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
        "https://cdn.tailwindcss.com "
        "https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
    "font-src 'self' https://fonts.gstatic.com; "
    "connect-src 'self' ws: wss: https://cdn.jsdelivr.net https://cdn.tailwindcss.com; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)


class CSPMiddleware(BaseHTTPMiddleware):
    """Add Content-Security-Policy header to all responses."""
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = CSP_POLICY
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app.add_middleware(CSPMiddleware)



run_state = {
    "running": False,
    "process": None,
    "current_exp": 0,
    "total_exps": 0,
    "project": "",
    "started_at": None,
    "logs": [],
    "error": None,
    "_lock": threading.Lock(),  # Protects concurrent log access from reader threads + ASGI
}

# Regex to detect experiment progress from autoresearch.py log output
_EXP_PROGRESS_RE = re.compile(r"(?:Эксперимент|Experiment)\s+(\d+)/(\d+)")

MAX_LOG_ENTRIES = 500


# =============================================================================
# HELPERS
# =============================================================================

def _log_append(text: str):
    """Thread-safe append to run_state["logs"] with size cap."""
    with run_state["_lock"]:
        run_state["logs"].append(text)
        if len(run_state["logs"]) > MAX_LOG_ENTRIES:
            run_state["logs"] = run_state["logs"][-MAX_LOG_ENTRIES:]


def _log_read(last_n: int = None) -> list:
    """Thread-safe read of run_state["logs"]. Returns a snapshot."""
    with run_state["_lock"]:
        logs = run_state["logs"]
        return logs[-last_n:] if last_n else list(logs)


def get_project_dir() -> Path:
    return Path(os.environ.get("AUTORESEARCH_PROJECT", Path.cwd()))


# File extensions that may contain secrets — blocked from read/search APIs
SECRET_EXTS = {'.env', '.env.local', '.env.production', '.env.staging',
              '.env.development', '.env.test', '.key', '.pem', '.p12',
              '.pfx', '.jks', '.keystore', '.credentials', '.htpasswd'}

# File names that may contain secrets — blocked from read/search APIs
SECRET_NAMES = {'.env', '.env.local', '.env.production', '.env.staging',
                '.env.development', '.env.test', 'credentials', '.credentials',
                '.htpasswd', 'id_rsa', 'id_ed25519', 'id_ecdsa',
                'id_rsa.pub', 'id_ed25519.pub', 'id_ecdsa.pub'}


def _validate_project_path(raw_path: str) -> Path:
    """Validate and resolve a project path, blocking path traversal outside allowed bases.

    Returns the resolved Path if valid.
    Raises HTTPException(403) if path escapes allowed directories.
    """
    resolved = Path(raw_path).resolve()
    allowed_bases = {get_project_dir().resolve(), Path.cwd().resolve()}
    if not any(_is_subpath(resolved, base) for base in allowed_bases):
        raise HTTPException(status_code=403, detail="Path traversal blocked")
    return resolved


def _is_subpath(child: Path, parent: Path) -> bool:
    """Check if child path is within parent directory (or equal to it)."""
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def get_exp_dir() -> Path:
    d = get_project_dir() / ".autoresearch" / "experiments"
    # Auto-create directory structure if missing
    if not d.exists():
        d.mkdir(parents=True, exist_ok=True)
    return d


_RE_EXP_HEADER = re.compile(r"## Experiment (\d+)")
_RE_EXP_SPLIT = re.compile(r"(?=^## Experiment \d+)", re.MULTILINE)


def parse_accumulation_context(ctx_file: Path, content: str = None) -> List[Dict[str, Any]]:
    """Parse accumulation_context.md into a list of experiment dicts."""
    if content is None:
        try:
            content = ctx_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return []
    experiments = []
    for section in _RE_EXP_SPLIT.split(content):
        m = _RE_EXP_HEADER.match(section)
        if not m:
            continue
        number = int(m.group(1))
        # Extract metadata — handle both plain and markdown bold (**Field:**) formats
        title_m = re.search(r"## Experiment \d+[—:\-]\s*(.+)", section)
        title = title_m.group(1).strip() if title_m else f"Experiment {number}"
        date_m = re.search(r"\*{0,2}Date:\*{0,2}\s*(.+)", section)
        date = date_m.group(1).strip() if date_m else ""
        score_m = re.search(r"\*{0,2}Score:\*{0,2}\s*([\d.]+)", section)
        score = float(score_m.group(1)) if score_m else 0.5
        decision_m = re.search(r"\*{0,2}Decision:\*{0,2}\s*(KEEP|DISCARD|ACCEPT|N/A)", section)
        decision = decision_m.group(1) if decision_m else "N/A"
        type_m = re.search(r"\*{0,2}Type:\*{0,2}\s*(.+)", section)
        exp_type = type_m.group(1).strip() if type_m else "Unknown"
        experiments.append({
            "number": number, "title": title, "date": date,
            "score": str(score), "decision": decision, "type": exp_type,
        })
    return experiments


def _extract_section(section_text: str, name: str) -> str:
    """Extract a ### Name subsection from a single experiment section."""
    m = re.search(
        rf"### {re.escape(name)}\s*\n(.*?)(?=\n### |\n---|\Z)", section_text, re.DOTALL
    )
    return m.group(1).strip() if m else ""


# Defaults for experiment entries — prevents null/undefined in frontend
_EXP_DEFAULTS = {
    "number": 0, "title": "Unknown", "date": "", "type": "Unknown",
    "score": "0.5", "decision": "N/A",
}


def _enrich_experiment(entry: Dict[str, Any], section: str, exp_dir: Path = None) -> Dict[str, Any]:
    """Add UI-specific fields (what_done, files_modified, results, notes)
    by parsing the raw section text from accumulation_context.md.
    Also extracts Type and Decision from the output file if missing."""
    if not entry or not isinstance(entry, dict):
        entry = {}
    # Fill missing fields with defaults
    for k, v in _EXP_DEFAULTS.items():
        if entry.get(k) is None:
            entry[k] = v

    # If Type/Decision are still defaults, try to extract from output file
    if exp_dir and (entry.get("type") == "Unknown" or entry.get("decision") == "N/A"):
        output_file = exp_dir / f"output_{entry.get('number', 0)}.md"
        if output_file.exists():
            try:
                output_content = output_file.read_text(encoding="utf-8")
                if entry.get("type") == "Unknown":
                    type_m = re.search(r"\*\*Type:\*\*\s*(.+)", output_content)
                    if type_m:
                        entry["type"] = type_m.group(1).strip()
                if entry.get("decision") == "N/A":
                    result_m = re.search(r"\*\*Result:\*\*\s*(KEEP|DISCARD)", output_content)
                    if result_m:
                        entry["decision"] = result_m.group(1)
            except (OSError, UnicodeDecodeError):
                pass

    # Derive score from decision if no explicit score
    if entry.get("score", "0.5") == "0.5" and entry.get("decision") != "N/A":
        if entry["decision"] == "KEEP":
            entry["score"] = "0.85"
        elif entry["decision"] == "DISCARD":
            entry["score"] = "0.3"

    files_section = _extract_section(section, "Files Modified")
    files_modified = []
    if files_section:
        for line in files_section.split("\n"):
            line = line.strip().lstrip("- *").strip().strip("`")
            if line and line not in ("None", "none", "N/A"):
                files_modified.append(line)

    # Load persisted judge verdict if available
    judge_verdict = None
    judge_all_verdicts = None
    if exp_dir:
        import json as _json
        judge_file = exp_dir / f"judge_{entry.get('number', 0)}.json"
        if judge_file.exists():
            try:
                judge_verdict = _json.loads(judge_file.read_text(encoding="utf-8"))
            except (OSError, _json.JSONDecodeError):
                pass
        judge_all_file = exp_dir / f"judge_{entry.get('number', 0)}_all.json"
        if judge_all_file.exists():
            try:
                judge_all_verdicts = _json.loads(judge_all_file.read_text(encoding="utf-8"))
            except (OSError, _json.JSONDecodeError):
                pass

    return {
        **entry,
        "what_done": _extract_section(section, "What Was Done"),
        "files_modified": files_modified,
        "results": _extract_section(section, "Results"),
        "notes": _extract_section(section, "Notes for Next"),
        "judge_verdict": judge_verdict,
        "judge_all_verdicts": judge_all_verdicts,
    }


# File-mtime cache: avoids re-reading and re-parsing accumulation_context.md
# on every API call (dashboard polls /api/stats every 1s).
_cache = {"data": None, "mtime": 0.0}


def _ensure_context_files():
    """Auto-create missing experiment infrastructure files."""
    exp_dir = get_exp_dir()
    for fname in ("accumulation_context.md", "changes_log.md"):
        fpath = exp_dir / fname
        if not fpath.exists():
            fpath.write_text("", encoding="utf-8")


# Default content templates for auto-created files
_DEFAULT_PROMPT = """# AutoResearch Experiment {iteration}/{total}

Вы — автономный AI-исследователь. Ваша цель — находить и реализовывать реально полезные улучшения проекта "{project_name}".

## О проекте

**Название:** {project_name}

**Описание:**
{description}

## Цели проекта

{goals}

{completed_goals}

## Технический стек

{tech_stack}

---

## Scope Boundaries (CRITICAL)

Фокус на quality of life, безопасность, UX и практическую пользу.

## Формат отчёта

```markdown
## Experiment Report

**Number:** {iteration}
**Title:** [краткое название]
**Files Modified:** [список]
**Changes Made:** [описание]
**Results:** [результаты]

>>>EXPERIMENT_COMPLETE<<<
```

Начинайте эксперимент {iteration}.
"""

_DEFAULT_PROJECT_CONFIG = {
    "name": "",
    "description": "",
    "goals": [],
    "completed_goals": [],
    "constraints": [],
    "tech_stack": [],
}

_MEMORY_HEADER = """# {title}

> Auto-created by AutoResearch UI
> Project: {project}

---
"""


def ensure_project_structure(verbose: bool = False):
    """Verify and create all required project files at server startup.

    Checks for:
    - .autoresearch.json (project config)
    - config/ prompt templates (default, execution, quality)
    - .autoresearch/experiments/ context files
    - .claude/memory/ files (lessons, patterns, architecture)

    Creates missing files with sensible defaults so the dashboard and
    experiment runner never crash on missing infrastructure.
    """
    project_dir = get_project_dir()
    created = []

    # 1. Project config (.autoresearch.json)
    config_file = project_dir / ".autoresearch.json"
    if not config_file.exists():
        config_file.write_text(json.dumps(_DEFAULT_PROJECT_CONFIG, indent=2, ensure_ascii=False), encoding="utf-8")
        created.append(str(config_file))

    # 2. Prompt templates (config/ directory)
    config_dir = AUTORESEARCH_HOME / "config"
    prompt_templates = {
        "default_prompt.md": _DEFAULT_PROMPT,
        "prompt_execution.md": _DEFAULT_PROMPT,  # same base template
        "prompt_quality.md": _DEFAULT_PROMPT,
    }
    for fname, default_content in prompt_templates.items():
        fpath = config_dir / fname
        if not fpath.exists():
            fpath.write_text(default_content, encoding="utf-8")
            created.append(str(fpath))

    # 3. Experiment context files
    exp_dir = get_exp_dir()  # auto-creates dir
    for fname in ("accumulation_context.md", "changes_log.md"):
        fpath = exp_dir / fname
        if not fpath.exists():
            fpath.write_text("", encoding="utf-8")
            created.append(str(fpath))

    # 4. Claude memory files
    memory_dir = project_dir / ".claude" / "memory"
    if not memory_dir.exists():
        memory_dir.mkdir(parents=True, exist_ok=True)

    memory_files = {
        "lessons.md": "Lessons Learned",
        "patterns.md": "Patterns & Solutions",
        "architecture.md": "Architecture Decisions",
    }
    for fname, title in memory_files.items():
        fpath = memory_dir / fname
        if not fpath.exists():
            content = _MEMORY_HEADER.format(title=title, project=str(project_dir))
            fpath.write_text(content, encoding="utf-8")
            created.append(str(fpath))

    if created and verbose:
        print(f"  [init] Created {len(created)} missing file(s):")
        for f in created:
            print(f"    + {f}")

    return created


def _invalidate_cache():
    """Clear parse cache (called after file modifications)."""
    _cache["data"] = None
    _cache["mtime"] = 0.0


def parse_experiments() -> List[Dict[str, Any]]:
    """Parse all experiments from accumulation_context.md with UI fields.

    Results are cached by file modification time — repeated calls return
    the cached list without re-reading the file, reducing I/O from ~6 reads
    per page load to 1.

    When cache misses, the file is read ONCE and content is passed to both
    parse_accumulation_context() and section enrichment (avoids double I/O).
    """
    global _cache

    _ensure_context_files()

    ctx_file = get_exp_dir() / "accumulation_context.md"

    try:
        current_mtime = ctx_file.stat().st_mtime
    except OSError:
        current_mtime = 0

    if _cache["data"] is not None and _cache["mtime"] == current_mtime:
        return _cache["data"]

    # Read file ONCE — pass content to parse_accumulation_context() and reuse for sections
    content = ctx_file.read_text(encoding="utf-8")
    base_entries = parse_accumulation_context(ctx_file, content=content)
    if not base_entries:
        return []

    # Re-split to get raw sections for enrichment (reuses already-read content)
    sections = re.split(r"(?=^## Experiment \d+)", content, flags=re.MULTILINE)

    section_map = {}
    for section in sections:
        m = re.match(r"## Experiment (\d+)", section)
        if m:
            section_map[int(m.group(1))] = section

    exp_dir = get_exp_dir()
    result = [_enrich_experiment(e, section_map.get(e["number"], ""), exp_dir)
              for e in base_entries]

    _cache["data"] = result
    _cache["mtime"] = current_mtime
    return result


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/api/stats")
async def get_stats():
    experiments = parse_experiments()
    # Filter out any entries that ended up null (missing files, parse errors)
    experiments = [e for e in experiments if e and isinstance(e, dict)]
    total = len(experiments)
    keep = sum(1 for e in experiments if e.get("decision") == "KEEP")
    discard = sum(1 for e in experiments if e.get("decision") == "DISCARD")

    scores = []
    for e in experiments:
        try:
            s = float(e.get("score", 0.5))
            if s != 0.5:
                scores.append(s)
        except (ValueError, TypeError):
            pass
    avg_score = round(sum(scores) / len(scores), 2) if scores else 0

    type_dist: Dict[str, int] = {}
    for e in experiments:
        t = e.get("type", "Unknown")
        if t:
            type_dist[t] = type_dist.get(t, 0) + 1

    score_trend = []
    for e in experiments[-20:]:
        try:
            score_trend.append(
                {"number": e["number"], "score": float(e.get("score", 0.5)), "decision": e.get("decision", "N/A")}
            )
        except (ValueError, TypeError, KeyError):
            pass

    # Never return null for last_experiment — use empty dict so frontend handles gracefully
    last = experiments[-1] if experiments else None
    if not last:
        last = {"number": 0, "title": "No experiments yet", "date": "", "type": "", "score": "0.5", "decision": "N/A", "what_done": "", "files_modified": [], "results": "", "notes": ""}
    else:
        for k, v in _EXP_DEFAULTS.items():
            if last.get(k) is None:
                last[k] = v

    return {
        "total_experiments": total,
        "keep_count": keep,
        "discard_count": discard,
        "avg_score": avg_score,
        "type_distribution": type_dist,
        "score_trend": score_trend,
        "last_experiment": last,
        "run_status": {
            "running": run_state["running"],
            "current_exp": run_state["current_exp"],
            "total_exps": run_state["total_exps"],
            "started_at": run_state["started_at"],
        },
    }


@app.get("/api/experiments")
async def get_experiments():
    experiments = parse_experiments()
    # Filter out any entries that ended up null/empty (missing files, parse errors)
    return [e for e in experiments if e and isinstance(e, dict) and e.get("number") is not None]


@app.get("/api/experiments/{n}")
async def get_experiment(n: int):
    exp_dir = get_exp_dir()
    prompt_file = exp_dir / f"prompt_{n}.md"
    output_file = exp_dir / f"output_{n}.md"

    # Use cached experiments (avoids re-reading the file)
    experiments = parse_experiments()
    exp = next((e for e in experiments if e["number"] == n), None)

    if not exp and not prompt_file.exists() and not output_file.exists():
        raise HTTPException(status_code=404, detail=f"Experiment {n} not found")

    base = exp or {
        "number": n, "title": f"Experiment {n}", "date": "", "type": "Unknown",
        "score": "N/A", "decision": "N/A", "what_done": "", "files_modified": [],
        "results": "", "notes": "",
    }

    def _safe_read(path: Path) -> str:
        try:
            return path.read_text(encoding="utf-8") if path.exists() else ""
        except (UnicodeDecodeError, OSError):
            return f"[Error reading {path.name}]"

    return {
        **base,
        "prompt": _safe_read(prompt_file),
        "output": _safe_read(output_file),
    }


@app.get("/api/judge/{n}")
async def judge_experiment(n: int, profile: str = "balanced"):
    """Run post-experiment judge on experiment N with optional profile."""
    import json as _json
    from utils.judge import ExperimentJudge
    project = get_project_dir()
    try:
        experiments = parse_experiments()
        exp = next((e for e in experiments if e["number"] == n), None)
        if not exp:
            raise HTTPException(status_code=404, detail=f"Experiment {n} not found")
        judge = ExperimentJudge(project)
        verdict = judge.evaluate(
            claimed_files=exp.get("files_modified", []),
            agent_decision=exp.get("decision", ""),
            report_text=exp.get("results", ""),
            profile=profile,
        )
        # Persist verdict to JSON file
        judge_file = get_exp_dir() / f"judge_{n}.json"
        judge_file.write_text(_json.dumps(verdict, indent=2), encoding="utf-8")
        _invalidate_cache()
        return verdict
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/judge/{n}/all")
async def judge_experiment_all(n: int):
    """Run all judge profiles on experiment N."""
    import json as _json
    from utils.judge import ExperimentJudge
    project = get_project_dir()
    try:
        experiments = parse_experiments()
        exp = next((e for e in experiments if e["number"] == n), None)
        if not exp:
            raise HTTPException(status_code=404, detail=f"Experiment {n} not found")
        judge = ExperimentJudge(project)
        verdicts = judge.evaluate_all(
            claimed_files=exp.get("files_modified", []),
            agent_decision=exp.get("decision", ""),
            report_text=exp.get("results", ""),
        )
        # Persist all-profiles verdict
        judge_file = get_exp_dir() / f"judge_{n}_all.json"
        judge_file.write_text(_json.dumps(verdicts, indent=2), encoding="utf-8")
        _invalidate_cache()
        return verdicts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/judge/history")
async def judge_history():
    """Get aggregated judge analytics across all experiments."""
    from utils.judge import JudgeHistory
    project = get_project_dir()
    try:
        history = JudgeHistory(project)
        analytics = history.get_analytics()
        return analytics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/judge/weights")
async def judge_weights():
    """Get current judge weights (defaults + custom overrides)."""
    from utils.judge import JUDGE_PROFILES, JudgeHistory
    project = get_project_dir()
    try:
        history = JudgeHistory(project)
        custom = history.load_custom_weights()
        result = {}
        for pname, prof in JUDGE_PROFILES.items():
            result[pname] = {
                "weights": dict(prof.weights),
                "custom_overrides": custom.get(pname, {}) if custom else {},
            }
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/judge/weights/adjust")
async def judge_weights_adjust():
    """Force-trigger judge weight auto-adjustment from history."""
    from utils.judge import JudgeHistory
    project = get_project_dir()
    try:
        history = JudgeHistory(project)
        result = history.auto_adjust(min_verdicts=3)
        return result or {"applied": False, "reason": "No verdicts to analyze"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/judge/weights/reset")
async def judge_weights_reset():
    """Reset judge weights to defaults."""
    from utils.judge import JudgeHistory, JUDGE_PROFILES, _DEFAULT_WEIGHTS
    project = get_project_dir()
    try:
        history = JudgeHistory(project)
        deleted = history.reset_weights()
        # Restore defaults in-memory
        for pname, defaults in _DEFAULT_WEIGHTS.items():
            prof = JUDGE_PROFILES.get(pname)
            if prof:
                prof.weights = dict(defaults)
        return {"reset": deleted, "message": "Weights reset to defaults" if deleted else "No custom weights to reset"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/changes-log")
async def get_changes_log():
    log_file = get_exp_dir() / "changes_log.md"
    if not log_file.exists():
        return {"content": "# No changes log yet\n\nStart experiments to see changes here."}
    try:
        return {"content": log_file.read_text(encoding="utf-8")}
    except (UnicodeDecodeError, OSError):
        return {"content": "# Error reading changes log"}


@app.get("/api/git/diff")
async def get_git_diff():
    """Return git diff for the working tree (staged + unstaged changes)."""
    project = get_project_dir()
    try:
        result = subprocess.run(
            ["git", "diff", "--stat", "--patch"],
            capture_output=True, text=True, timeout=10,
            cwd=str(project), encoding="utf-8", errors="replace",
        )
        staged = subprocess.run(
            ["git", "diff", "--cached", "--stat", "--patch"],
            capture_output=True, text=True, timeout=10,
            cwd=str(project), encoding="utf-8", errors="replace",
        )
        # Parse file list from --stat
        files = []
        for src in [(result, "unstaged"), (staged, "staged")]:
            output = src[0].stdout or ""
            for line in output.splitlines():
                m = re.match(r"^ (.+?)\s*\|\s*\d+", line)
                if m:
                    fname = m.group(1).strip()
                    if not any(f["path"] == fname for f in files):
                        files.append({"path": fname, "status": src[1]})

        stat_lines = []
        for line in ((result.stdout or "") + "\n" + (staged.stdout or "")).splitlines():
            if re.match(r"^ .+?\s*\|\s*\d+", line):
                stat_lines.append(line)

        return {
            "files": files,
            "stat": "\n".join(stat_lines),
            "diff": result.stdout or "",
            "staged_diff": staged.stdout or "",
        }
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {"files": [], "stat": "", "diff": "", "staged_diff": ""}


@app.get("/api/git/diff/{filepath:path}")
async def get_git_diff_file(filepath: str):
    """Return git diff for a specific file."""
    project = get_project_dir()
    # Prevent path traversal
    safe_path = (project / filepath).resolve()
    if not _is_subpath(safe_path, project.resolve()):
        raise HTTPException(status_code=403, detail="Path traversal blocked")
    try:
        result = subprocess.run(
            ["git", "diff", "--", filepath],
            capture_output=True, text=True, timeout=10,
            cwd=str(project), encoding="utf-8", errors="replace",
        )
        staged = subprocess.run(
            ["git", "diff", "--cached", "--", filepath],
            capture_output=True, text=True, timeout=10,
            cwd=str(project), encoding="utf-8", errors="replace",
        )
        # File extension for syntax highlighting hint
        ext = Path(filepath).suffix.lstrip(".") or ""
        return {
            "path": filepath,
            "ext": ext,
            "diff": result.stdout or "",
            "staged_diff": staged.stdout or "",
            "has_changes": bool((result.stdout or "").strip() or (staged.stdout or "").strip()),
        }
    except (subprocess.TimeoutExpired, FileNotFoundError):
        raise HTTPException(status_code=500, detail="git diff failed")


@app.get("/api/prompt")
async def get_prompt():
    prompt_file = AUTORESEARCH_HOME / "config" / "default_prompt.md"
    if not prompt_file.exists():
        return {"content": "# Prompt template not found"}
    try:
        return {"content": prompt_file.read_text(encoding="utf-8")}
    except (UnicodeDecodeError, OSError):
        return {"content": "# Error reading prompt template"}


class PromptUpdate(BaseModel):
    content: str = Field(..., max_length=500_000)


@app.put("/api/prompt")
async def update_prompt(data: PromptUpdate):
    prompt_file = AUTORESEARCH_HOME / "config" / "default_prompt.md"
    prompt_file.parent.mkdir(parents=True, exist_ok=True)
    prompt_file.write_text(data.content, encoding="utf-8")
    return {"status": "ok"}


@app.get("/api/config")
async def get_config(project: str = ""):
    if project:
        target = _validate_project_path(project)
        config_file = target / ".autoresearch.json"
    else:
        config_file = get_project_dir() / ".autoresearch.json"
    if not config_file.exists():
        return {"name": "", "description": "", "goals": [], "completed_goals": [],
                "constraints": [], "tech_stack": []}
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "completed_goals" not in data:
            data["completed_goals"] = []
        return data
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {"name": "", "description": "", "goals": [], "completed_goals": [],
                "constraints": [], "tech_stack": [], "_error": "Malformed config file"}


class ConfigUpdate(BaseModel):
    model_config = {"extra": "ignore"}

    name: str = ""
    description: str = ""
    goals: List[str] = []
    completed_goals: List[str] = []
    constraints: List[str] = []
    tech_stack: List[str] = []


@app.put("/api/config")
async def update_config(data: ConfigUpdate):
    config_file = get_project_dir() / ".autoresearch.json"
    existing = {}
    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass  # Start fresh if existing config is corrupted
    existing.update({
        "name": data.name, "description": data.description,
        "goals": data.goals, "completed_goals": data.completed_goals,
        "constraints": data.constraints, "tech_stack": data.tech_stack,
    })
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    return {"status": "ok"}


class SetupRequest(BaseModel):
    model_config = {"extra": "ignore"}

    project: str = "."
    name: str = ""
    description: str = ""
    goals: List[str] = []
    constraints: List[str] = []
    tech_stack: List[str] = []


@app.post("/api/setup")
async def setup_project(data: SetupRequest):
    """Create or update .autoresearch.json for a given project path."""
    project_dir = _validate_project_path(data.project)
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Directory not found: {data.project}")
    if not project_dir.is_dir():
        raise HTTPException(status_code=400, detail="Not a directory")

    config_file = project_dir / ".autoresearch.json"

    # Load existing config to preserve completed_goals and other fields
    existing = {}
    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass  # Start fresh

    existing.update({
        "name": data.name,
        "description": data.description,
        "goals": data.goals,
        "constraints": data.constraints,
        "tech_stack": data.tech_stack,
    })
    if "completed_goals" not in existing:
        existing["completed_goals"] = []

    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)

    # Also create .autoresearch/experiments dir
    exp_dir = project_dir / ".autoresearch" / "experiments"
    exp_dir.mkdir(parents=True, exist_ok=True)

    return {"status": "ok", "config": existing, "path": str(project_dir)}


class RunRequest(BaseModel):
    model_config = {"extra": "ignore"}

    iterations: int = Field(default=10, ge=1, le=100000)
    timeout: int = Field(default=5, ge=0, le=1440)
    max_time: int = Field(default=600, ge=30, le=86400)
    project: str = "."
    strategy: str = Field(default="default", pattern=r"^(default|execution|quality)$")
    token_threshold: int = Field(default=100_000, ge=20_000, le=200_000)
    parallel_judges: bool = Field(default=False)
    decompose: bool = Field(default=False)


# ---------------------------------------------------------------------------
# SDK-based Research Runner (replaces subprocess autoresearch.py)
# ---------------------------------------------------------------------------

try:
    from agents.research import ResearchRunner
    from agents.parallel import ParallelAgentRunner, AgentTask
    _sdk_available = True
except ImportError:
    _sdk_available = False

# Active runner instance (replaces run_state["process"])
_active_runner: Optional["ResearchRunner"] = None
_run_task: Optional[asyncio.Task] = None
# Active parallel runner
_active_parallel: Optional["ParallelAgentRunner"] = None
_parallel_task: Optional[asyncio.Task] = None
_parallel_results: List[Dict[str, Any]] = []
# WebSocket subscribers for real-time research events
_research_ws_clients: list = []
# Keep last tokens snapshot so the bar persists after run ends
_last_tokens_snapshot: Optional[dict] = None


def _get_autoresearch_helpers():
    """Lazy-import prompt builder and post-experiment helpers from autoresearch.py."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "autoresearch_mod", str(AUTORESEARCH_HOME / "autoresearch.py"),
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


async def _research_event_handler(event: dict) -> None:
    """Forward ResearchRunner events to logs + WebSocket subscribers."""
    etype = event.get("type", "")

    # Append human-readable line to polling logs
    if etype == "experiment_start":
        n, t = event.get("number", 0), event.get("total", 0)
        continued = event.get("session_continued", False)
        tokens_info = event.get("tokens", {})
        session_note = " (continued session)" if continued else " (fresh session)"
        _log_append(f"[EXP] Эксперимент {n}/{t}{session_note} | input_tokens: {tokens_info.get('input_tokens', 0):,}")
        run_state["current_exp"] = n
    elif etype == "experiment_end":
        n = event.get("number", 0)
        status = event.get("status", "?")
        cost = event.get("cost")
        cost_str = f" | cost: ${cost:.4f}" if cost else ""
        usage = event.get("usage") or {}
        _log_append(f"[EXP] Эксперимент {n} завершён: {status}{cost_str} | tokens: {usage.get('input_tokens', 0):,}in/{usage.get('output_tokens', 0):,}out")
    elif etype == "session_reset":
        reason = event.get("reason", "")
        inp = event.get("input_tokens", 0)
        _log_append(f"[SESSION] Reset ({reason}): input_tokens={inp:,} exceeded threshold — starting fresh session")
    elif etype == "tokens_update":
        pass  # Don't spam logs, available via /api/run/status
    elif etype == "agent_event":
        msg_type = event.get("message_type", "")
        data = event.get("data", {})
        if msg_type == "AssistantMessage":
            for block in data.get("content", []):
                if isinstance(block, dict):
                    if block.get("text"):
                        text = block["text"][:200]
                        _log_append(f"[AGENT] {text}")
                    elif block.get("name"):
                        _log_append(f"[TOOL] {block['name']}")
    elif etype == "log":
        _log_append(f"[INFO] {event.get('message', '')}")
    elif etype == "error":
        _log_append(f"[ERROR] {event.get('message', '')}")
    elif etype == "judge_verdict":
        n = event.get("number", 0)
        consensus = event.get("consensus", "?")
        score = event.get("consensus_score", 0)
        profiles = event.get("profiles", {})
        detail_parts = []
        for pname, pverdict in profiles.items():
            detail_parts.append(f"{pname.upper()}={pverdict.get('recommendation', '?')}")
        details = " | ".join(detail_parts)
        _log_append(f"[JUDGE] Эксперимент {n}: {consensus} (score={score}) — {details}")
    elif etype == "run_end":
        ok = event.get("successful", 0)
        total = event.get("total_run", 0)
        cost = event.get("total_cost_usd", 0)
        _log_append(f"[DONE] Завершено: {ok}/{total} успешно | Total cost: ${cost:.4f}")
    elif etype == "parallel_agent_start":
        label = event.get("agent_label", "?")
        _log_append(f"[SUB] Agent '{label}' started")
    elif etype == "parallel_agent_end":
        label = event.get("agent_label", "?")
        status = event.get("status", "?")
        cost = event.get("cost")
        summary = event.get("output_summary", "")
        msg = f"[SUB] Agent '{label}': {status}"
        if cost is not None:
            msg += f" | ${cost:.4f}"
        if summary:
            brief = summary.replace("\n", " ").strip()[:300]
            msg += f"\n  → {brief}"
        _log_append(msg)
    elif etype == "parallel_end":
        ok = event.get("completed", 0)
        tot = event.get("total_tasks", 0)
        cost = event.get("total_cost_usd")
        msg = f"[SUB] Parallel run: {ok}/{tot} completed"
        if cost is not None:
            msg += f" | ${cost:.4f}"
        _log_append(msg)

    # Broadcast to WebSocket subscribers
    dead: list[int] = []
    for i, ws in enumerate(_research_ws_clients):
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(i)
    for i in reversed(dead):
        _research_ws_clients.pop(i)


@app.post("/api/run")
async def start_run(data: RunRequest):
    global _active_runner, _run_task

    if not _sdk_available:
        raise HTTPException(status_code=503, detail="claude-code-sdk not available. Install: pip install claude-code-sdk")

    if _active_runner and _active_runner.is_running:
        raise HTTPException(status_code=409, detail="Already running")

    project_dir = _validate_project_path(data.project)
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Project not found: {data.project}")

    # Import helpers from autoresearch.py
    ar = _get_autoresearch_helpers()

    # Load project config
    config = ar.ProjectConfig(project_dir)
    if not config.is_configured():
        raise HTTPException(status_code=400, detail="Project not configured. Run autoresearch.py --configure first.")

    # Determine start_from
    exp_dir = project_dir / ".autoresearch" / "experiments"
    exp_dir.mkdir(parents=True, exist_ok=True)
    start_from = ar.get_next_experiment_number(exp_dir)

    # Create runner
    runner = ResearchRunner(
        project_dir=project_dir,
        strategy=data.strategy,
        max_turns=100,
        token_threshold=data.token_threshold,
        token_soft_threshold=int(data.token_threshold * 0.8),
        parallel_judges=data.parallel_judges,
        decompose=data.decompose,
    )
    runner.add_listener(_research_event_handler)
    _active_runner = runner

    # Reset polling state
    run_state.update({
        "running": True, "process": None,
        "current_exp": 0, "total_exps": data.iterations,
        "project": str(project_dir),
        "started_at": datetime.now().isoformat(),
        "logs": [], "error": None,
    })

    # Initial info logs
    prompt_name = {
        "default": "default_prompt.md",
        "execution": "prompt_execution.md",
        "quality": "prompt_quality.md",
    }.get(data.strategy, "default_prompt.md")
    prompt_file = AUTORESEARCH_HOME / "config" / prompt_name
    prompt_size = len(prompt_file.read_text(encoding="utf-8")) if prompt_file.exists() else 0
    ctx_file = get_exp_dir() / "accumulation_context.md"
    ctx_size = len(ctx_file.read_text(encoding="utf-8")) if ctx_file.exists() else 0

    for init_line in [
        f"[INIT] Starting ResearchRunner (SDK mode)",
        f"[INIT] Project: {project_dir}",
        f"[INIT] Iterations: {data.iterations} | Timeout: {data.timeout}min | Max time: {data.max_time}s | Strategy: {data.strategy}",
        f"[INIT] Token threshold: {data.token_threshold:,} (soft: {int(data.token_threshold * 0.8):,})",
        f"[INIT] Start from: Experiment {start_from}",
        f"[INIT] Prompt template size: {prompt_size:,} bytes ({prompt_size/1024:.1f} KB)",
        f"[INIT] Context size: {ctx_size:,} bytes ({ctx_size/1024:.1f} KB)",
    ]:
        _log_append(init_line)

    # Build prompt function that also handles post-experiment saving
    def build_and_save_prompt(iteration: int, total: int) -> str:
        prompt = ar.build_agent_prompt(config, iteration, total, data.strategy)
        # Save prompt to file
        pf = exp_dir / f"prompt_{iteration}.md"
        pf.write_text(prompt, encoding="utf-8")
        return prompt

    def _save_experiment_artifacts(exp_num: int, result: dict) -> None:
        """Save output file and accumulation context for one experiment."""
        output = result.get("output", "")
        if output:
            out_file = exp_dir / f"output_{exp_num}.md"
            out_file.write_text(output, encoding="utf-8")

        if result.get("status") in ("success", "incomplete") and output:
            try:
                exp_data = ar.parse_experiment_report(output, exp_num)

                # Run post-experiment judge (balanced profile + all profiles)
                try:
                    from utils.judge import ExperimentJudge
                    import json as _json
                    judge = ExperimentJudge(project_dir)
                    verdict = judge.evaluate(
                        claimed_files=exp_data.get("files_modified", []),
                        agent_decision=exp_data.get("agent_decision", ""),
                        report_text=output,
                    )
                    exp_data["judge_verdict"] = verdict
                    judge_file = exp_dir / f"judge_{exp_num}.json"
                    judge_file.write_text(_json.dumps(verdict, indent=2), encoding="utf-8")
                    _log_append(
                        f"[JUDGE] Exp #{exp_num}: score={verdict['score']}, "
                        f"rec={verdict['recommendation']}, {verdict['summary']}"
                    )
                    # Also run all profiles for consensus
                    try:
                        all_verdicts = judge.evaluate_all(
                            claimed_files=exp_data.get("files_modified", []),
                            agent_decision=exp_data.get("agent_decision", ""),
                            report_text=output,
                        )
                        exp_data["judge_all_verdicts"] = all_verdicts
                        all_file = exp_dir / f"judge_{exp_num}_all.json"
                        all_file.write_text(_json.dumps(all_verdicts, indent=2), encoding="utf-8")
                        _log_append(
                            f"[JUDGE-ALL] Exp #{exp_num}: consensus={all_verdicts['consensus']}, "
                            f"avg={all_verdicts['consensus_score']}"
                        )
                    except Exception as ae:
                        logger.warning("All-judges failed for exp %d: %s", exp_num, ae)
                except Exception as je:
                    logger.warning("Judge failed for exp %d: %s", exp_num, je)

                ar.save_last_experiment_summary(project_dir, exp_data)
                ar.save_accumulation_context(project_dir, exp_data)
                ar.save_changes_log(project_dir, exp_data)
                _invalidate_cache()
            except Exception as e:
                _log_append(f"[ERROR] Failed to save experiment {exp_num} artifacts: {e}")

    # Track experiment count for incremental saving
    _last_saved_count = 0

    async def _save_on_experiment_end(event: dict) -> None:
        nonlocal _last_saved_count
        if event.get("type") != "experiment_end":
            return
        # Save artifacts for newly completed experiments
        while _last_saved_count < len(runner.results):
            idx = _last_saved_count
            exp_num = start_from + idx
            _save_experiment_artifacts(exp_num, runner.results[idx])
            _last_saved_count += 1

    runner.add_listener(_save_on_experiment_end)

    async def _run_and_save():
        """Run the research loop (saving happens via listener)."""
        try:
            await runner.run_loop(
                iterations=data.iterations,
                start_from=start_from,
                timeout_min=data.timeout,
                max_time=data.max_time,
                build_prompt_fn=build_and_save_prompt,
            )
        except Exception as e:
            run_state["error"] = str(e)
            _log_append(f"[ERROR] Research loop failed: {e}")
        finally:
            run_state["running"] = False
            _invalidate_cache()

    _run_task = asyncio.create_task(_run_and_save())
    return {"status": "started", "iterations": data.iterations, "start_from": start_from}


@app.get("/api/run/status")
async def get_run_status():
    global _last_tokens_snapshot
    if _active_runner:
        _last_tokens_snapshot = _active_runner.tokens.to_dict()
    tokens = _active_runner.tokens.to_dict() if _active_runner else _last_tokens_snapshot
    return {
        "running": run_state["running"],
        "current_exp": run_state["current_exp"],
        "total_exps": run_state["total_exps"],
        "project": run_state["project"],
        "started_at": run_state["started_at"],
        "error": run_state["error"],
        "recent_logs": _log_read(200),
        "session_id": _active_runner._session_id if _active_runner else None,
        "tokens": tokens,
    }


@app.post("/api/run/stop")
async def stop_run():
    global _active_runner, _run_task

    if not _active_runner or not _active_runner.is_running:
        raise HTTPException(status_code=409, detail="Not running")

    _active_runner.cancel()
    _log_append("[STOP] Cancellation requested.")

    # Give the runner a moment to clean up
    if _run_task and not _run_task.done():
        try:
            await asyncio.wait_for(asyncio.shield(_run_task), timeout=5)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            _run_task.cancel()

    run_state["running"] = False
    _log_append("[STOP] Runner stopped.")
    return {"status": "stopped"}


# ---------------------------------------------------------------------------
# Parallel Agent API
# ---------------------------------------------------------------------------



@app.get("/api/run/judge-mode")
async def get_judge_mode():
    """Get current parallel judges setting."""
    if _active_runner:
        return {"parallel_judges": _active_runner.parallel_judges}
    return {"parallel_judges": False}


@app.post("/api/run/judge-mode")
async def set_judge_mode(data: dict):
    """Toggle parallel judges mode for the next run."""
    enabled = data.get("parallel_judges", False)
    if _active_runner and _active_runner.is_running:
        raise HTTPException(status_code=409, detail="Cannot change judge mode while running")
    if _active_runner:
        _active_runner.parallel_judges = bool(enabled)
    _log_append(f"[CONFIG] Parallel judges: {'ON' if enabled else 'OFF'}")
    return {"parallel_judges": bool(enabled)}


@app.post("/api/judge/revert/{n}")
async def judge_revert_experiment(n: int):
    """Manually revert experiment N commit based on judge verdict.

    Creates a git revert commit for the experiment's commit.
    Non-destructive — does not reset history.
    """
    project = get_project_dir()
    exp_dir = project / ".autoresearch" / "experiments"

    # Verify the experiment commit exists
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "-20"],
            capture_output=True, text=True, timeout=10,
            cwd=str(project), encoding="utf-8", errors="replace",
        )
        commits = (result.stdout or "").strip().splitlines()
        exp_prefix = f"exp #{n}:"
        exp_commit = None
        for line in commits:
            if exp_prefix in line:
                exp_commit = line.split()[0]
                break

        if not exp_commit:
            raise HTTPException(
                status_code=404,
                detail=f"Experiment #{n} commit not found in recent history",
            )

        # Perform revert
        result = subprocess.run(
            ["git", "revert", "--no-edit", exp_commit],
            capture_output=True, text=True, timeout=30,
            cwd=str(project), encoding="utf-8", errors="replace",
        )

        if result.returncode != 0:
            err = (result.stderr or "unknown error").strip()[:300]
            raise HTTPException(status_code=500, detail=f"Revert failed: {err}")

        # Record the revert in judge verdict file
        judge_file = exp_dir / f"judge_{n}_all.json"
        if judge_file.exists():
            try:
                verdict_data = _json.loads(judge_file.read_text(encoding="utf-8"))
                verdict_data["manually_reverted"] = True
                verdict_data["reverted_at"] = datetime.now().isoformat()
                judge_file.write_text(
                    _json.dumps(verdict_data, indent=2), encoding="utf-8",
                )
            except Exception:
                pass

        _log_append(f"[JUDGE] Manual revert of exp #{n} ({exp_commit})")

        return {
            "experiment": n,
            "commit": exp_commit,
            "status": "reverted",
            "message": f"Experiment #{n} reverted successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/parallel/run")
async def start_parallel_run(data: dict):
    """Run multiple agents in parallel.

    Body:
        tasks: [
            {"label": "...", "prompt": "...", "cwd": "...", "model": "...", "max_turns": 10}
        ]
        concurrency: int (default 3)
    """
    global _active_parallel, _parallel_task, _parallel_results

    if not _sdk_available:
        raise HTTPException(status_code=503, detail="claude-code-sdk not available")

    if _active_parallel and _active_parallel.is_running:
        raise HTTPException(status_code=409, detail="Parallel run already in progress")

    tasks_data = data.get("tasks", [])
    if not tasks_data:
        raise HTTPException(status_code=400, detail="No tasks provided")

    # Validate tasks
    agent_tasks = []
    for td in tasks_data:
        if not td.get("prompt") or not td.get("cwd"):
            raise HTTPException(status_code=400, detail="Each task needs 'prompt' and 'cwd'")
        cwd = Path(td["cwd"]).resolve()
        if not cwd.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {td['cwd']}")
        agent_tasks.append(AgentTask(
            label=td.get("label", f"agent-{len(agent_tasks)}"),
            prompt=td["prompt"],
            cwd=str(cwd),
            model=td.get("model"),
            max_turns=td.get("max_turns", 10),
            permission_mode=td.get("permission_mode", "bypassPermissions"),
            append_system_prompt=td.get("append_system_prompt"),
        ))

    concurrency = min(data.get("concurrency", 3), len(agent_tasks))

    runner = ParallelAgentRunner(max_concurrency=concurrency)
    runner.add_listener(_parallel_event_handler)
    _active_parallel = runner
    _parallel_results = []

    _log_append(f"[PARALLEL] Starting {len(agent_tasks)} agents (concurrency={concurrency})")
    for t in agent_tasks:
        _log_append(f"[PARALLEL]   Agent '{t.label}': cwd={t.cwd}, model={t.model or 'default'}")

    async def _run_wrapper():
        global _parallel_results
        try:
            results = await runner.run(agent_tasks, concurrency=concurrency)
            _parallel_results = [t.to_dict() for t in results]
            completed = sum(1 for r in results if r.status == "completed")
            errors = sum(1 for r in results if r.status == "error")
            _log_append(f"[PARALLEL] Done: {completed} completed, {errors} errors")
        except Exception as e:
            _log_append(f"[PARALLEL] Fatal error: {e}")

    _parallel_task = asyncio.create_task(_run_wrapper())
    return {
        "status": "started",
        "run_id": runner._run_id,
        "total_tasks": len(agent_tasks),
        "concurrency": concurrency,
    }


def _parallel_event_handler(event: dict) -> None:
    """Forward parallel runner events to WebSocket subscribers and logs."""
    # Log key events
    etype = event.get("type", "")
    if etype == "parallel_agent_start":
        _log_append(f"[PARALLEL] Agent '{event.get('agent_label')}' started")
    elif etype == "parallel_agent_end":
        label = event.get("agent_label", "?")
        status = event.get("status", "?")
        cost = event.get("cost")
        summary = event.get("output_summary", "")
        msg = f"[PARALLEL] Agent '{label}' {status}"
        if cost is not None:
            msg += f" | ${cost:.4f}"
        if summary:
            brief = summary.replace("\n", " ").strip()[:300]
            msg += f"\n  → {brief}"
        _log_append(msg)
    elif etype == "parallel_end":
        _log_append(f"[PARALLEL] Run {event.get('run_id')} complete: "
                     f"{event.get('completed')}/{event.get('total_tasks')} completed, "
                     f"cost=${event.get('total_cost_usd', 0)}")
    elif etype == "parallel_error":
        _log_append(f"[PARALLEL] Error: {event.get('message')}")

    # Forward to WebSocket subscribers
    for client in list(_research_ws_clients):
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(_ws_send(client, event))
        except Exception:
            pass


@app.get("/api/parallel/status")
async def get_parallel_status():
    if not _active_parallel:
        return {"running": False, "results": _parallel_results}
    return {
        **_active_parallel.get_status(),
        "results": _parallel_results,
    }


@app.post("/api/parallel/stop")
async def stop_parallel_run():
    global _active_parallel, _parallel_task

    if not _active_parallel or not _active_parallel.is_running:
        raise HTTPException(status_code=409, detail="Not running")

    _active_parallel.cancel()
    _log_append("[PARALLEL] Stop requested")

    if _parallel_task and not _parallel_task.done():
        try:
            await asyncio.wait_for(asyncio.shield(_parallel_task), timeout=5)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            _parallel_task.cancel()

    return {"status": "stopped"}


@app.post("/api/parallel/decompose")
async def decompose_task(data: dict):
    """Decompose a goal into parallel sub-tasks.

    Body:
        goal: str — the research goal to decompose
        project_dir: str — project path (optional, uses current)
        max_subtasks: int — max sub-tasks (default 3)
        context: str — additional context (optional)

    Returns:
        List of sub-task descriptors with labels and prompts.
    """
    global _active_parallel

    if not _sdk_available:
        raise HTTPException(status_code=503, detail="claude-code-sdk not available")

    goal = data.get("goal", "")
    if not goal:
        raise HTTPException(status_code=400, detail="Goal is required")

    project_dir = Path(data.get("project_dir", str(get_project_dir()))).resolve()
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {project_dir}")

    max_subtasks = min(data.get("max_subtasks", 3), 5)
    context = data.get("context")

    try:
        from agents.parallel import TaskDecomposer

        decomposer = TaskDecomposer(project_dir, max_subtasks=max_subtasks)
        sub_tasks = await decomposer.decompose(
            goal=goal,
            max_subtasks=max_subtasks,
            context=context,
        )

        _log_append(f"[DECOMPOSE] Goal decomposed into {len(sub_tasks)} sub-tasks")
        for t in sub_tasks:
            _log_append(f"[DECOMPOSE]   '{t.label}': {len(t.prompt)} chars prompt")

        return {
            "status": "ok",
            "subtasks": [
                {
                    "label": t.label,
                    "agent_id": t.agent_id,
                    "prompt_length": len(t.prompt),
                    "cwd": t.cwd,
                    "max_turns": t.max_turns,
                }
                for t in sub_tasks
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/parallel/decompose-and-run")
async def decompose_and_run(data: dict):
    """Decompose a goal and immediately run sub-tasks in parallel.

    Body:
        goal: str — the research goal
        project_dir: str — project path (optional)
        max_subtasks: int — max sub-tasks (default 3)
        concurrency: int — max parallel agents (default 3)
    """
    global _active_parallel, _parallel_task, _parallel_results

    if not _sdk_available:
        raise HTTPException(status_code=503, detail="claude-code-sdk not available")

    if _active_parallel and _active_parallel.is_running:
        raise HTTPException(status_code=409, detail="Parallel run already in progress")

    goal = data.get("goal", "")
    if not goal:
        raise HTTPException(status_code=400, detail="Goal is required")

    project_dir = Path(data.get("project_dir", str(get_project_dir()))).resolve()
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {project_dir}")

    max_subtasks = min(data.get("max_subtasks", 3), 5)
    concurrency = min(data.get("concurrency", 3), max_subtasks)

    try:
        from agents.parallel import (
            ParallelAgentRunner,
            ResultAggregator,
            TaskDecomposer,
        )

        # Step 1: Decompose
        _log_append(f"[DECOMPOSE+RUN] Decomposing goal...")
        decomposer = TaskDecomposer(project_dir, max_subtasks=max_subtasks)
        sub_tasks = await decomposer.decompose(goal=goal, max_subtasks=max_subtasks)

        if not sub_tasks:
            raise HTTPException(
                status_code=422,
                detail="Could not decompose goal into sub-tasks",
            )

        _log_append(
            f"[DECOMPOSE+RUN] Decomposed into {len(sub_tasks)} sub-tasks: "
            + ", ".join(t.label for t in sub_tasks)
        )

        # Step 2: Run in parallel
        runner = ParallelAgentRunner(max_concurrency=concurrency)
        runner.add_listener(_parallel_event_handler)
        _active_parallel = runner
        _parallel_results = []

        async def _run_wrapper():
            global _parallel_results
            try:
                results = await runner.run(sub_tasks, concurrency=concurrency)
                _parallel_results = [t.to_dict() for t in results]

                # Step 3: Aggregate
                aggregator = ResultAggregator(project_dir)
                aggregated = aggregator.aggregate(sub_tasks, results)

                _log_append(
                    f"[DECOMPOSE+RUN] Complete: {aggregated.tasks_completed}/"
                    f"{aggregated.tasks_total} tasks, ${aggregated.total_cost_usd:.4f}"
                )
                if aggregated.has_conflicts:
                    _log_append(
                        f"[DECOMPOSE+RUN] CONFLICTS detected: "
                        + ", ".join(c["file"] for c in aggregated.conflicts)
                    )

            except Exception as e:
                _log_append(f"[DECOMPOSE+RUN] Fatal error: {e}")

        _parallel_task = asyncio.create_task(_run_wrapper())

        return {
            "status": "started",
            "run_id": runner._run_id,
            "subtasks": [
                {"label": t.label, "agent_id": t.agent_id}
                for t in sub_tasks
            ],
            "concurrency": concurrency,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/logs")
async def get_logs(limit: int = 50):
    log_file = get_project_dir() / ".autoresearch" / "logs" / "autoresearch.log"
    if not log_file.exists():
        return {"logs": []}
    try:
        content = log_file.read_text(encoding="utf-8")
        return {"logs": content.strip().split("\n")[-limit:]}
    except (OSError, UnicodeDecodeError):
        return {"logs": []}


# =============================================================================
# STATIC FILES
# =============================================================================

@app.get("/", response_class=HTMLResponse)
async def index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return HTMLResponse("<h1>index.html not found in ui/static/</h1>")

# Serve /modules/ directory for plug-in scripts (cat.js, matrix.js, etc.)
MODULES_DIR = STATIC_DIR / "modules"
if MODULES_DIR.exists():
    app.mount("/modules", StaticFiles(directory=str(MODULES_DIR), html=True), name="modules")

# Serve /css/ and /js/ directories
CSS_DIR = STATIC_DIR / "css"
JS_DIR = STATIC_DIR / "js"
if CSS_DIR.exists():
    app.mount("/css", StaticFiles(directory=str(CSS_DIR), html=True), name="css")
if JS_DIR.exists():
    app.mount("/js", StaticFiles(directory=str(JS_DIR), html=True), name="js")

# Serve /templates/ directory for HTML template loaders
TEMPLATES_DIR = STATIC_DIR / "templates"
if TEMPLATES_DIR.exists():
    app.mount("/templates", StaticFiles(directory=str(TEMPLATES_DIR), html=True), name="templates")


# =============================================================================
# SESSION MANAGER (for Chat feature)
# =============================================================================

try:
    from agents.manager import SessionManager as _SessionManager
    session_manager = _SessionManager()
except ImportError as e:
    import logging
    logging.getLogger(__name__).warning("agents/ package not available: %s", e)
    session_manager = None


# =============================================================================
# CHAT SESSION API
# =============================================================================

class SessionCreateRequest(BaseModel):
    cwd: str
    resume: Optional[str] = None
    append_system_prompt: Optional[str] = None
    model: Optional[str] = None
    max_turns: int = 10
    permission_mode: str = "acceptEdits"


@app.post("/api/sessions")
async def create_session(data: SessionCreateRequest):
    """Create a new Claude Code session for a project path."""
    if session_manager is None:
        raise HTTPException(status_code=503, detail="Agent SDK not available")
    if session_manager.is_at_limit():
        return {
            "session_id": None,
            "warning": f"Active session limit ({session_manager._max_sessions}) reached.",
            "active_count": session_manager.active_count,
        }
    project_path = _validate_project_path(data.cwd)
    if not project_path.is_dir():
        raise HTTPException(status_code=404, detail=f"Project not found: {data.cwd}")
    session = await session_manager.create_session(
        cwd=str(project_path),
        resume_id=data.resume,
        append_system_prompt=data.append_system_prompt,
        model=data.model,
        max_turns=data.max_turns,
        permission_mode=data.permission_mode,
    )
    return {
        "session_id": session.session_id,
        "created_at": session.created_at.isoformat(),
        "config": session.to_dict().get("config"),
    }


@app.get("/api/sessions/history")
async def list_session_history():
    """List previous Claude Code sessions for the session picker."""
    sessions = []
    claude_projects_dir = Path.home() / ".claude" / "projects"
    if claude_projects_dir.exists():
        try:
            for proj_dir in claude_projects_dir.iterdir():
                if not proj_dir.is_dir():
                    continue
                jsonl_files = list(proj_dir.glob("*.jsonl"))
                for jf in sorted(jsonl_files, key=lambda p: p.stat().st_mtime, reverse=True)[:50]:
                    try:
                        created = datetime.fromtimestamp(jf.stat().st_ctime)
                        modified = datetime.fromtimestamp(jf.stat().st_mtime)
                        last_user_msg = ""
                        msg_count = 0
                        with open(jf, "r", encoding="utf-8", errors="replace") as f:
                            for line in f:
                                try:
                                    obj = json.loads(line.strip())
                                    msg_count += 1
                                    if obj.get("type") == "user" and not last_user_msg:
                                        content = obj.get("message", {}).get("content", "")
                                        if isinstance(content, list):
                                            for c in content:
                                                if c.get("type") == "text":
                                                    last_user_msg = c["text"][:100]
                                                    break
                                        elif isinstance(content, str):
                                            last_user_msg = content[:100]
                                except (json.JSONDecodeError, KeyError):
                                    pass
                        sessions.append({
                            "session_id": jf.stem,
                            "project_path": str(proj_dir),
                            "created_at": created.isoformat(),
                            "last_active": modified.isoformat(),
                            "message_count": msg_count,
                            "topic_preview": last_user_msg or "(no user messages)",
                        })
                    except (OSError, json.JSONDecodeError):
                        pass
        except OSError:
            pass
    sessions.sort(key=lambda s: s["last_active"], reverse=True)
    return {"sessions": sessions[:100]}


@app.delete("/api/sessions/{session_id}")
async def close_session(session_id: str):
    """Close and clean up a specific session."""
    if session_manager is None:
        raise HTTPException(status_code=503, detail="Agent SDK not available")
    success = await session_manager.cancel_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "closed", "session_id": session_id}


@app.get("/api/fs/list")
async def list_directory(path: str):
    """List directory contents for the file browser dialog."""
    if not path:
        raise HTTPException(status_code=400, detail="path parameter required")
    abs_path = _validate_project_path(path)
    if not abs_path.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")
    entries = []
    skip_dirs = {".git", "node_modules", "__pycache__", ".venv", "venv", ".idea", ".vscode", ".autoresearch"}
    try:
        for entry in sorted(abs_path.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
            if entry.name.startswith(".") and entry.is_dir():
                continue
            if entry.name in skip_dirs:
                continue
            # Skip secret files (don't expose in directory listing)
            if entry.name in SECRET_NAMES or entry.suffix.lower() in SECRET_EXTS:
                continue
            stat = entry.stat()
            entries.append({
                "name": entry.name,
                "path": str(entry.resolve()),
                "is_directory": entry.is_dir(),
                "size": stat.st_size if not entry.is_dir() else 0,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat() if not entry.is_dir() else None,
            })
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")
    return {"entries": entries}


@app.get("/api/fs/search")
async def search_files(path: str, q: str, max_results: int = 30):
    """Search for text in project files (text-based grep)."""
    if not path or not q:
        raise HTTPException(status_code=400, detail="path and q parameters required")
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")
    abs_path = _validate_project_path(path)
    if not abs_path.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")

    # Text file extensions to search
    TEXT_EXTS = {
        '.py', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
        '.md', '.txt', '.rst', '.adoc',
        '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
        '.html', '.htm', '.css', '.scss', '.less', '.sass',
        '.sh', '.bash', '.zsh', '.fish',
        '.rs', '.go', '.java', '.kt', '.kts', '.swift',
        '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',
        '.rb', '.php', '.lua', '.r', '.R', '.jl',
        '.sql', '.graphql', '.prisma',
        '.dockerfile', '.makefile',
        '.gitignore', '.editorconfig',
        '.vue', '.svelte',
    }
    SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".idea",
                 ".vscode", ".autoresearch", "dist", "build", ".next", ".cache",
                 "target", "vendor", ".mypy_cache", ".pytest_cache", ".tox"}
    MAX_FILE_SIZE = 512 * 1024  # 512KB

    query_lower = q.lower()
    results = []
    try:
        for root, dirs, files in os.walk(abs_path):
            # Prune skipped directories
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
            for fname in files:
                if len(results) >= max_results:
                    break
                fpath = Path(root) / fname
                # Skip secret files
                if fname in SECRET_NAMES or fpath.suffix.lower() in SECRET_EXTS:
                    continue
                try:
                    if fpath.stat().st_size > MAX_FILE_SIZE:
                        continue
                    ext = fpath.suffix.lower()
                    if ext not in TEXT_EXTS and fname.lower() not in {'makefile', 'dockerfile', '.gitignore', 'license', 'readme'}:
                        continue
                    try:
                        text = fpath.read_text(encoding="utf-8", errors="replace")
                    except (PermissionError, OSError):
                        continue
                    lines = text.split('\n')
                    for li, line in enumerate(lines):
                        if query_lower in line.lower():
                            rel = str(fpath.relative_to(abs_path))
                            results.append({
                                "file": rel,
                                "abs_path": str(fpath),
                                "line": li + 1,
                                "text": line.strip()[:200],
                                "lang": ext.lstrip('.'),
                            })
                            if len(results) >= max_results:
                                break
                except (PermissionError, OSError):
                    continue
            if len(results) >= max_results:
                break
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    return {"query": q, "results": results, "total": len(results), "truncated": len(results) >= max_results}


@app.get("/api/fs/read")
async def read_file(path: str, offset: int = 0, limit: int = 500):
    """Read file content for the file preview panel in chat. Supports line-range pagination."""
    if not path:
        raise HTTPException(status_code=400, detail="path parameter required")
    abs_path = _validate_project_path(path)
    if not abs_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    # Block binary files and very large files
    stat = abs_path.stat()
    if stat.st_size > 2_000_000:  # 2MB max
        raise HTTPException(status_code=413, detail="File too large (max 2MB)")
    # Block files that may contain secrets
    if abs_path.name in SECRET_NAMES or abs_path.suffix.lower() in SECRET_EXTS:
        raise HTTPException(status_code=403, detail="Access denied: secret file")
    BINARY_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.zip', '.gz', '.tar', '.7z', '.exe', '.dll', '.so', '.dylib', '.bin', '.pyc', '.wasm'}
    if abs_path.suffix.lower() in BINARY_EXTS:
        raise HTTPException(status_code=400, detail="Binary files not supported for preview")
    try:
        content = abs_path.read_text(encoding="utf-8", errors="replace")
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:200])
    lines = content.split('\n')
    total_lines = len(lines)
    # Remove trailing empty line from split
    if lines and lines[-1] == '':
        total_lines -= 1
    offset = max(0, min(offset, total_lines))
    limit = max(1, min(limit, 1000))
    page_lines = lines[offset:offset + limit]
    # Guess language from extension
    ext_to_lang = {'.py': 'python', '.js': 'javascript', '.ts': 'typescript', '.jsx': 'jsx', '.tsx': 'tsx',
                   '.html': 'html', '.css': 'css', '.scss': 'scss', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
                   '.md': 'markdown', '.sh': 'bash', '.bash': 'bash', '.sql': 'sql', '.rs': 'rust', '.go': 'go',
                   '.java': 'java', '.kt': 'kotlin', '.rb': 'ruby', '.php': 'php', '.vue': 'vue', '.svelte': 'svelte',
                   '.toml': 'toml', '.ini': 'ini', '.cfg': 'ini', '.xml': 'xml', '.svg': 'xml'}
    lang = ext_to_lang.get(abs_path.suffix.lower(), 'text')
    return {
        "path": str(abs_path),
        "name": abs_path.name,
        "lang": lang,
        "size": stat.st_size,
        "total_lines": total_lines,
        "offset": offset,
        "limit": limit,
        "lines": page_lines,
    }


@app.get("/api/fs/preflight")
async def preflight_check(path: str):
    """Pre-flight check: verify project has required files for AutoResearch."""
    if not path:
        raise HTTPException(status_code=400, detail="path parameter required")
    abs_path = _validate_project_path(path)
    if not abs_path.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")

    checks = []
    # Check .autoresearch.json
    ar_json = abs_path / ".autoresearch.json"
    if ar_json.exists():
        try:
            data = json.loads(ar_json.read_text(encoding="utf-8", errors="replace"))
            goals_count = len(data.get("goals", []))
            completed = len(data.get("completed_goals", []))
            checks.append({"key": "autoresearch_json", "ok": True, "label": ".autoresearch.json",
                           "detail": f"{goals_count} goals, {completed} completed"})
        except Exception as e:
            checks.append({"key": "autoresearch_json", "ok": False, "label": ".autoresearch.json",
                           "detail": f"Parse error: {str(e)[:80]}"})
    else:
        checks.append({"key": "autoresearch_json", "ok": False, "label": ".autoresearch.json",
                       "detail": "Not found — run will create it"})

    # Check .git directory
    git_dir = abs_path / ".git"
    if git_dir.exists():
        checks.append({"key": "git", "ok": True, "label": ".git", "detail": "Git repository detected"})
    else:
        checks.append({"key": "git", "ok": False, "label": ".git", "detail": "Not a git repo — experiments won't commit"})

    # Check CLAUDE.md (optional but recommended)
    claude_md = abs_path / "CLAUDE.md"
    if claude_md.exists():
        checks.append({"key": "claude_md", "ok": True, "label": "CLAUDE.md", "detail": "Found"})
    else:
        checks.append({"key": "claude_md", "ok": None, "label": "CLAUDE.md", "detail": "Optional — agent instructions"})

    # Check prompt files
    prompt_dir = abs_path / ".autoresearch" / "prompts"
    if prompt_dir.exists():
        prompt_count = len(list(prompt_dir.glob("*.md")))
        checks.append({"key": "prompts", "ok": True, "label": "Prompts",
                       "detail": f"{prompt_count} prompt files"})
    else:
        checks.append({"key": "prompts", "ok": None, "label": "Prompts", "detail": "Using defaults"})

    all_ok = all(c["ok"] is not False for c in checks if c["key"] in ("autoresearch_json", "git"))
    return {"ready": all_ok, "checks": checks, "path": str(abs_path)}


# =============================================================================
# DOCUMENTATION SEARCH — ranked search across project docs
# =============================================================================

_docs_cache: Dict[str, Any] = {"project": None, "engine": None, "ts": 0.0}


def _get_docs_engine(project_dir: Path):
    """Get or create a cached DocSearchEngine for the project."""
    import time as _time
    key = str(project_dir)
    if _docs_cache["project"] == key and (_time.time() - _docs_cache["ts"]) < 300:
        return _docs_cache["engine"]
    from utils.docsearch import DocSearchEngine
    engine = DocSearchEngine(project_dir)
    count = engine.index()
    _docs_cache["project"] = key
    _docs_cache["engine"] = engine
    _docs_cache["ts"] = _time.time()
    return engine


@app.get("/api/docs/search")
async def search_docs(q: str, project: str = "", max_results: int = 15):
    """Search project documentation with relevance ranking (TF-IDF)."""
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")
    if max_results > 50:
        max_results = 50

    # Determine project directory
    if project:
        project_dir = Path(project).resolve()
        allowed_bases = {get_project_dir().resolve(), Path.cwd().resolve()}
        if not any(str(project_dir).startswith(str(base)) for base in allowed_bases):
            raise HTTPException(status_code=403, detail="Path traversal blocked")
    else:
        project_dir = get_project_dir().resolve()

    if not project_dir.is_dir():
        raise HTTPException(status_code=404, detail="Project directory not found")

    try:
        engine = _get_docs_engine(project_dir)
        results = engine.search(q.strip(), max_results=max_results)
        return {
            "query": q,
            "total_sections": engine._total_sections,
            "results": [
                {
                    "file": r.section.file_path,
                    "title": r.section.title,
                    "file_title": r.section.file_title,
                    "level": r.section.level,
                    "score": round(r.score, 3),
                    "matched_terms": r.matched_terms,
                    "snippet": r.snippet,
                    "line_start": r.section.line_start,
                    "line_end": r.section.line_end,
                }
                for r in results
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# RESEARCH WEBSOCKET — real-time experiment streaming
# =============================================================================

from fastapi import WebSocket, WebSocketDisconnect


@app.websocket("/ws/research")
async def research_websocket(websocket: WebSocket):
    """WebSocket for real-time research events (tool use, agent text, tokens)."""
    await websocket.accept()
    _research_ws_clients.append(websocket)

    await websocket.send_json({
        "type": "connected",
        "running": run_state["running"],
        "current_exp": run_state["current_exp"],
        "tokens": _active_runner.tokens.to_dict() if _active_runner else None,
    })

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.now().isoformat()})
            elif msg.get("type") == "cancel" and _active_runner:
                _active_runner.cancel()

    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _research_ws_clients:
            _research_ws_clients.remove(websocket)


# =============================================================================
# CHAT WEBSOCKET — real-time bidirectional streaming
# =============================================================================


@app.websocket("/ws/chat/{session_id}")
async def chat_websocket(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time chat streaming."""
    await websocket.accept()

    if session_manager is None:
        await websocket.send_json({"type": "error", "code": 503, "message": "Agent SDK not available", "recoverable": False})
        await websocket.close()
        return

    session = session_manager.get_session(session_id)
    if session is None:
        await websocket.send_json({"type": "error", "code": 404, "message": "Session not found", "recoverable": False})
        await websocket.close()
        return

    # Cancel grace period timer if client is reconnecting after a disconnect
    reactivated = session_manager.reactivate(session_id)
    if reactivated:
        logger.info("WebSocket reconnected for session %s", session_id)

    await websocket.send_json({
        "type": "connected",
        "session_id": session_id,
        "cwd": session.cwd,
        "resume_from": session.resume_id,
    })

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "code": 400, "message": "Invalid JSON", "recoverable": True})
                continue

            msg_type = msg.get("type", "")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.now().isoformat()})

            elif msg_type == "cancel":
                await session.cancel()
                await websocket.send_json({"type": "stream_end", "session_id": session_id})

            elif msg_type == "message":
                content = msg.get("content", "")
                images = msg.get("images", [])
                if not content and not images:
                    continue
                # Build multimodal prompt if images are present
                if images:
                    prompt_blocks = []
                    if content:
                        prompt_blocks.append({"type": "text", "text": content})
                    for img in images:
                        prompt_blocks.append(img)
                    prompt = prompt_blocks
                else:
                    prompt = content
                try:
                    async for event in session.send(prompt):
                        await websocket.send_json({
                            "type": "claude_event",
                            "event_type": event.get("type", "unknown"),
                            "data": event,
                        })
                    await websocket.send_json({"type": "stream_end", "session_id": session_id})
                except asyncio.CancelledError:
                    await websocket.send_json({"type": "stream_end", "session_id": session_id})
                except Exception as e:
                    await websocket.send_json({"type": "error", "code": 500, "message": str(e), "recoverable": True})
                    await websocket.send_json({"type": "stream_end", "session_id": session_id})

    except WebSocketDisconnect:
        pass
    finally:
        await session_manager.deactivate(session_id)


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import argparse
    import logging
    import signal
    import uvicorn

    parser = argparse.ArgumentParser(description="AutoResearch UI Dashboard")
    parser.add_argument("--project", "-p", type=str, default=".", help="Project directory")
    parser.add_argument("--port", type=int, default=7890, help="Server port (default: 7890)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Bind host")
    args = parser.parse_args()

    os.environ["AUTORESEARCH_PROJECT"] = str(Path(args.project).resolve())

    print(f"\n  AutoResearch UI")
    print(f"  http://{args.host}:{args.port}")
    print(f"  Project: {os.environ['AUTORESEARCH_PROJECT']}\n")

    # Verify all required project files exist at startup
    ensure_project_structure(verbose=True)

    # Suppress Windows ConnectionResetError on client disconnect
    logging.getLogger("asyncio").setLevel(logging.CRITICAL)

    def _cleanup(signum, frame):
        """Kill subprocess on Ctrl+C so the process exits cleanly."""
        proc = run_state.get("process")
        if proc and proc.poll() is None:
            try:
                proc.kill()
                proc.wait(timeout=3)
            except (OSError, ProcessLookupError):
                pass
        # Force exit — uvicorn may not handle SIGINT properly on Windows
        import sys
        sys.exit(0)

    # Windows doesn't support SIGTERM via signal.signal, but SIGINT (Ctrl+C) works
    signal.signal(signal.SIGINT, _cleanup)

    config = uvicorn.Config(app, host=args.host, port=args.port, log_level="warning", timeout_graceful_shutdown=2)
    server = uvicorn.Server(config)
    server.run()
