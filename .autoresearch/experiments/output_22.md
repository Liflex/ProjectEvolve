Начинаю эксперимент 22. Сначала прочитаю контекст проекта и текущее состояние UI.
Файл HTML очень большой. Давайте посмотрим на ключевые секции — чат, настройки и текущую структуру модулей.
Давайте найдём ключевые секции в HTML — чат, настройки, навигацию и темы.
Теперь посмотрю секции настроек, чата и тем подробнее.
Теперь посмотрю API и серверную часть, чтобы понять какие данные доступны о сессиях.
Нужно найти где заканчивается секция чата и где расположены геттеры.
Отлично, теперь у меня полная картина. Вот мой план:

## Experiment 22: IDE-style Chat Status Bar + Tab Activity Indicators

**Type:** Feature
**Goal:** "UI/UX улучшение раздела chat" + "Чат ~ Окно IDE Для работы с агентом"
**Target:** `ui/static/index.html` — chat tabs, status bar
**Complexity Impact:** 0 файлов

Что делаю:
1. Пульсирующий индикатор активности в табах чата (streaming = cyan pulse)
2. Счётчик сообщений в табах
3. IDE-style статус-бар внизу чата (connection, agent state, tokens, messages, cost)
4. Свойство `ws_state` на табах для отслеживания состояния WebSocket

Приступаю к реализации.
Теперь добавлю `ws_state` в создание таба и обновление в ws callbacks.
Теперь обновлю ws callbacks чтобы устанавливать `ws_state`.
Теперь добавлю `activeTab` getter.
Теперь добавлю CSS для статус-бара. Найду хорошее место в секции `<style>`.
Теперь добавлю HTML статус-бара. Вставлю его после закрытия tab content wrapper и перед модалами.
Теперь проверю что всё корректно — прочитаю изменённые секции.
Таб кнопка выглядит правильно. Теперь проверю статус-бар полностью.
Всё выглядит корректно. Теперь проверю что `activeTab` getter на месте.
Отлично. Теперь проверю CSS.
Все изменения на месте. Теперь запущу smoke-тест — проверю что Python может загрузить серверный модуль без ошибок.
Все проверки прошли. Div-теги сбалансированы (243/243), серверный модуль загружается без ошибок.

Теперь обновлю экспериментные файлы — last_experiment.md и accumulation_context.md.
Теперь обновлю accumulation_context.md.
Эксперимент завершён. Вот отчёт:

## Experiment Report

**Number:** 22
**Title:** IDE-style Chat Status Bar + Tab Activity Indicators
**Type:** Feature
**Goal:** UI/UX улучшение раздела chat → "Чат ~ Окно IDE"
**Target:** `ui/static/index.html`
**Complexity Impact:** 0 файлов
**Files Modified:** `ui/static/index.html`

### Results

**What was done:**
1. **Индикатор активности в табах** — цвет точки теперь отражает состояние: зелёный=connected, amber pulse=connecting, cyan pulse=streaming, серый=disconnected
2. **Счётчик сообщений** — маленький бейдж с количеством сообщений в каждом табе
3. **IDE-style статус-бар** — тонкая панель 24px внизу чата с: статус подключения, путь к проекту, состояние агента (IDLE/THINKING.../STREAMING...), кол-во сообщений, токены (IN/OUT в K), стоимость ($)
4. **Отслеживание ws_state** — свойство на каждом табе, обновляемое в ws.onopen/onclose/onerror
5. **activeTab getter** — computed property для реактивного доступа к активному табу

**Working:** yes
**Tests:** smoke (server import + HTML structure validation, div tags 243/243 balanced)

### Decision

**Result:** KEEP
**Reason:** Конкретное визуальное улучшение чата к цели "IDE-style chat". Минимальное изменение (0 новых файлов), только CSS + HTML + JS в index.html. Status bar дает пользователю полную информацию о состоянии сессии в одном glance.
**Next:**可以考虑 keyboard shortcut hints в статус-баре, agent activity details требует backend changes

>>>EXPERIMENT_COMPLETE<<<