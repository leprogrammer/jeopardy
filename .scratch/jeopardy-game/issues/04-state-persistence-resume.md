# 04: State persistence & resume

**What to build:** The full game state is saved to `localStorage` after every meaningful change. On page reload, if a saved game is found, a "Resume Game / New Game" modal appears. "Resume Game" restores the exact board state (round, used clues, scores, active player, Daily Double state, Final Jeopardy progress) and jumps to the correct view. "New Game" clears the saved state and returns to the setup screen. Saved state is also cleared on game over and when the user clicks "Play Again".

**Blocked by:** 01 (Re-review: core gameplay & audio)

**Status:** ready-for-agent

- [ ] A `#resume-modal` overlay exists in the HTML with a prompt, a "Resume Game" button, and a "New Game" button
- [ ] Game state (player list, scores, active player, current round index, used clues map, Daily Double state, Final Jeopardy state, game phase) is serialized to `localStorage` after every state change (score update, clue used, round transition, wager submitted, answer marked)
- [ ] On page load, if a saved state exists in `localStorage`, the resume modal is shown before the setup screen
- [ ] "Resume Game" restores the exact board state and navigates to the correct view (board, clue modal, Daily Double, Final Jeopardy, or game over)
- [ ] "New Game" clears the saved state from `localStorage` and shows the setup screen
- [ ] Saved state is cleared from `localStorage` when the game reaches `GAME_OVER`
- [ ] Saved state is cleared from `localStorage` when the user clicks "Play Again"
- [ ] Resuming a game in the middle of a Daily Double restores the wager overlay with the correct player and bounds
- [ ] Resuming a game during Final Jeopardy restores the correct stage (category, wager inputs, clue, or answer marking)
- [ ] No stale or corrupt state in `localStorage` causes a crash on load — corrupt data is treated as no saved state
