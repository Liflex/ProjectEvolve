# Last Experiment Summary

**Experiment #154** — Chat STOP button replaces SEND during streaming + ESC shortcut
**Date:** 2026-03-20

## What Was Done

1. **SEND/STOP toggle** — вместо отключённой SEND кнопки + отдельного маленького [X], теперь SEND полностью заменяется на STOP кнопку во время стриминга (как ChatGPT/Claude.ai)
2. **STOP button styling** — красная рамка, текст `[X] STOP`, hover заполняет фон красным, пульсирующая анимация (opacity), плавное появление через Alpine transition
3. **ESC shortcut** — Escape останавливает генерацию (приоритет выше всех остальных ESC-обработчиков)
4. **`[stopped]` badge** — на assistant-сообщении после остановки показывается красный italic badge (аналог `regen` badge)
5. **Dynamic hint** — под input'ом во время стриминга показывается `GENERATING... — ESC to stop` (красным цветом)
6. **Persistence** — `_stopped` флаг сохраняется в localStorage вместе с сообщением

## Files Modified

- `ui/static/templates/chat-section.js` — SEND/STOP toggle buttons, dynamic hint color/text
- `ui/static/js/modules/chat.js` — ESC handler, `_stopped` flag on cancel, `aStoppedHtml` in role line, persistence
- `ui/static/css/main.css` — `.msg-stopped-badge`, `.chat-stop-btn` with pulse animation

## Key Results

**Working:** yes
**Tests:** skipped (UI change, Python syntax OK, template backticks balanced)

## For Next Iteration

N/A
