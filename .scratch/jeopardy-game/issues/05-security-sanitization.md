# 05: Security: sanitization

**What to build:** All JSON-derived text (question, answer, category name) and media URLs (image, video) are sanitized with DOMPurify before being inserted into the DOM. Player names and wager inputs use `textContent` directly. A maliciously crafted question file cannot execute script in the user's browser.

**Blocked by:** 02 (Media clues: image & video)

**Status:** ready-for-agent

- [ ] DOMPurify is loaded via a CDN `<script>` tag in `index.html`
- [ ] `DOMPurify.sanitize()` is applied to question, answer, and category name text before `innerHTML` insertion in the clue modal
- [ ] `DOMPurify.sanitize()` is applied to `image` URLs and `video` URLs before they are set as `src` or embedded
- [ ] Final Jeopardy category, question, and answer text are sanitized before rendering
- [ ] Player names are set via `textContent`, not `innerHTML`, throughout the app (scoreboard, player pills, Final Jeopardy wager list, game over)
- [ ] Wager input values are treated as numbers only — never rendered as HTML
- [ ] A test question file containing `<script>alert(1)</script>` in a question or answer does not execute when the clue is displayed
- [ ] The app does not break if DOMPurify fails to load from the CDN (graceful fallback to `textContent` or a user warning)
