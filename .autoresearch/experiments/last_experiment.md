# Last Experiment Summary

**Experiment #133** — Chat — activity sparkline in status bar (token output per response)
**Date:** 2026-03-20

## What Was Done

1. **`renderActivitySparkline(tab)`** — генерирует SVG sparkline: по одному bar на каждое assistant сообщение с msgTokens. Максимум 20 последних bars. Высота bar пропорциональна output tokens относительно максимума. Цвет: green (<33%), cyan (33-66%), amber (66-90%), red (>90%).
2. **Sparkline в status bar** — мини-график вставлен после cost indicator в IDE status bar. Показывается только при 2+ ответах с токенами. Tooltip с общей статистикой.
3. **SVG sparkline** — чистый SVG без зависимостей, width/height динамические, cursor=help с title tooltip.

## Files Modified

- `ui/static/js/modules/chat.js` — renderActivitySparkline() method
- `ui/static/templates/chat-section.js` — sparkline HTML in status bar

## Key Results

- Sparkline появляется в status bar при 2+ ответах с токен-статистикой
- Визуально показывает интенсивность использования API по ответам
- Цвет кодирует относительную нагрузку каждого ответа

## For Next Iteration

N/A
