# Last Experiment Summary

**Experiment #154** — Chat STOP button replaces SEND during streaming + ESC shortcut
**Date:** 2026-03-20 17:44:56

## What Was Done

N/A

## Files Modified

- Target:** chat-section.js template, chat.js, main.css
- `ui/static/templates/chat-section.js` — SEND/STOP toggle buttons, dynamic hint
- `ui/static/js/modules/chat.js` — ESC handler, `_stopped` flag, `aStoppedHtml`, persistence
- `ui/static/css/main.css` — `.msg-stopped-badge`, `.chat-stop-btn` pulse animation

## Key Results

Results

**What was done:**
1. **SEND/STOP toggle** — вместо отключённой SEND + отдельного маленького `[X]`, теперь SEND полностью заменяется на STOP кнопку во время стриминга (паттерн ChatGPT/Claude.ai)
2. **STOP button** — красная рамка, текст `[X] STOP`, hover заполняет фон красным, пульсирующая анимация opacity, плавное появление через Alpine transition
3. **ESC shortcut** — Escape останавливает генерацию (высший приоритет среди всех ESC-обработчиков в handleChatKeydown)
4. **`[stopped]` bad

## For Next Iteration

N/A
