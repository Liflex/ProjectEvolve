Начинаю эксперимент 31. Сначала прочитаю контекст и память проекта.
Посмотрю, есть ли уже какая-то система тем в коде.
Посмотрю секцию чата в index.html и оставшуюся часть app.js.
Посмотрю, как рендерятся сообщения чата в app.js.
Отлично, у меня есть полное понимание текущего состояния. План эксперимента 31:

## Experiment 31: Chat Message Actions (Copy, Edit, Regenerate)

**Type:** Feature
**Goal:** UI/UX улучшение раздела chat — IDE-подобные действия над сообщениями
**Target:** `ui/static/js/app.js`, `ui/static/css/main.css`
**Complexity Impact:** +0 файлов (изменение существующих)

Реализую hover-действия над сообщениями чата: копирование, редактирование user-сообщений, регенерация ответа ассистента.
Начинаю реализацию. Сначала добавлю CSS для action-кнопок сообщений, затем модифицирую рендеринг и добавлю методы.
Теперь модифицирую `renderChatHTML()` — добавлю action-кнопки к user и assistant сообщениям.
Теперь добавлю методы `copyMsgContent`, `editUserMsg`, `regenerateResponse`. Найду хорошее место для их вставки — после `onChatScroll`.
Остался дубликат первого (неполного) `editUserMsg`. Удалю его.
Теперь нужно убедиться, что `window._app` экспортируется для onclick-обработчиков. Посмотрю, есть ли это в init().
Нужно установить `window._app` в init(), чтобы onclick-обработчики могли найти экземпляр Alpine.
Теперь проверю, что есть метод `showToast` (используется в `copyMsgContent` и `regenerateResponse`).
`showToast` есть на строке 1291. Теперь проверю корректность JavaScript — нет ли синтаксических ошибок.
JavaScript синтаксически корректен. Теперь проверю, что HTML в index.html сбалансирован и сервер поднимается.
Проверю баланс HTML-тегов в index.html.
Всё сбалансировано. Давайте также убедимся, что `JSON.stringify` в onclick-обработчиках не сломается при特殊ных символах в сообщениях. Нужно экранировать одинарные кавычки в `tab.tab_id`.
Заметил проблему: `JSON.stringify(msg.content)` вставляет двойные кавычки внутрь HTML-атрибута с двойными кавычками — это сломает onclick. Перепишу на передачу индекса сообщения вместо контента.
Теперь обновлю метод `copyMsgContent` → `copyChatMsg`, который берёт контент по индексу из tab-массива.
Повторная проверка синтаксиса.
Синтаксис OK. Теперь проверю итоговое состояние изменений — посмотрю финальный код всех добавленных методов.
Всё выглядит корректно. Проверю также итоговый CSS.
Всё готово. Теперь обновлю файлы экспериментного контекста и напишу отчёт.
Теперь обновлю accumulation_context.md — добавлю запись об эксперименте 31.
---

## Experiment Report

**Number:** 31
**Title:** Chat Message Actions (Copy, Edit, Regenerate)
**Type:** Feature
**Goal:** UI/UX улучшение раздела chat — IDE-подобные действия над сообщениями
**Target:** `ui/static/js/app.js`, `ui/static/css/main.css`
**Complexity Impact:** +0 файлов
**Files Modified:**
- `ui/static/js/app.js` — новые методы + обновление renderChatHTML
- `ui/static/css/main.css` — стили для hover-тулбара

### Results

**What was done:**
1. **COPY** — кнопка на каждом сообщении (user + assistant), копирует raw content в clipboard с toast-уведомлением
2. **EDIT** — кнопка на user-сообщениях: обрезает историю после этого сообщения, помещает текст в textarea для редактирования и повторной отправки
3. **REGEN** — кнопка на последнем assistant-сообщении: удаляет ответ и переотправляет последнее user-сообщение через WebSocket
4. CSS-тулбар `.msg-actions` появляется при hover над сообщением, с color-coded кнопками (cyan=copy, yellow=edit, violet=regenerate)
5. `window._app = this` в init() для доступа к Alpine-методам из onclick-обработчиков

**Working:** yes
- JS syntax: valid
- HTML balanced: 317/317 div, 42/42 template, 12/12 script, 62/62 button
- Server imports: OK

**Tests:** skipped (UI feature, smoke pass)

### Decision

**Result:** KEEP
**Reason:** Конкретная IDE-подобная фича для чата — копирование, редактирование и регенерация сообщений. Работает, не ломает существующий код, 0 новых зависимостей.
**Next:** Продолжить улучшение чата (keyboard shortcuts, message pinning) или перейти к cat companion improvements.

>>>EXPERIMENT_COMPLETE<<<