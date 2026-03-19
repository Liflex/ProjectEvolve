Начинаю эксперимент 47. Сначала прочитаю контекст проекта и текущее состояние файлов.
Первый активный goal — разбить monolith JS (app.js 1916 строк). Посмотрю структуру app.js и CSS.
Теперь у меня полная картина. app.js — 1916 строк монолит. Приступаю к декомпозиции JS по функциональным модулям.

## Experiment 47: JS Architecture — Module Extraction

**Type:** Refactoring
**Goal:** Разбить HTML на составные элементы по функционалу (JS part)
**Target:** app.js (1916 → ~1300 lines)
**Complexity Impact:** +4 files
Создаю директорию для модулей и пишу файлы.
Теперь создаю 4 модуля параллельно:
Now the biggest module — lab (experiments, dashboard, run control, research WebSocket):
Теперь обновляю `app.js` — удаляю извлечённый код и добавляю spread:
Файл большой, перепишу его целиком, удалив извлечённые в модули части: