Теперь прочитаю `app.js` более детально — интересуют части, связанные с чатом и аватарами, чтобы понять текущее состояние.
Давайте посмотрим на чат-секцию HTML и серверную часть, чтобы понять данные по токенам.
Давайте посмотрим чат-секцию HTML подробнее, особенно статус-бар и панель токенов.
Теперь у меня есть полная картина. Выбираю эксперимент 43.

## Experiment 43: CHAT по умолчанию + Фикс sidebar Research Lab

**Type:** Improvement  
**Goal:** При открытии показывать CHAT первым; исправить sidebar Research Lab (добавить скроллинг, убрать neural net)  
**Target:** `ui/static/js/app.js` (default section), `ui/static/index.html` (sidebar)  
**Complexity Impact:** 0 файлов

Два изменения из целей #2 и #3:
1. Default section → `chat` вместо `lab`
2. Sidebar Research Lab: добавить `overflow-y-auto` + скрыть organism (neural net)
Теперь проверю JS-синтаксис и что всё загружается корректно.
JS-синтаксис OK. Проверю Python импорты.
Проверю HTML-структуру — что нет незакрытых тегов после удаления organism.
HTML-структура корректна. Также проверю, что нет оставшихся ссылок на `organismSVG` или `organismStage`, которые теперь не будут видны.
Отлично — organism полностью удалён из HTML. Теперь обновлю цели проекта и запишу отчёт.
Цели #2 ("При открытии веб интерфейса первым показывать CHAT") и #3 ("в Research lab для side bar не хватает места... добавить скроллинг и временно убрать neural net") выполнены. Убираю их из списка.
Теперь запишу отчёт эксперимента и обновлю last_experiment.md.
Обновлю accumulation_context.md.
## Experiment Report

**Number:** 43
**Title:** CHAT по умолчанию + Sidebar Fixes
**Type:** Improvement
**Goal:** При открытии показывать CHAT первым; исправить sidebar Research Lab
**Target:** `ui/static/js/app.js`, `ui/static/index.html`
**Complexity Impact:** 0 файлов
**Files Modified:**
- `ui/static/js/app.js` — `section: 'lab'` → `section: 'chat'`
- `ui/static/index.html` — добавлен `overflow-y-auto` к nav sidebar, удалён organism visualizer

### Results

**What was done:**
1. При открытии веб-интерфейса теперь первым показывается CHAT с предложением начать сессию (вместо Research Lab)
2. Sidebar Research Lab получил скроллинг (`overflow-y-auto`) — все пункты меню теперь видны
3. Organism visualizer (neural net) временно убран из sidebar, освободив место для навигации
4. Цели #2 и #3 из `.autoresearch.json` помечены как выполненные и удалены

**Working:** yes
**Tests:** skipped (UI-only changes, JS syntax verified)

### Decision

**Result:** KEEP
**Reason:** Минимальные, целевые изменения. Чат как стартовая страница логичнее для повседневного использования. Sidebar Research Lab больше не обрезает меню.
**Next:** Цель — исправить Research BAR (токены всегда 0) или начать разбивку HTML на компоненты

>>>EXPERIMENT_COMPLETE<<<