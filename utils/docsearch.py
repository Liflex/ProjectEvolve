"""Project documentation search engine with relevance ranking.

Indexes project documentation files (.md, README, CLAUDE.md, docs/),
splits content into sections by headings, and ranks results using TF-IDF-like
scoring. Designed as a stepping stone toward full semantic/embedding search.

Usage::

    engine = DocSearchEngine(project_dir)
    results = engine.search("authentication", max_results=10)
"""

from __future__ import annotations

import math
import os
import re
import logging
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class DocSection:
    """A section of a documentation file."""
    file_path: str          # relative path from project root
    abs_path: str           # absolute path
    title: str              # section heading (or file name if no heading)
    level: int              # heading level (1-6, 0 = file header)
    content: str            # section text content (stripped of markdown)
    line_start: int         # 1-based line number of section start
    line_end: int           # 1-based line number of section end
    file_title: str = ""    # first heading of the file (for context)


@dataclass
class SearchResult:
    """A single search result with relevance score."""
    section: DocSection
    score: float
    matched_terms: List[str] = field(default_factory=list)
    snippet: str = ""


# ---------------------------------------------------------------------------
# Stop words (common English + Russian)
# ---------------------------------------------------------------------------

STOP_WORDS = {
    # English
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "no", "not", "only", "own", "same",
    "so", "than", "too", "very", "just", "because", "but", "and", "or",
    "if", "while", "about", "up", "it", "its", "this", "that", "these",
    "those", "what", "which", "who", "whom", "their", "them", "they",
    "his", "her", "she", "he", "we", "you", "i", "me", "my", "your",
    "our", "us", "also", "new", "like", "get", "got", "use", "used",
    "make", "made", "any", "many", "much", "well", "way", "even",
    # Russian
    "и", "в", "на", "с", "по", "к", "у", "из", "за", "от", "до", "не",
    "что", "это", "как", "для", "но", "или", "все", "так", "его", "она",
    "они", "мы", "ты", "он", "ее", "им", "их", "бы", "был", "была",
    "было", "быть", "может", "мой", "наш", "ваш", "мой", "кто", "чем",
    "где", "когда", "почему", "зачем", "уже", "еще", "тоже", "также",
    "только", "очень", "ещё", "при", "через", "между", "перед", "после",
    "над", "под", "без", "про", "о", "об", "а", "да", "нет",
}

# Documentation file patterns to prioritize
DOC_PATTERNS = [
    "README*", "readme*", "CONTRIBUTING*", "CHANGELOG*", "CHANGES*",
    "CLAUDE.md", ".claude/**/*.md",
    "docs/**/*.md", "doc/**/*.md",
    "ARCHITECTURE*", "DESIGN*", "ROADMAP*", "GOALS*",
    "*.md",
]

# Skip directories
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    ".idea", ".vscode", ".autoresearch", "dist", "build",
    ".next", ".cache", "target", "vendor", ".mypy_cache",
    ".pytest_cache", ".tox", "site-packages", ".eggs",
}


# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------

def tokenize(text: str) -> List[str]:
    """Tokenize text into lowercase words, filtering stop words."""
    # Extract words: letters, digits, underscores, hyphens (in middle)
    words = re.findall(r'[a-zA-Zа-яА-ЯёЁ][a-zA-Zа-яА-ЯёЁ0-9_-]*', text.lower())
    return [w for w in words if w not in STOP_WORDS and len(w) > 1]


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class DocSearchEngine:
    """Search engine for project documentation."""

    def __init__(self, project_dir: Path, max_file_size: int = 512 * 1024):
        self.project_dir = Path(project_dir).resolve()
        self.max_file_size = max_file_size
        self.sections: List[DocSection] = []
        self._doc_freq: Counter = Counter()  # term -> number of sections containing it
        self._total_sections = 0

    def index(self) -> int:
        """Index all documentation files. Returns number of sections found."""
        self.sections = []
        self._doc_freq = Counter()
        self._total_sections = 0

        self._index_directory(self.project_dir)
        self._total_sections = len(self.sections)

        # Compute document frequencies
        for section in self.sections:
            unique_terms = set(tokenize(section.content + " " + section.title))
            for term in unique_terms:
                self._doc_freq[term] += 1

        return self._total_sections

    def _index_directory(self, base_dir: Path) -> None:
        """Walk directory and index documentation files."""
        try:
            entries = list(base_dir.iterdir())
        except PermissionError:
            return

        for entry in sorted(entries, key=lambda e: (not e.is_dir(), e.name.lower())):
            if entry.is_dir():
                if entry.name in SKIP_DIRS or entry.name.startswith('.'):
                    continue
                self._index_directory(entry)
                continue

            # Check if file looks like documentation
            if not self._is_doc_file(entry, base_dir):
                continue

            try:
                if entry.stat().st_size > self.max_file_size:
                    continue
                text = entry.read_text(encoding="utf-8", errors="replace")
            except (PermissionError, OSError):
                continue

            rel_path = str(entry.relative_to(self.project_dir))
            file_title = self._extract_file_title(text) or entry.name
            self._parse_sections(text, rel_path, str(entry), file_title)

    def _is_doc_file(self, path: Path, base_dir: Path) -> bool:
        """Check if a file is a documentation file."""
        name = path.name.lower()
        if name.endswith('.md'):
            return True
        if name.endswith('.txt') and any(kw in name for kw in ('readme', 'license', 'changelog', 'changes')):
            return True
        if name.endswith('.rst'):
            return True
        # Check against patterns
        rel = str(path.relative_to(base_dir))
        rel_lower = rel.lower()
        for pattern in DOC_PATTERNS:
            if self._match_glob(pattern, rel_lower):
                return True
        return False

    @staticmethod
    def _match_glob(pattern: str, path: str) -> bool:
        """Simple glob matching (supports * and **)."""
        # Convert glob to regex
        regex_parts = []
        i = 0
        while i < len(pattern):
            if pattern[i:i+2] == '**':
                regex_parts.append('.*')
                i += 2
            elif pattern[i] == '*':
                regex_parts.append('[^/]*')
                i += 1
            else:
                regex_parts.append(re.escape(pattern[i]))
                i += 1
        regex = '^' + ''.join(regex_parts) + '$'
        return bool(re.match(regex, path, re.IGNORECASE))

    @staticmethod
    def _extract_file_title(text: str) -> str:
        """Extract the first # heading from markdown text."""
        for line in text.split('\n'):
            line = line.strip()
            m = re.match(r'^#{1,6}\s+(.+)$', line)
            if m:
                return m.group(1).strip()
        return ""

    def _parse_sections(self, text: str, rel_path: str, abs_path: str, file_title: str) -> None:
        """Parse markdown text into sections by headings."""
        lines = text.split('\n')
        current_title = file_title
        current_level = 0
        current_lines: List[str] = []
        line_start = 1

        def flush(end_line: int) -> None:
            content = '\n'.join(current_lines).strip()
            if not content:
                return
            section = DocSection(
                file_path=rel_path,
                abs_path=abs_path,
                title=current_title,
                level=current_level,
                content=content,
                line_start=line_start,
                line_end=end_line,
                file_title=file_title,
            )
            self.sections.append(section)

        for i, line in enumerate(lines):
            heading_match = re.match(r'^(#{1,6})\s+(.+)$', line.strip())
            if heading_match:
                # Flush previous section
                flush(i + 1)
                current_level = len(heading_match.group(1))
                current_title = heading_match.group(2).strip()
                current_lines = []
                line_start = i + 1
            else:
                current_lines.append(line)

        # Flush last section
        flush(len(lines))

    def search(self, query: str, max_results: int = 15) -> List[SearchResult]:
        """Search sections by query. Returns ranked results."""
        if not query or not query.strip() or len(query.strip()) < 2:
            return []

        query_terms = tokenize(query)
        if not query_terms:
            return []

        # Score each section
        scored: List[SearchResult] = []
        for section in self.sections:
            score, matched = self._score_section(section, query_terms)
            if score > 0:
                snippet = self._extract_snippet(section, matched)
                scored.append(SearchResult(
                    section=section,
                    score=score,
                    matched_terms=matched,
                    snippet=snippet,
                ))

        # Sort by score descending
        scored.sort(key=lambda r: r.score, reverse=True)
        return scored[:max_results]

    def _score_section(self, section: DocSection, query_terms: List[str]) -> Tuple[float, List[str]]:
        """Score a section against query terms. Returns (score, matched_terms)."""
        title_tokens = tokenize(section.title)
        content_tokens = tokenize(section.content)
        file_title_tokens = tokenize(section.file_title)

        title_len = len(title_tokens) or 1
        content_len = len(content_tokens) or 1
        title_counter = Counter(title_tokens)
        content_counter = Counter(content_tokens)

        score = 0.0
        matched = []

        for term in query_terms:
            # Term frequency in title (weighted heavily)
            tf_title = title_counter.get(term, 0) / title_len

            # Term frequency in content
            tf_content = content_counter.get(term, 0) / content_len

            # Inverse document frequency
            df = self._doc_freq.get(term, 0)
            idf = math.log((self._total_sections + 1) / (df + 1)) + 1

            # File title bonus
            in_file_title = term in file_title_tokens

            # Combined score
            term_score = (tf_title * 3.0 + tf_content * 1.0) * idf
            if in_file_title:
                term_score *= 1.5

            # Exact phrase match bonus
            if term in section.title.lower():
                term_score *= 2.0

            if term_score > 0:
                score += term_score
                matched.append(term)

        return score, matched

    @staticmethod
    def _extract_snippet(section: DocSection, matched_terms: List[str]) -> str:
        """Extract a relevant snippet from section content around matched terms."""
        if not matched_terms:
            return section.content[:200]

        lines = section.content.split('\n')
        # Find the best line (one with most matched terms)
        best_line_idx = 0
        best_count = 0
        for i, line in enumerate(lines):
            line_lower = line.lower()
            count = sum(1 for t in matched_terms if t in line_lower)
            if count > best_count:
                best_count = count
                best_line_idx = i

        # Extract context: 1 line before, best line, 2 lines after
        start = max(0, best_line_idx - 1)
        end = min(len(lines), best_line_idx + 3)
        snippet = '\n'.join(lines[start:end]).strip()

        # Truncate to ~300 chars
        if len(snippet) > 300:
            snippet = snippet[:300] + '...'
        return snippet
