# Last Experiment Summary

**Experiment #163** — Chat toolbar cleanup — compact primary toolbar with MORE dropdown
**Date:** 2026-03-20

## What Was Done

1. **Compact primary toolbar** — убраны 10+ кнопок из primary row. Остались только: THINK toggle, Search (Ctrl+F), FILTER dropdown, MSGS count, streaming stats, budget bar, и кнопка MORE.
2. **MORE dropdown** — все продвинутые функции (CLEAR, PANELS, MSG folding, PINS, EXPORT, STATS, FILE SEARCH, GLOBAL SEARCH, CMD PALETTE, KEYBOARD SHORTCUTS) объединены в единый dropdown "MORE".
3. **Sub-dropdowns** — PANEL, MSG folding, PINS, EXPORT открываются как sub-dropdowns от MORE.
4. **Detached global search** — глобальный поиск вынесен из toolbar flow в абсолютно позиционированную панель.
5. **CSS updates** — новые стили для MORE dropdown, submenu positioning, detached panels.

## Files Modified

- `ui/static/templates/chat-section.js` — переписан toolbar: compact primary + MORE dropdown + detached global search
- `ui/static/js/app.js` — добавлено `_tbMoreOpen: false` state
- `ui/static/css/main.css` — стили `.tb-dropdown-more`, `.tb-dropdown-badge`, `.tb-dropdown-hint`, `.tb-submenu-right`, `.global-search-panel-detached`

## Key Results

Toolbar чата уменьшен с 16+ видимых кнопок до 3-4 primary + MORE. Все функции сохранены и доступны. Keyboard shortcuts не затронуты.

## For Next Iteration

Оценить какие bottom panels (RAW LOG, TOOLS SUMMARY, FILE PREVIEW) можно убрать или упростить.
