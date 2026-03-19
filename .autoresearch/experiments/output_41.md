Let me examine the theme system and settings to understand what exists.
Let me look at the chat section of the HTML to understand the current state.
Now I have a clear picture. Let me implement the experiment.

## Experiment 41: Dracula Theme (Dark IDE)

**Type:** Feature
**Goal:** Добавление шаблона темы Dark Dracula как в JetBrains IDE
**Target:** `ui/static/js/app.js` — themes, themeMeta, cmdPaletteCommands
**Complexity Impact:** 0 файлов
Now let me verify the migration logic — the old code migrates `dracula` → `darcula`. Since we now have a legitimate `dracula` theme, I need to remove that migration so it doesn't override users who intentionally chose Dracula.
JS syntax is clean. The JSON error is a known Windows encoding issue (cp1251) — not related to my change. Let me verify properly:
Both checks pass. Let me also verify the Dracula theme is properly wired by checking the key insertion points:
All 4 integration points are in place: `themeMeta`, `themes`, `cmdPaletteCommands`. The theme selector in settings UI uses `Object.entries(themeMeta)` so it will automatically show the new Dracula card.
Now let me write the experiment report and update the experiment files.
The file has CRLF line endings and special characters. Let me prepend the new entry using a different approach.
Experiment 41 complete. Here's the report:

---

## Experiment Report

**Number:** 41
**Title:** Dracula Theme
**Type:** Feature
**Goal:** Добавление шаблона темы Dark Dracula как в JetBrains IDE
**Target:** `ui/static/js/app.js`
**Complexity Impact:** 0 файлов

### Files Modified

- `ui/static/js/app.js` — `themes.dracula`, `themeMeta.dracula`, `cmdPaletteCommands` entry, removed stale migration

### Results

**What was done:**
- Добавлена полная тема Dracula (https://draculatheme.com/) со всеми CSS-переменными
- Palette: bg `#282a36`, purple `#bd93f9`, pink `#ff79c6`, cyan `#8be9fd`, green `#50fa7b`, yellow `#f1fa8c`, red `#ff5555`, orange `#ffb86c`
- Font: JetBrains Mono / Fira Code, 14px
- Chat bubble styles — soft Dracula purple tint
- Syntax highlighting — keywords pink, strings yellow, comments blue, functions green, numbers purple
- Добавлена в Command Palette (Ctrl+Shift+P → "Theme: Dracula")
- Добавлена в настройки UI как preview card с swatches
- Удалена старая миграция `dracula` → `darcula` (теперь обе темы валидны)

**Working:** yes — JS syntax valid, 0 new files/dependencies
**Tests:** skipped — UI-only change (CSS variable theme)

### Decision

**Result:** KEEP
**Reason:** Конкретная видимая фича из фокусных областей. Тема сразу доступна через настройки и Command Palette.
**Next:** Продолжить работу над UI/UX чата или стилизацией вывода агента под шаблоны тем

>>>EXPERIMENT_COMPLETE<<<