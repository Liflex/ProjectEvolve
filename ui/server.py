#!/usr/bin/env python3
"""
AutoResearch UI - Web Dashboard for running and monitoring experiments.

Usage:
    python ui/server.py                        # Serve current directory's project
    python ui/server.py --project /path/to     # Serve specific project
    python ui/server.py --port 3000            # Custom port
"""

import json
import os
import re
import subprocess
import sys
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

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


def get_exp_dir() -> Path:
    return get_project_dir() / ".autoresearch" / "experiments"


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
        # Extract metadata
        title_m = re.search(r"## Experiment \d+:?\s*(.+)", section)
        title = title_m.group(1).strip() if title_m else f"Experiment {number}"
        date_m = re.search(r"Date:\s*(.+)", section)
        date = date_m.group(1).strip() if date_m else ""
        score_m = re.search(r"Score:\s*([\d.]+)", section)
        score = float(score_m.group(1)) if score_m else 0.5
        decision_m = re.search(r"Decision:\s*(KEEP|DISCARD|ACCEPT|N/A)", section)
        decision = decision_m.group(1) if decision_m else "N/A"
        type_m = re.search(r"Type:\s*(.+)", section)
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


def _enrich_experiment(entry: Dict[str, Any], section: str) -> Dict[str, Any]:
    """Add UI-specific fields (what_done, files_modified, results, notes)
    by parsing the raw section text from accumulation_context.md."""
    files_section = _extract_section(section, "Files Modified")
    files_modified = []
    if files_section:
        for line in files_section.split("\n"):
            line = line.strip().lstrip("- *").strip().strip("`")
            if line and line not in ("None", "none", "N/A"):
                files_modified.append(line)

    return {
        **entry,
        "what_done": _extract_section(section, "What Was Done"),
        "files_modified": files_modified,
        "results": _extract_section(section, "Results"),
        "notes": _extract_section(section, "Notes for Next"),
    }


# File-mtime cache: avoids re-reading and re-parsing accumulation_context.md
# on every API call (dashboard polls /api/stats every 1s).
_cache = {"data": None, "mtime": 0.0}


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

    ctx_file = get_exp_dir() / "accumulation_context.md"
    if not ctx_file.exists():
        return []

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

    result = [_enrich_experiment(e, section_map.get(e["number"], ""))
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
    total = len(experiments)
    keep = sum(1 for e in experiments if e["decision"] == "KEEP")
    discard = sum(1 for e in experiments if e["decision"] == "DISCARD")

    scores = []
    for e in experiments:
        try:
            s = float(e["score"])
            if s != 0.5:
                scores.append(s)
        except (ValueError, TypeError):
            pass
    avg_score = round(sum(scores) / len(scores), 2) if scores else 0

    type_dist: Dict[str, int] = {}
    for e in experiments:
        type_dist[e["type"]] = type_dist.get(e["type"], 0) + 1

    score_trend = []
    for e in experiments[-20:]:
        try:
            score_trend.append(
                {"number": e["number"], "score": float(e["score"]), "decision": e["decision"]}
            )
        except (ValueError, TypeError):
            pass

    return {
        "total_experiments": total,
        "keep_count": keep,
        "discard_count": discard,
        "avg_score": avg_score,
        "type_distribution": type_dist,
        "score_trend": score_trend,
        "last_experiment": experiments[-1] if experiments else None,
        "run_status": {
            "running": run_state["running"],
            "current_exp": run_state["current_exp"],
            "total_exps": run_state["total_exps"],
            "started_at": run_state["started_at"],
        },
    }


@app.get("/api/experiments")
async def get_experiments():
    return parse_experiments()


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


@app.get("/api/changes-log")
async def get_changes_log():
    log_file = get_exp_dir() / "changes_log.md"
    if not log_file.exists():
        return {"content": "# No changes log yet\n\nStart experiments to see changes here."}
    try:
        return {"content": log_file.read_text(encoding="utf-8")}
    except (UnicodeDecodeError, OSError):
        return {"content": "# Error reading changes log"}


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
    content: str


@app.put("/api/prompt")
async def update_prompt(data: PromptUpdate):
    prompt_file = AUTORESEARCH_HOME / "config" / "default_prompt.md"
    prompt_file.parent.mkdir(parents=True, exist_ok=True)
    prompt_file.write_text(data.content, encoding="utf-8")
    return {"status": "ok"}


@app.get("/api/config")
async def get_config():
    config_file = get_project_dir() / ".autoresearch.json"
    if not config_file.exists():
        return {"name": "", "description": "", "goals": [], "constraints": [],
                "tech_stack": [], "focus_areas": []}
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {"name": "", "description": "", "goals": [], "constraints": [],
                "tech_stack": [], "focus_areas": [], "_error": "Malformed config file"}


class ConfigUpdate(BaseModel):
    name: str = ""
    description: str = ""
    goals: List[str] = []
    constraints: List[str] = []
    tech_stack: List[str] = []
    focus_areas: List[str] = []


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
        "goals": data.goals, "constraints": data.constraints,
        "tech_stack": data.tech_stack, "focus_areas": data.focus_areas,
    })
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    return {"status": "ok"}


class RunRequest(BaseModel):
    iterations: int = Field(default=10, ge=1, le=1000)
    timeout: int = Field(default=5, ge=0, le=1440)
    max_time: int = Field(default=600, ge=30, le=3600)
    project: str = "."


@app.post("/api/run")
async def start_run(data: RunRequest):
    global run_state
    if run_state["running"]:
        raise HTTPException(status_code=409, detail="Already running")

    project_dir = Path(data.project).resolve()
    # Prevent path traversal: project must be a subdirectory of CWD or an
    # explicitly allowed ancestor.  Reject paths containing ".." components
    # that escape the working directory.
    if ".." in Path(data.project).parts:
        raise HTTPException(status_code=400, detail="Path traversal detected: '..' not allowed in project path")
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Project not found: {data.project}")

    autoresearch_script = AUTORESEARCH_HOME / "autoresearch.py"
    if not autoresearch_script.exists():
        raise HTTPException(status_code=404, detail="autoresearch.py not found")

    cmd = [
        sys.executable, str(autoresearch_script),
        str(project_dir), str(data.iterations), str(data.timeout),
        "--max-time", str(data.max_time),
    ]

    env = os.environ.copy()
    env.pop("CLAUDECODE", None)
    env.pop("CLAUDE_SESSION_ID", None)
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"

    try:
        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", errors="replace",
            cwd=project_dir, env=env, bufsize=1,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start: {e}")

    run_state.update({
        "running": True, "process": process,
        "current_exp": 0, "total_exps": data.iterations,
        "project": str(project_dir),
        "started_at": datetime.now().isoformat(),
        "logs": [], "error": None,
    })

    # Initial info logs
    prompt_file = AUTORESEARCH_HOME / "config" / "default_prompt.md"
    prompt_size = len(prompt_file.read_text(encoding="utf-8")) if prompt_file.exists() else 0
    ctx_file = get_exp_dir() / "accumulation_context.md"
    ctx_size = len(ctx_file.read_text(encoding="utf-8")) if ctx_file.exists() else 0

    for init_line in [
        f"[INIT] Starting autoresearch PID={process.pid}",
        f"[INIT] Project: {project_dir}",
        f"[INIT] Iterations: {data.iterations} | Timeout: {data.timeout}min | Max time: {data.max_time}s",
        f"[INIT] Command: {' '.join(cmd)}",
        f"[INIT] Prompt size: {prompt_size:,} bytes ({prompt_size/1024:.1f} KB)",
        f"[INIT] Context size: {ctx_size:,} bytes ({ctx_size/1024:.1f} KB)",
        f"[INIT] Waiting for process output...",
    ]:
        _log_append(init_line)

    def _stream_pipe(pipe, prefix=""):
        """Read lines from a pipe, parse experiment progress, and append to logs."""
        try:
            for line in iter(pipe.readline, ''):
                text = line.rstrip("\n\r")
                if not text:
                    continue
                if prefix:
                    text = prefix + text
                _log_append(text)

                # Parse experiment progress from log lines
                m = _EXP_PROGRESS_RE.search(text)
                if m:
                    run_state["current_exp"] = int(m.group(1))
        except Exception:
            pass
        finally:
            try:
                pipe.close()
            except Exception:
                pass

    def monitor():
        global run_state
        # Stream stdout/stderr in real-time via threads (cross-platform)
        t_out = threading.Thread(target=_stream_pipe, args=(process.stdout,), daemon=True)
        t_err = threading.Thread(target=_stream_pipe, args=(process.stderr,), daemon=True)
        t_out.start()
        t_err.start()

        process.wait()  # Block until process exits
        t_out.join(timeout=5)
        t_err.join(timeout=5)

        run_state["running"] = False
        if process.returncode != 0:
            logs_snapshot = _log_read()
            stderr_lines = [l for l in logs_snapshot if "ERROR" in l or "Traceback" in l or "error" in l.lower()]
            run_state["error"] = "\n".join(stderr_lines[:5]) if stderr_lines else f"Exit code {process.returncode}"

    threading.Thread(target=monitor, daemon=True).start()
    return {"status": "started", "iterations": data.iterations}


@app.get("/api/run/status")
async def get_run_status():
    return {
        "running": run_state["running"],
        "current_exp": run_state["current_exp"],
        "total_exps": run_state["total_exps"],
        "project": run_state["project"],
        "started_at": run_state["started_at"],
        "error": run_state["error"],
        "recent_logs": _log_read(200),
    }


@app.post("/api/run/stop")
async def stop_run():
    global run_state
    if not run_state["running"] or not run_state["process"]:
        raise HTTPException(status_code=409, detail="Not running")
    proc = run_state["process"]
    # Force kill — no graceful shutdown
    proc.kill()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        pass
    # Kill any child processes (claude CLI spawned by autoresearch)
    try:
        import psutil
        parent = psutil.Process(proc.pid)
        for child in parent.children(recursive=True):
            try:
                child.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except (ImportError, psutil.NoSuchProcess):
        pass
    run_state["running"] = False
    run_state["process"] = None
    _log_append("[STOP] Process killed.")
    return {"status": "killed"}


@app.get("/api/logs")
async def get_logs(limit: int = 50):
    log_file = get_project_dir() / ".autoresearch" / "logs" / "autoresearch.log"
    if not log_file.exists():
        return {"logs": []}
    try:
        content = log_file.read_text(encoding="utf-8")
        return {"logs": content.strip().split("\n")[-limit:]}
    except Exception:
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
    system_prompt_append: Optional[str] = None


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
    project_path = Path(data.cwd).resolve()
    if not project_path.is_dir():
        raise HTTPException(status_code=404, detail=f"Project not found: {data.cwd}")
    session = await session_manager.create_session(
        cwd=str(project_path),
        resume_id=data.resume,
    )
    return {"session_id": session.session_id, "created_at": session.created_at.isoformat()}


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
    abs_path = Path(path).resolve()
    allowed_bases = {get_project_dir().resolve(), Path.cwd().resolve()}
    if not any(str(abs_path).startswith(str(base)) for base in allowed_bases):
        raise HTTPException(status_code=403, detail="Path traversal blocked")
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


# =============================================================================
# CHAT WEBSOCKET — real-time bidirectional streaming
# =============================================================================

import asyncio
from fastapi import WebSocket, WebSocketDisconnect


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
                if not content:
                    continue
                try:
                    async for event in session.send(content):
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

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
