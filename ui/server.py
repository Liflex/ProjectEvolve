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
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "utils"))

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import HTMLResponse, FileResponse
    from fastapi.staticfiles import StaticFiles
    from pydantic import BaseModel
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

run_state = {
    "running": False,
    "process": None,
    "current_exp": 0,
    "total_exps": 0,
    "project": "",
    "started_at": None,
    "logs": [],
    "error": None,
}


# =============================================================================
# HELPERS
# =============================================================================

def get_project_dir() -> Path:
    return Path(os.environ.get("AUTORESEARCH_PROJECT", Path.cwd()))


def get_exp_dir() -> Path:
    return get_project_dir() / ".autoresearch" / "experiments"


from quality_loop import classify_experiment_type


def parse_experiments() -> List[Dict[str, Any]]:
    exp_dir = get_exp_dir()
    ctx_file = exp_dir / "accumulation_context.md"
    if not ctx_file.exists():
        return []

    content = ctx_file.read_text(encoding="utf-8")
    sections = re.split(r"(?=^## Experiment \d+)", content, flags=re.MULTILINE)

    experiments = []
    for section in sections:
        header_match = re.match(r"## Experiment (\d+) — (.+)", section)
        if not header_match:
            continue

        num = int(header_match.group(1))
        title = header_match.group(2).strip()

        date_match = re.search(r"\*\*Date:\*\*\s*(.+)", section)
        date = date_match.group(1).strip() if date_match else ""

        type_match = re.search(r"\*\*Type:\*\*\s*(.+)", section)
        exp_type = type_match.group(1).strip() if type_match else classify_experiment_type(title)

        score_match = re.search(
            r"\*\*Score:\*\*\s*([\d.]+|N/A)\s*\|\s*\*\*Decision:\*\*\s*(\w+)", section
        )
        if score_match:
            score, decision = score_match.group(1), score_match.group(2)
        else:
            score_m = re.search(r"\*\*Quality Gate Score:\*\*\s*([\d.]+)", section)
            result_m = re.search(r"\*\*Result:\*\*\s*(KEEP|DISCARD|MANUAL_REVIEW)", section)
            score = score_m.group(1) if score_m else "N/A"
            decision = result_m.group(1) if result_m else "N/A"

        def extract_section(name):
            m = re.search(
                rf"### {re.escape(name)}\s*\n(.*?)(?=\n### |\n---|\Z)", section, re.DOTALL
            )
            return m.group(1).strip() if m else ""

        what_done = extract_section("What Was Done")

        files_section = extract_section("Files Modified")
        files_modified = []
        if files_section:
            for line in files_section.split("\n"):
                line = line.strip().lstrip("- *").strip().strip("`")
                if line and line not in ("None", "none", "N/A"):
                    files_modified.append(line)

        results = extract_section("Results")
        notes = extract_section("Notes for Next")

        experiments.append(
            {
                "number": num,
                "title": title,
                "date": date,
                "type": exp_type,
                "score": score,
                "decision": decision,
                "what_done": what_done,
                "files_modified": files_modified,
                "results": results,
                "notes": notes,
            }
        )

    return experiments


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

    experiments = parse_experiments()
    exp = next((e for e in experiments if e["number"] == n), None)

    if not exp and not prompt_file.exists() and not output_file.exists():
        raise HTTPException(status_code=404, detail=f"Experiment {n} not found")

    base = exp or {
        "number": n, "title": f"Experiment {n}", "date": "", "type": "Unknown",
        "score": "N/A", "decision": "N/A", "what_done": "", "files_modified": [],
        "results": "", "notes": "",
    }

    return {
        **base,
        "prompt": prompt_file.read_text(encoding="utf-8") if prompt_file.exists() else "",
        "output": output_file.read_text(encoding="utf-8") if output_file.exists() else "",
    }


@app.get("/api/changes-log")
async def get_changes_log():
    log_file = get_exp_dir() / "changes_log.md"
    if not log_file.exists():
        return {"content": "# No changes log yet\n\nStart experiments to see changes here."}
    return {"content": log_file.read_text(encoding="utf-8")}


@app.get("/api/prompt")
async def get_prompt():
    prompt_file = AUTORESEARCH_HOME / "config" / "default_prompt.md"
    if not prompt_file.exists():
        return {"content": "# Prompt template not found"}
    return {"content": prompt_file.read_text(encoding="utf-8")}


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
    with open(config_file, "r", encoding="utf-8") as f:
        return json.load(f)


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
        with open(config_file, "r", encoding="utf-8") as f:
            existing = json.load(f)
    existing.update({
        "name": data.name, "description": data.description,
        "goals": data.goals, "constraints": data.constraints,
        "tech_stack": data.tech_stack, "focus_areas": data.focus_areas,
    })
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    return {"status": "ok"}


class RunRequest(BaseModel):
    iterations: int = 10
    timeout: int = 5
    max_time: int = 600
    project: str = "."


@app.post("/api/run")
async def start_run(data: RunRequest):
    global run_state
    if run_state["running"]:
        raise HTTPException(status_code=409, detail="Already running")

    project_dir = Path(data.project).resolve()
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

    try:
        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", errors="replace",
            cwd=project_dir, env=env,
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

    def monitor():
        global run_state
        stdout, stderr = process.communicate()
        run_state["logs"] = (stdout.split("\n") if stdout else [])[-100:]
        if stderr:
            run_state["logs"].extend(stderr.split("\n")[-50:])
        run_state["running"] = False
        if process.returncode != 0:
            run_state["error"] = stderr[:500] if stderr else f"Exit code {process.returncode}"

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
        "recent_logs": run_state["logs"][-50:],
    }


@app.post("/api/run/stop")
async def stop_run():
    global run_state
    if not run_state["running"] or not run_state["process"]:
        raise HTTPException(status_code=409, detail="Not running")
    run_state["process"].terminate()
    run_state["running"] = False
    return {"status": "stopped"}


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

# Serve /modules/ directory for plug-in scripts (pet.js, organism.js, etc.)
MODULES_DIR = STATIC_DIR / "modules"
if MODULES_DIR.exists():
    app.mount("/modules", StaticFiles(directory=str(MODULES_DIR)), name="modules")


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
