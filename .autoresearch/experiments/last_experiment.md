# Last Experiment Summary

**Experiment #152** — Chat send mode toggle (Enter/Ctrl+Enter to send)
**Date:** 2026-03-20

## What Was Done

1. **`chatSendMode` setting** — добавлена настройка в `settings` (default: 'enter'). Два режима: 'enter' (Enter отправляет, Shift+Enter — newline) и 'ctrlenter' (Ctrl+Enter отправляет, Enter — newline). Сохраняется в localStorage.
2. **`handleChatKeydown` update** — логика отправки теперь проверяет `settings.chatSendMode` и решает, какая комбинация клавиш отправляет сообщение.
3. **Toggle button** — маленькая кнопка в правом нижнем углу инпута (рядом со счётчиком символов). Показывает текущий режим (ENT / CTRL+ENT), клик переключает. Активный режим 'ctrlenter' подсвечивается cyan.
4. **Hint text** — подсказка под инпутом обновляется динамически в зависимости от режима. Также обновлены шорткаты в пустом состоянии (welcome screen).
5. **`toggleSendMode()`** — метод в chat.js, переключает режим и сохраняет в localStorage с toast-уведомлением.

## Files Modified

- `ui/static/js/modules/chat.js` — send mode logic, toggleSendMode()
- `ui/static/templates/chat-section.js` — toggle button UI, dynamic hints
- `ui/static/css/main.css` — .send-mode-toggle styles
- `ui/static/js/app.js` — chatSendMode default in settings

## Key Results

Working. Users who prefer multi-line editing can switch to Ctrl+Enter mode. Default remains Enter-to-send for backward compatibility.

## For Next Iteration

N/A
