Теперь посмотрю текущее состояние UI — особенно тему и рендеринг чата.
Теперь посмотрю секцию настроек и рендеринг чата.
Теперь посмотрю renderChatHTML, чтобы понять текущий рендеринг сообщений.
Отлично, у меня есть полная картина. Анализирую цели и что сделано:

- Exp 20 добавил темы (Synthwave, Darcula, One Dark) с theme-aware syntax highlighting
- Из notes exp 20 осталось: "Font per theme (JetBrains Mono for Darcula)" и "Agent response styling per theme"

## Experiment 21: Theme-specific fonts + Agent chat bubble styling

**Type:** Improvement
**Goal:** "Чат ~ Окно IDE" + "Добавить стилизацию выводимого ответа агента под шаблоны тем"
**Target:** ui/static/index.html
**Complexity Impact:** +0/-0 файлов
Начинаю реализацию. Сначала добавлю шрифты в `<head>`.
Теперь добавлю `font-family` и `font-size` в определения тем.
Теперь обновлю `applyTheme()` для применения шрифтов и font-size.
Теперь обновлю CSS для chat role labels, чтобы использовать `--chat-role-font`, и обновлю рендеринг чата для использования theme-specific CSS variables.
Теперь обновлю `renderChatHTML` чтобы использовать CSS-классы вместо inline-стилей для bubbles.
Теперь нужно также обновить font-size в markdown-рендеринге, чтобы он наследовался от body, а не был хардкод. Посмотрю на md-класс.
Теперь smoke-тесты — проверка HTML баланса и Python импортов.
Всё сбалансировано. Давайте проверим, что хардкодные `rgba(180,74,255,...)` в chat rendering больше не осталось (теперь используем CSS-переменные).
Всё выглядит хорошо. Хардкодные `rgba(180,74,255,...)` в глобальных CSS (glow, nav) — это нормально, они дают synthwave-эстетику для общих элементов. Ключевые chat bubble цвета теперь через CSS-переменные.
Теперь запишу last_experiment и обновлю accumulation context.
Now update the accumulation context.
## Experiment Report

**Number:** 21
**Title:** Theme-specific fonts + Agent chat bubble styling
**Type:** Improvement
**Goal:** "Чат ~ Окно IDE" + "Добавить стилизацию выводимого ответа агента под шаблоны тем"
**Target:** ui/static/index.html
**Complexity Impact:** +0/-0 файлов
**Files Modified:** ui/static/index.html

### Results

**What was done:**
1. **Google Fonts** — добавлены JetBrains Mono и Fira Code (4 шрифта всего: VT323, Press Start 2P, JetBrains Mono, Fira Code)
2. **Font per theme** — Synthwave: VT323 16px, Darcula: JetBrains Mono 13px, One Dark: Fira Code 14px
3. **applyTheme()** — устанавливает `fontFamily`, `fontSize` на body + 5 CSS variables для chat bubbles (`--chat-role-font`, `--chat-user-bg/border`, `--chat-asst-bg/border`)
4. **Chat bubble CSS classes** — `.chat-bubble-user` / `.chat-bubble-asst` с theme-aware стилями вместо хардкода
5. **Markdown font-size: inherit** — `.md` класс наследует от body, темы контролируют размер текста
6. **Chat role font** — Synthwave: Press Start 2P (пиксельный), Darcula/One Dark: моноширинный шрифт темы

**Working:** yes (HTML balanced 240/240 div, 12/12 script, 17/17 template, Python imports OK)
**Tests:** skipped (UI-only change)

### Decision

**Result:** KEEP
**Reason:**
1. Прямой ответ на "Font per theme" и "Agent response styling per theme" из exp 20 notes
2. Каждая тема теперь имеет уникальную типографику — Synthwave (ретро), Darcula (IDE), One Dark (Atom)
3. Chat bubbles адаптируются к теме через CSS variables — Darcula выглядит как JetBrains IDE чат
4. 0 новых файлов, 0 новых зависимостей — только Google Fonts CDN
5. Complexity Impact: 0

**Next:** More themes (Solarized, GitHub Dark, Nord), font size slider in settings, quality trend graphs

>>>EXPERIMENT_COMPLETE<<<