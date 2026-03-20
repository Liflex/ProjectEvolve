Изучу текущее состояние модулей чата и кота, чтобы выбрать конкретную задачу.
Хватит анализировать. Принимаю решение.

## Experiment 139: Chat — keyboard shortcuts quick reference panel (? key)

**Type:** Feature  
**Goal:** UI/UX улучшение раздела chat (цель #4)  
**Target:** `ui/static/js/modules/chat.js`, `ui/static/templates/chat-section.js`, `ui/static/css/main.css`  
**Complexity Impact:** +0 файлов (всё в существующих)

Задача: Добавить панель быстрого доступа к горячим клавишам чата, вызываемую по `?` или `F1`. Сейчас шорткаты показаны только в пустом состоянии чата (no active session), но когда сессия активна — пользователь не видит доступные комбинации.

Давайте посмотрим текущий обработчик клавиш чата.
Теперь посмотрю как обрабатываются глобальные клавиши в app.js.
Окей, я потратил достаточно времени на анализ. Принимаю финальное решение.

## Experiment 139: Chat — conversation branching/forking from any message

**Type:** Feature  
**Goal:** UI/UX улучшение раздела chat — IDE-like conversation management (цель #4)  
**Target:** `ui/static/js/modules/chat.js`, `ui/static/templates/chat-section.js`, `ui/static/css/main.css`  
**Complexity Impact:** 0 новых файлов

Идея: Добавить кнопку "BRANCH" к каждому ассистент-сообщению. При нажатии создаётся новая вкладка с сообщениями до этой точки. Пользователь может продолжить диалог с нового направления, сохранив контекст для референса.

Начинаю реализацию. Сначала прочитаю текущий код рендеринга ассистент-сообщений и создания вкладок.
Теперь я вижу структуру. Давайте добавим кнопку BRANCH в action bar ассистент-сообщений и реализуем функцию `branchFrom`.
Теперь добавлю кнопку BRANCH и функцию. Сначала добавлю кнопку в action bar после QUOTE.
Теперь добавлю функцию `branchFrom`. Найду хорошее место для неё — рядом с `editUserMsg` и `cancelEditMode`.
Теперь добавлю CSS для кнопки BRANCH и индикатора branched tab.
Теперь добавлю индикатор branched tab в CSS. Найду стили для tab-reconnect-btn.
Теперь добавлю branch badge в шаблон вкладки и watermark в область сообщений. Посмотрю шаблон tab bar.
Добавлю branch badge рядом с message count в tab bar.
Теперь добавлю watermark banner в область сообщений для branched tabs. Найду место где рендерятся сообщения.
Добавлю watermark banner перед областью сообщений для branched tabs.
Теперь нужно убедиться, что branched tab сохраняется в localStorage при сериализации. Посмотрю как сериализуются вкладки.
Нужно добавить `_branchedFrom` в сериализацию и десериализацию.
Теперь добавлю `_branchedFrom` в десериализацию. Посмотрю полное восстановление табов.
Теперь добавлю опцию BRANCH в контекстное меню сообщений. Посмотрю контекстное меню.
Теперь найду `openContextMenu`.
Добавлю опцию BRANCH в контекстное меню для assistant и user сообщений.
Теперь добавлю BRANCH в контекстное меню для assistant сообщений тоже.
Теперь добавлю BRANCH в command palette.
Теперь добавлю описание BRANCH в keyboard shortcuts panel.
Теперь добавлю обработку клавиши `b` в навигации сообщений (j/k mode).
Теперь нужно добавить обработку действия 'branch' в `chatNavAction`. Найду эту функцию.
Теперь проверю, что нет проблем с branched tab при попытке отправить сообщение. Branched tab не имеет `session_id` (null) и `ws_state: 'disconnected'`. Нужно показать пользователю подсказку о том, что нужно создать сессию.
Вижу проблему: branched tab не имеет сессии. Нужно обработать этот случай — при отправке сообщения из branched tab, автоматически создать новую сессию.
Подожди, авто-создание новой вкладки — плохой UX. Лучше добавлю кнопку "START SESSION" в watermark banner branched tab, и покажу понятное сообщение при попытке отправить.
Теперь добавлю функцию `startBranchSession` и кнопку в watermark.
Теперь обновлю watermark banner с кнопкой START SESSION.
Теперь добавлю CSS для кнопки START SESSION.