# Last Experiment Summary

**Experiment #140** — Chat — collapsible markdown sections (heading fold/unfold)

**Date:** 2026-03-20

## What Was Done

1. **`_addSectionFolding(html, prefix)`** — replaces `_addHeadingIds`. For messages with 3+ headings, wraps each heading + its content in a collapsible `<div class="md-section">`. Clicking a heading toggles `.md-section-collapsed` class. Falls back to simple ID injection for messages with fewer headings.
2. **Fold arrow** — each heading gets a fold arrow (▼) that rotates 90° when collapsed.
3. **TOC collapse/expand all** — "FOLD" and "OPEN" buttons in the OUTLINE panel header.
4. **CSS** — new styles for sections, fold arrows, collapsed state.

## Files Modified

- `ui/static/js/modules/chat.js` — _addSectionFolding(), _toggleAllSections(), TOC fold/open buttons
- `ui/static/css/main.css` — .md-section, .md-heading, .md-fold-arrow, .md-section-collapsed, .md-section-body, .msg-toc-collapse-btn

## Key Results

- Messages with 3+ headings now have clickable fold/unfold on each heading
- OUTLINE panel has FOLD ALL / OPEN ALL buttons
- Arrow indicator rotates on collapse
- Backward compatible: messages with <3 headings use simple ID injection

## For Next Iteration

- Could add persistence for collapsed sections state
- Could add double-click to collapse all except clicked section
- Could add keyboard shortcut for section folding
