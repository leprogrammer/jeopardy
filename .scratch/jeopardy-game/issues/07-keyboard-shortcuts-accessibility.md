# 07: Keyboard shortcuts & accessibility

**What to build:** The game is fully operable from the keyboard. Arrow keys navigate between clue cells on the board, Enter selects a clue, Space/Enter shows the answer or submits a wager, `M` toggles mute, and `Esc` closes any open modal. All interactive elements have `aria-label` attributes. The scoreboard announces score changes to screen readers via `aria-live="polite"`. Focus rings are 3px solid with a 2px offset. Tab order follows the logical flow: Setup → Board → Modals → Scoreboard. `prefers-reduced-motion` is respected — animations are disabled when the user has that preference set.

**Blocked by:** 01 (Re-review: core gameplay & audio)

**Status:** ready-for-agent

- [ ] Arrow keys (left/right/up/down) navigate focus between clue cells on the board grid
- [ ] Enter (or Space) on a focused clue cell opens the clue modal
- [ ] Space or Enter inside the clue modal triggers "Show Answer"
- [ ] Space or Enter in the Daily Double wager input submits the wager
- [ ] `M` toggles the mute state from anywhere in the game (when not typing in an input)
- [ ] `Esc` closes any open modal (clue modal, Daily Double overlay, error modal, resume modal)
- [ ] All interactive elements (buttons, clue cells, player pills, file input, inputs) have a descriptive `aria-label`
- [ ] The scoreboard container has `aria-live="polite"` so score changes are announced
- [ ] Focus ring is `3px solid var(--focus-ring)` with `outline-offset: 2px` on all focusable elements
- [ ] Tab order follows: setup screen elements → board cells → modal controls → scoreboard
- [ ] `prefers-reduced-motion: reduce` disables `slideUp`, `fadeIn`, `cellReveal`, and the round banner animation
- [ ] The app is fully usable at 320px viewport width with no horizontal overflow (`overflow-x: clip` on `html` and `body`)
