#!/usr/bin/env python3
"""
Experiment I/O — parsing, saving, and deduplication of experiment data.

Extracted from autoresearch.py to reduce monolith size.
All functions are pure I/O — they read/write experiment data without
logging or side effects beyond file operations.
"""

import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

# Re-export shared functions from quality_loop for convenient imports
from quality_loop import classify_experiment_type, parse_accumulation_context  # noqa: F401


# =============================================================================
# PRE-COMPILED REGEX PATTERNS — avoids recompilation on every call
# =============================================================================

_RE_TITLE = re.compile(r'\*\*Title:\*\*\s*(.+)')
_RE_TYPE = re.compile(r'\*\*Type:\*\*\s*(.+)')
_RE_HYPOTHESIS = re.compile(r'\*\*Hypothesis:\*\*\s*(.+?)(?=\n\*\*|\n### |\Z)', re.DOTALL)
_RE_FILES_INLINE = re.compile(r'\*\*Files Modified:\*\*\s*(.+?)(?:\n###|\n\*\*[A-Z]|\Z)', re.DOTALL)
_RE_FILES_HEADER = re.compile(r'### Files Modified\s*\n(.*?)(?=\n### |\Z)', re.DOTALL)
_RE_RESULTS = re.compile(r'### Results\s*\n(.*?)(?=\n### )', re.DOTALL)
_RE_AGENT_DECISION = re.compile(r'\*\*Result:\*\*\s*(KEEP|DISCARD|MANUAL_REVIEW)')
_RE_NOTES_NEXT = re.compile(r'\*\*Notes for Next:\*\*\s*(.*?)(?=\n>>>|$)', re.DOTALL)
_RE_BULLET = re.compile(r'\s*[-*]\s+')
_RE_MD_CHARS = re.compile(r'[`*\[\]]')
_RE_SECTION_HEADER = re.compile(r'^(Test Plan|Hypothesis|Target|Complexity|Metric|Notes for Next):', re.IGNORECASE)
_RE_DASH = re.compile(r'\s*[—–]\s+')
_RE_HYPHEN = re.compile(r'\s+-\s+')

# Patterns for _read_experiment_history()
_RE_EXP_HEADER = re.compile(r'^## Experiment (\d+) — (.+)', re.MULTILINE)
_RE_EXP_TYPE = re.compile(r'\*\*Type:\*\*\s*(.+)')
_RE_SCORE_DECISION = re.compile(r'\*\*Score:\*\*\s*([\d.]+|N/A)\s*\|\s*\*\*Decision:\*\*\s*(\w+)')
_RE_QUALITY_SCORE = re.compile(r'\*\*Quality Gate Score:\*\*\s*([\d.]+)')
_RE_RESULT = re.compile(r'\*\*Result:\*\*\s*(KEEP|DISCARD|MANUAL_REVIEW)')


# =============================================================================
# TRUNCATION
# =============================================================================

def _smart_truncate(text: str, max_chars: int = 1500) -> str:
    """Truncate text at the last complete line before max_chars.

    Avoids mid-sentence cuts that produce confusing partial text like
    "main() return code: `0 if s..." in last_experiment.md.
    Falls back to character-level truncation if text has no newlines.
    """
    text = text.strip()
    if len(text) <= max_chars:
        return text

    # Find the last newline before the limit
    cut_point = text.rfind('\n', 0, max_chars)
    if cut_point > max_chars // 2:
        return text[:cut_point]

    # No suitable newline — hard truncate
    return text[:max_chars]


# =============================================================================
# PARSING
# =============================================================================

def parse_experiment_report(output: str, iteration: int) -> Dict[str, Any]:
    """Parse experiment report from agent output.

    Matches the format from default_prompt.md template:
    **Title:** / **Hypothesis:** / **Files Modified:** / ### Results / **Notes for Next:**

    Args:
        output: Claude CLI output
        iteration: Experiment number

    Returns:
        Dict with experiment data
    """
    title = "Untitled"
    hypothesis = ""
    files_modified = []
    results = "N/A"
    notes_next = "N/A"

    # Title
    match = _RE_TITLE.search(output)
    if match:
        title = match.group(1).strip()

    # Type (self-reported with heuristic fallback for backward compatibility)
    exp_type = ""
    type_match = _RE_TYPE.search(output)
    if type_match:
        exp_type = type_match.group(1).strip()
    else:
        exp_type = classify_experiment_type(title)

    # Hypothesis (used as what_done)
    # Captures multi-line text until next bold line or heading
    match = _RE_HYPOTHESIS.search(output)
    if match:
        hypothesis = match.group(1).strip()

    # Files Modified — three supported formats:
    # 1. Inline bold: **Files Modified:** file1.py, file2.py
    # 2. Header + bullet: ### Files Modified\n- `file1.py` - desc\n- `file2.py`
    # 3. Header + inline: ### Files Modified\nfile1.py, file2.py
    files_text = ""

    # Format 1: inline bold **Files Modified:**
    match = _RE_FILES_INLINE.search(output)
    if match:
        files_text = match.group(1).strip()
    else:
        # Format 2/3: ### Files Modified (markdown header)
        match = _RE_FILES_HEADER.search(output)
        if match:
            files_text = match.group(1).strip()

    if files_text:
        lines = files_text.split('\n')
        # Detect bullet list by checking if lines start with "- " or "* "
        is_bullet = any(_RE_BULLET.match(line) for line in lines if line.strip())
        if not is_bullet and len(lines) <= 2 and ',' in files_text:
            # Inline: "file1.py, file2.py, file3.md"
            files_modified = [f.strip() for f in files_text.split(',') if f.strip()]
        else:
            # Bullet list: "- file1.py\n- file2.py" (or fallback for multi-line)
            for line in lines:
                line = line.strip().lstrip('- *').strip()
                if line:
                    files_modified.append(line)

        # Strip markdown formatting and trailing descriptions from filenames
        cleaned = []
        for f in files_modified:
            # Strip all markdown formatting chars first
            f = _RE_MD_CHARS.sub('', f.strip())
            # Reject non-filename patterns (false positives from report sections)
            if _RE_SECTION_HEADER.match(f):
                continue
            # Strip trailing description (after em-dash, en-dash, or long dash)
            f = _RE_DASH.split(f, maxsplit=1)[0]
            # Strip trailing after "—" with spaces (Unicode dash)
            f = _RE_HYPHEN.split(f, maxsplit=1)[0]
            f = f.strip(' ,:;')
            # Don't strip leading dots (.gitignore, .env, .autoresearch/)
            f = f.strip()
            if f and f not in ('.', 'None', 'none', 'N/A'):
                cleaned.append(f)
        files_modified = cleaned

    # Results — between ### Results and ### Decision
    match = _RE_RESULTS.search(output)
    if match:
        results = _smart_truncate(match.group(1).strip(), max_chars=1500)

    # Agent's self-decision from ### Decision section
    agent_decision = ""
    match = _RE_AGENT_DECISION.search(output)
    if match:
        agent_decision = match.group(1)

    # Notes for Next — after **Notes for Next:** until >>>EXPERIMENT_COMPLETE<<<
    match = _RE_NOTES_NEXT.search(output)
    if match:
        notes_next = _smart_truncate(match.group(1).strip(), max_chars=1000)

    what_done = hypothesis if hypothesis else "N/A"

    return {
        "number": iteration,
        "title": title,
        "what_done": what_done,
        "files_modified": [f for f in files_modified if f][:10],
        "results": results,
        "exp_type": exp_type,
        "agent_decision": agent_decision,
        "notes_next": notes_next,
        "date": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }


# =============================================================================
# DEDUPLICATION HELPERS
# =============================================================================

def _replace_entry(content: str, marker: str, new_entry: str) -> str:
    """Replace existing experiment entry in content.

    Searches for marker (e.g. '## Experiment 5 '), removes old entry
    up to the next '## Experiment' (not including), and inserts new one.

    Note: '---' is NOT a separator — it's part of each entry format.
    Only '\n## Experiment' marks the start of the next entry.
    """
    start = content.find(marker)
    if start == -1:
        return content + new_entry

    # Find the start of the next entry
    rest = content[start:]
    end = len(rest)
    pos = rest.find('\n## Experiment ', 1)
    if pos != -1:
        end = pos

    return content[:start] + new_entry + rest[end:]


def _append_experiment_entry(
    file_path: Path,
    header: str,
    entry: str,
    exp_number: int = None
):
    """Append or update experiment entry in a log file.

    If exp_number is specified and an entry with that number exists —
    the old entry is replaced (deduplication).
    """
    marker = f"## Experiment {exp_number} " if exp_number else None

    if file_path.exists():
        content = file_path.read_text(encoding="utf-8")
        if marker and marker in content:
            content = _replace_entry(content, marker, entry)
        else:
            content += entry
    else:
        content = f"# {header}\n\n{entry}"

    file_path.write_text(content, encoding="utf-8")


# =============================================================================
# HISTORY TABLE
# =============================================================================

def _read_experiment_history(exp_dir: Path, max_entries: int = 5) -> str:
    """Read compact experiment history from accumulation_context.md.

    Returns a markdown table with the last N experiments:
    number, type, title, quality score, and decision.
    Used by build_agent_prompt() for diversity awareness.

    Performance: scans headers via pre-compiled regex, extracts sections
    only for the last N entries — avoids creating strings for all experiments.
    """
    ctx_file = exp_dir / "accumulation_context.md"
    if not ctx_file.exists():
        return ""

    content = ctx_file.read_text(encoding="utf-8")

    # Find all experiment header positions (pre-compiled regex)
    positions = []
    for m in _RE_EXP_HEADER.finditer(content):
        positions.append((m.start(), int(m.group(1)), m.group(2).strip()))

    if not positions:
        return ""

    # Take only the last max_entries
    recent = positions[-max_entries:]

    # Extract data from each recent entry using pre-compiled patterns
    entries = []
    for idx, (start, num, title) in enumerate(recent):
        end = len(content)
        # Find next experiment start (next in the full positions list after this one)
        full_idx = len(positions) - len(recent) + idx
        if full_idx + 1 < len(positions):
            end = positions[full_idx + 1][0]
        section = content[start:end]

        type_match = _RE_EXP_TYPE.search(section)
        exp_type = type_match.group(1).strip() if type_match else classify_experiment_type(title)

        score_match = _RE_SCORE_DECISION.search(section)
        if score_match:
            score, decision = score_match.group(1), score_match.group(2)
        else:
            score_m = _RE_QUALITY_SCORE.search(section)
            result_m = _RE_RESULT.search(section)
            score = score_m.group(1) if score_m else "N/A"
            decision = result_m.group(1) if result_m else "N/A"

        entries.append({
            "number": num, "title": title, "type": exp_type,
            "score": score, "decision": decision
        })

    lines = [
        "| # | Type        | Title | Score | Decision |",
        "|---|-------------|-------|-------|----------|"
    ]
    for e in entries:
        title = e["title"]
        exp_type = e["type"]
        if len(title) > 40:
            title = title[:37] + "..."
        if len(exp_type) > 12:
            exp_type = exp_type[:11] + "..."
        lines.append(f"| {e['number']} | {exp_type:<12} | {title} | {e['score']} | {e['decision']} |")

    return "\n".join(lines)


# =============================================================================
# SAVE FUNCTIONS
# =============================================================================

def _format_files_bullet(files: list) -> str:
    """Format file list as markdown bullet items."""
    if files:
        return "\n".join(f"- {f}" for f in files)
    return "- None"


def save_last_experiment_summary(project_dir: Path, experiment: Dict[str, Any]):
    """Save brief summary of the LAST experiment only (overwritten each iteration)."""
    exp_dir = project_dir / ".autoresearch" / "experiments"
    exp_dir.mkdir(parents=True, exist_ok=True)
    last_exp_file = exp_dir / "last_experiment.md"

    summary = f"""# Last Experiment Summary

**Experiment #{experiment['number']}** — {experiment.get('title', 'Untitled')}
**Date:** {experiment.get('date', '')}
**Duration:** {experiment.get('duration', 0):.0f}s

## What Was Done

{experiment.get('what_done', 'N/A')}

## Files Modified

{_format_files_bullet(experiment.get('files_modified', []))}

## Key Results

{experiment.get('results', 'N/A')}
"""
    if experiment.get("quality_score") is not None:
        summary += f"""
## Independent Quality Gate

**Score:** {experiment['quality_score']:.2f}
**Decision:** {experiment.get('quality_decision', 'N/A')}
**Agent self-assessment:** {experiment.get('agent_decision', 'N/A')}
"""
    summary += f"""
## For Next Iteration

{experiment.get('notes_next', 'N/A')}
"""

    last_exp_file.write_text(summary, encoding="utf-8")


def save_accumulation_context(project_dir: Path, experiment: Dict[str, Any]):
    """Append experiment to the full experiment log (with dedup)."""
    exp_dir = project_dir / ".autoresearch" / "experiments"

    entry = f"""
## Experiment {experiment['number']} — {experiment.get('title', 'Untitled')}

**Date:** {experiment.get('date', '')}
**Type:** {experiment.get('exp_type', 'Other')}

### What Was Done

{experiment.get('what_done', 'N/A')}

### Files Modified

{_format_files_bullet(experiment.get('files_modified', []))}

### Results

{experiment.get('results', 'N/A')}

### Quality Gate (Independent)
**Score:** {experiment.get('quality_score', 'N/A')} | **Decision:** {experiment.get('quality_decision', 'N/A')}

### Notes for Next

{experiment.get('notes_next', 'N/A')}

---
"""

    _append_experiment_entry(
        exp_dir / "accumulation_context.md",
        "AutoResearch Experiment Log",
        entry,
        experiment['number']
    )


def save_changes_log(project_dir: Path, experiment: Dict[str, Any]):
    """Append experiment entry to the changes chronicle (with dedup)."""
    exp_dir = project_dir / ".autoresearch" / "experiments"

    entry = f"""## Experiment {experiment['number']} — {experiment.get('title', 'Untitled')}

**Time:** {experiment.get('date', '')}
**Duration:** {experiment.get('duration', 0):.0f}s

**Files:** {', '.join(experiment.get('files_modified', [])) if experiment.get('files_modified') else 'None'}

**What was done:**

{experiment.get('what_done', 'N/A')}

**Results:**

{experiment.get('results', 'N/A')}

**Quality Gate:** {experiment.get('quality_score', 'N/A')} ({experiment.get('quality_decision', 'N/A')})


"""

    _append_experiment_entry(
        exp_dir / "changes_log.md",
        "AutoResearch Changes Log",
        entry,
        experiment['number']
    )
