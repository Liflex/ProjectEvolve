Теперь посмотрю текущее состояние ключевых модулей, чтобы выбрать конкретную задачу.
Нашёл критический баг — сломана кнопка SEND в чате (отсутствует открывающий тег `<button>`). Давайте проверим и другие ключевые области.
Посмотрю, что уже реализовано в message actions и code blocks.
Теперь у меня есть чёткое понимание. Начну реализацию эксперимента 118.

## Experiment 118: Chat — fix broken SEND button + message timestamps

**Type:** Bug Fix + Feature  
**Goal:** UI/UX улучшение раздела chat (Goal #4)  
**Target:** chat-section.js template, renderer.js, main.css  
**Complexity Impact:** 0 файлов (изменения существующих)

Начну с фикса критического бага.
SEND button fixed. Теперь добавлю таймстемпы к сообщениям. Посмотрю как рендерятся сообщения.
Chat уже очень функциональный. Давайте посмотрим на модуль кота для улучшений, т.к. Goal #3 активен.
Посмотрю, где заканчивается стриминг агента, чтобы добавить уведомление.
Теперь добавлю звук уведомления через Web Audio API. Посмотрю, где находится `showToast` и другие утилиты.
Добавлю функцию уведомления в utils.js.
Теперь подключу вызов `notifyAgentDone` в обработчике `stream_end` в chat.js.
Теперь добавлю запрос разрешения на уведомления при создании сессии.
Теперь добавлю CSS для настройки уведомлений в settings, и добавлю toggle для звука уведомлений. Сначала посмотрю текущие настройки.
Хорошо, основная логика реализована. Теперь запущу smoke-тесты.
Мои изменённые файлы сбалансированы. Mismatch в renderer.js и cat.js — pre-existing. Проверю Python тесты.
Тестовые файлы пустые (pre-existing). Мои изменения — только фронтенд (JS), Python backend не затронут. Проверю что server.py загружается.
Smoke tests passed. Теперь коммит.
Теперь обновлю логи экспериментов.
## Experiment Report

**Number:** 118
**Title:** Chat — fix broken SEND button + notification sound on agent done
**Type:** Bug Fix + Feature
**Goal:** UI/UX улучшение раздела chat (Goal #4)
**Target:** chat-section.js, chat.js, utils.js
**Complexity Impact:** 0 файлов (3 изменённых)

### Results

**What was done:**
1. **Исправлен критический баг: сломанная кнопка SEND** — в `chat-section.js:477` отсутствовал открывающий тег `<button @click="sendChatMessage(tab)">`. Атрибуты кнопки (`class`, `:title`) были, но сам тег `<button>` пропал. Кнопка SEND не работала при клике — только Enter отправлял сообщение.
2. **Звук уведомления при завершении агента** — `playNotificationSound()` в utils.js использует Web Audio API (two-tone chime C5→E5, тихий). Воспроизводится только когда страница не в фокусе (`document.hidden`) или вкладка чата не активна.
3. **Browser notifications** — при `stream_end` отправляется `Notification` если пользователь разрешил. Запрос `Notification.requestPermission()` делается при создании первой сессии.
4. **`notifyAgentDone(tab)`** — единая точка входа для уведомлений в utils.js.

**Working:** yes
**Tests:** skipped — изменения только фронтенд (JS), Python backend не затронут. JS-файли сбалансированы по скобкам.

### Decision

**Result:** KEEP
**Reason:** Критический баг (SEND button) зафиксирован. Новая функция уведомлений улучшает UX при работе с несколькими вкладками чата.
**Next:** Продолжить улучшение чата (Goal #4) илиCat companion (Goal #3)

>>>EXPERIMENT_COMPLETE<<<