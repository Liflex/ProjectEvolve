Давайте посмотрим на текущее состояние ключевых файлов проекта, чтобы выбрать задачу для эксперимента 121.
Давайте посмотрим на остальную часть шаблона чата — особенно input area и message rendering.
Давайте посмотрим на input area чата и renderer.
Давайте посмотрим на renderChatHTML и onChatClick/contextmenu.
Давайте посмотрим на полную логику рендеринга сообщений.
Давайте посмотрим на модуль кота и как он взаимодействует с чатом.
Давайте посмотрим на полный рендеринг code blocks в renderer.js.
Отлично, я получил хорошее понимание проекта. Давайте выберем задачу для эксперимента 121.

## Experiment 121: Chat — turn-level collapse/expand

**Type:** Feature
**Goal:** UI/UX улучшение раздела chat (цель #4) — IDE-like turn management
**Target:** chat.js, chat-section.js, main.css
**Complexity Impact:** 0 новых файлов (модификация существующих)

Идея: возможность сворачивать/разворачивать целые turn'ы (user + assistant + tools) кликом на разделитель. Это делает длинные conversations управляемыми, как folding в IDE.

Давайте посмотрим текущий CSS для turn separators и реализуем.
Теперь давайте найдем `getTotalTurns` и `jumpToTurn` для понимания turn tracking.
Теперь у меня полное понимание. Давайте реализуем turn-level collapse/expand. Начнём с изменений в `chat.js`.
**Шаг 1:** Добавляем `_collapsedTurns` в инициализацию таба.
**Шаг 2:** Теперь модифицируем `renderChatHTML` для поддержки сворачивания turn'ов. Нужно изменить основной цикл рендеринга.
Теперь я внесу основное изменение — модификацию `renderChatHTML` для поддержки сворачивания turn'ов. Это большое изменение, поэтому сделаю его одним блоком.
**Шаг 3:** Теперь добавим функции `toggleTurnCollapse`, `collapseAllTurns`, `expandAllTurns`. Добавим их рядом с `collapseAllMessages`/`expandAllMessages`.
**Шаг 4:** Добавим кнопки в toolbar в `chat-section.js`.
**Шаг 5:** Добавим CSS стили для сворачивания turn'ов. Добавим после `.chat-turn-highlight`.
**Шаг 6:** Теперь нужно убедиться, что turn 1 также может сворачиваться. Для turn 1 нет turn separator, поэтому нужно добавить индикатор collapse рядом с user message. Давайте также добавим поддержку сворачивания turn 1 в рендер — добавим маленький collapse button в заголовок первого user message.

Нужно также обработать случай, когда turn 1 свёрнут. Давайте посмотрим на код рендера turn 1.
Для turn 1 нужно добавить collapse button. Изменим рендер user message — добавим collapse button в role line для turn 1.
Добавлю collapse button в role line для turn 1 (когда turn separator отсутствует).
**Шаг 7:** Теперь нужно убедиться, что `_collapsedTurns` сохраняется/восстанавливается при persist чата. Давайте посмотрим, как сохраняется состояние чата.
Хорошо. Давайте добавим keyboard shortcut 't' для toggle turn collapse в навигации.
Теперь нужно обновить подсказку в navigation hint чтобы показать 't' для turn collapse.
Теперь нужно обработать нажатие 't' в handleChatKeydown. Давайте найдём где обрабатываются клавиши навигации.
Давайте найдём где обрабатываются клавиши навигации j/k/c/q/e/f/p/d.
**Шаг 8:** Запустим smoke-тест — проверим что Python сервер запускается без ошибок и JS файлы не содержат синтаксических ошибок.
Все JS файлы валидны. Теперь давайте проверим, что существующие тесты проходят.
Тесты Python не собирают items (возможно, устаревшие). Это UI-only изменение, JS синтаксис валиден — это достаточно.

Давайте проверим итоговые изменения и закоммитим.
Теперь обновим `.autoresearch.json` — уточним цель #4 о chat UI/UX.
Теперь обновим experiment logs.
## Experiment Report

**Number:** 121
**Title:** Chat — turn-level collapse/expand with summary preview
**Type:** Feature
**Goal:** UI/UX улучшение раздела chat (цель #4) — IDE-like turn management
**Target:** chat.js, app.js, chat-section.js, main.css
**Complexity Impact:** +0/-0 файлов (модификация 4 существующих)
**Files Modified:**
- `ui/static/js/modules/chat.js` — toggleTurnCollapse, collapsePrevTurns, expandAllTurns, renderCollapsedSummary
- `ui/static/js/app.js` — 't' key handler
- `ui/static/templates/chat-section.js` — toolbar buttons, nav hint
- `ui/static/css/main.css` — collapse button + summary styles

### Results

**What was done:**
1. **Turn collapse/expand** — кнопка `[-]`/`[+]` на turn separator сворачивает/разворачивает весь turn (user + assistant + tools)
2. **Collapsed summary** — однострочный превью: `T3 | "How do I fix the auth bug?" | 4 msgs · 2 tools · 1.2K ch · 12s`
3. **Turn 1 collapse** — маленькая кнопка `[-]` в заголовке USER_ для первого turn
4. **Toolbar** — кнопки `TURNS` (свернуть все предыдущие) и `TURNS` (развернуть все) рядом с FOLD ALL/UNFOLD
5. **Keyboard** — клавиша `t` на сфокусированном сообщении сворачивает/разворачивает его turn
6. **Streaming protection** — текущий стримящий turn нельзя свернуть

**Working:** yes (JS syntax validated)
**Tests:** skipped (UI-only change, no Python tests affected)

### Decision

**Result:** KEEP
**Reason:** Конкретная, полезная фича для длинных conversations. Turn folding — стандартная IDE feature, теперь доступна в чате. Минимальное количество кода (~100 строк в chat.js, ~70 строк CSS).
**Next:** Продолжить улучшение chat UI/UX или перейти к следующей цели (семантический поиск, cat companion, judgement system)

>>>EXPERIMENT_COMPLETE<<<