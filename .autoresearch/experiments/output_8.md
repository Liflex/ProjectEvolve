Это pre-existing ошибка, не связана с моими изменениями. Серверный код (ui/server.py) импортируется корректно, что подтверждено выше.

---

## Experiment Report

**Number:** 8
**Title:** Smart auto-scroll + scroll-to-bottom button in chat
**Type:** Improvement
**Goal:** Не скроллить чат вниз, когда пользователь читает историю; добавить кнопку для быстрого возврата
**Target:** `ui/static/index.html`
**Complexity Impact:** 0

### Results

**What was done:**
1. **Smart auto-scroll** — добавил `onChatScroll(tab, event)` обработчик на контейнер сообщений. Отслеживает `tab.scrolledUp` (true если пользователь прокрутил выше 100px от низа). `smartScroll(tab)` скроллит только когда `!scrolledUp`.
2. **Scroll-to-bottom FAB** — плавающая кнопка "↓ BOTTOM" появляется когда пользователь прокрутил вверх. Клик скроллит вниз и сбрасывает флаг.
3. **User message always scrolls** — при отправке сообщения `scrolledUp` сбрасывается в false, гарантированный скролл вниз.
4. **Streaming respects scroll position** — `ws.onmessage` использует `smartScroll()` вместо принудительного скролла.

**Working:** yes (server imports OK, HTML balanced, all patterns verified)
**Tests:** skipped (UI-only change)

### Decision

**Result:** KEEP
**Reason:**
1. Реальное UX улучшение — пользователь может читать историю без "дёргания" вниз
2. Минимальное изменение — 3 новых метода (~15 строк), 1 новое свойство tab, 1 HTML элемент
3. 0 новых зависимостей, 0 новых файлов
4. Обратно совместимо — старое поведение (всегда скроллить) сохраняется когда пользователь внизу
5. Complexity Impact: 0

**Next:** Рассмотреть incremental DOM updates в renderChatHTML (текущий подход перестраивает весь HTML на каждый chatTick)

>>>EXPERIMENT_COMPLETE<<<
