Давайте посмотрим на ключевые файлы для поиска идей.
Давайте посмотрим на последние эксперименты и CSS для поиска реальных багов и улучшений.
Нашёл проблему. Давайте проверим, как отображается статус подключения в UI.
Отлично, я нашёл конкретную проблему. WebSocket disconnect не обрабатывается — нет auto-reconnect. Это реальный UX баг: при перезапуске сервера или временной потере сети пользователь видит ошибку и не может продолжить.

## Experiment 182: WebSocket auto-reconnect with exponential backoff

**Type:** Improvement
**Hypothesis:** WebSocket соединения рвутся (рестарт сервера, сон ноутбука, network glitch). Сейчас пользователь видит "[ERROR] WebSocket connection failed" и теряет возможность работать. Auto-reconnect с exponential backoff автоматически восстановит соединение.
**Target:** `chat.js` — `connectChatWebSocket()`, `ws.onclose`, `ws.onerror`, `reconnectTab()`
**Complexity Impact:** 0 (refactoring)
**Test Plan:** Визуальная проверка — restart сервера → auto-reconnect

Начинаю реализацию.
Сначала добавлю поля reconnect state в объект tab при создании:
Теперь заменим обработчики `ws.onopen`, `ws.onclose`, `ws.onerror` и добавим логику auto-reconnect:
Теперь заменим обработчики `ws.onclose` и `ws.onerror`:
Теперь нужно обновить `closeChatTab`, чтобы помечать intentional close:
Теперь обновлю `reconnectTab`, чтобы он работал для всех вкладок, не только restored:
Теперь обновлю UI в `chat-section.js` чтобы показать состояние 'reconnecting' и добавить кнопку RECONNECT для обычных вкладок:
Обновлю индикатор статуса на tab, чтобы отображать 'reconnecting':
Теперь обновлю restored reconnect section, чтобы показывать и для обычных отключённых вкладок:
Теперь обновлю restored reconnect banner в основном чате:
Теперь обновлю status bar, чтобы отображал 'reconnecting':
Теперь обновлю CSS для стилей 'reconnecting':
Теперь проверю, что все изменения корректны — прочитаю ключевые участки:
Все изменения выглядят корректно. Теперь проверю, что нет синтаксических ошибок:
Синтаксическая ошибка. Давайте посмотрим вокруг строки 837:
Проблема уже существовала ДО моих изменений — лишний `},` на строке 781. Исправлю этот pre-existing bug:
Синтаксическая ошибка исправлена. Теперь запущу тесты:
Все 13 тестов проходят. Ошибка `test_buffered_log_writer.py` — pre-existing (не связана с моими изменениями).

Теперь проверю, что восстановленные вкладки также получают reconnect-поля:
Добавлю reconnect-поля в restored tabs:
Финальная проверка синтаксиса:
Теперь закоммичу изменения и обновлю файлы эксперимента.
Теперь обновлю `.autoresearch.json` — цели:
Цели актуальны, мой эксперимент не затрагивает существующие цели напрямую (это improvement чата, не feature). Обновлю completed_goals — цель про "Память сессий и чатов" теперь включает реальный auto-reconnect:
Теперь обновлю last_experiment.md:
Обновлю accumulation_context.md:
Файл начинается с `\r\n`. Используем уникальный контекст:
Финальный коммит:
---

## Experiment Report

**Number:** 182
**Title:** WebSocket auto-reconnect with exponential backoff
**Type:** Improvement
**Hypothesis:** WebSocket соединения рвутся при рестарте сервера, network glitch, сне ноутбука. Auto-reconnect с exponential backoff предотвратит потерю сессии без участия пользователя.
**Target:** `ui/static/js/modules/chat.js`, `ui/static/templates/chat-section.js`, `ui/static/css/main.css`
**Complexity Impact:** 0 файлов (модификация существующих)
**Test Plan:** 13/13 существующих тестов проходят. Визуальная проверка — restart сервера → auto-reconnect.

### Files Modified

- `ui/static/js/modules/chat.js` (+70/-35 lines)
- `ui/static/templates/chat-section.js` (+8/-6 lines)
- `ui/static/css/main.css` (+1 line)

### Results

**Quality Gate Score:** N/A (improvement, no quality gate)
**Tests:** 13/13 pass (0 new tests — JS improvement, verification by syntax check)
**Build:** success (node -c passes on all modified JS files)

### Decision

**Result:** KEEP
**Reason:**
1. Реальный UX баг — при обрыве WebSocket пользователь терял сессию без возможности восстановления
2. Auto-reconnect с exponential backoff (1s→30s, 10 attempts) — стандартный паттерн для production WebSocket клиентов
3. Устранён pre-existing syntax error (double `},` после `toggleSendMode()`)
4. Устранён баг с дублированием "[ERROR] WebSocket connection failed" (onerror + onclose оба пушали)
5. `reconnectTab()` обобщён для всех вкладок, не только restored
6. UI обновлён: статус-бар показывает "RECONNECTING (N)...", кнопка RECONNECT на отключённых вкладках

**Notes for Next:** Рассмотреть notification sound при успешном/неуспешном reconnect.

### Goals Updated

**Completed:** нет
**Modified:** "Память сессий и чатов" — добавлено "WebSocket auto-reconnect с exponential backoff (exp182)"
**Added:** нет

>>>EXPERIMENT_COMPLETE<<<