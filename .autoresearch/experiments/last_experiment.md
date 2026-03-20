# Last Experiment Summary

**Experiment #150** — Chat image paste with Claude Vision (multimodal content blocks)
**Date:** 2026-03-20 17:23:03

## What Was Done

N/A

## Files Modified

- Target:** chat.js, session.py, server.py, chat-section.js, main.css

## Key Results

Results

**What was done:**
Ранее изображения отправлялись как markdown-текст `![](dataUrl)` внутри строкового prompt — Claude не мог видеть их как картинки, только как base64-строку. Теперь:

1. **Backend `session.py`**: `send()` принимает prompt как `str` или `list` (мультимодальные content blocks). Streaming mode передаёт multimodal content через `_single_message()`.
2. **Backend `server.py`**: WS handler извлекает `images` из сообщения, строит массив `[text_block, image_block, ...]` и переда

## For Next Iteration

N/A
