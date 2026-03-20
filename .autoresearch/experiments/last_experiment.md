# Last Experiment Summary

**Experiment #137** — Chat — message reference links (#N) with click-to-copy and scroll-to
**Date:** 2026-03-20

## What Was Done

1. **`#N` reference badge** — every user and assistant message shows a clickable `#N` badge in the role line (next to timestamp). Clicking copies the reference to clipboard; if clipboard fails, inserts into chat input.
2. **`linkMsgRefs(html, tabId)`** — new renderer method that converts `#N` patterns in message content to clickable links (protected from modifying code blocks and existing `<a>` tags).
3. **`scrollToMsg(tabId, msgIdx)`** — scrolls to the target message with smooth animation and applies a 2-second purple flash highlight. Auto-switches to the correct tab if needed.
4. **`copyMsgRef(tabId, msgIdx)`** — copies `#N` reference to clipboard with toast notification, fallback to input insertion.
5. **CSS** — `.msg-ref-badge` (small monospace badge), `.msg-ref-link` (cyan dashed underline in content), `.msg-ref-highlight` (keyframe flash animation).

## Files Modified

- `ui/static/js/modules/chat.js` — scrollToMsg(), copyMsgRef(), #N badge in role lines, linkMsgRefs() calls in content rendering
- `ui/static/js/modules/renderer.js` — linkMsgRefs() method
- `ui/static/css/main.css` — .msg-ref-badge, .msg-ref-link, .msg-ref-highlight styles

## Key Results

**What was done:**
- Message references (#N) enable cross-referencing in long conversations
- Click-to-copy on badge, click-to-scroll on in-content links
- Protected from modifying code blocks and existing links
- Smooth scroll with highlight animation

## For Next Iteration

N/A
