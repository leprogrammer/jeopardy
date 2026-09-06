# 08: Unit tests (Vitest)

**What to build:** `npm test` runs a Vitest test suite covering the `Players` class and the `Game` state machine. Tests verify scoring arithmetic, Daily Double wager validation and bounds, Final Jeopardy wager floor for players at ≤ $0, state transitions through all game phases, board-control rules (who picks first in each round), and the Daily Double "No Answer" deduction path.

**Blocked by:** 01 (Re-review: core gameplay & audio)

**Status:** ready-for-agent

- [ ] A `package.json` exists with `vitest` as a dev dependency and a `"test"` script (`vitest run`)
- [ ] `npm test` (or `npx vitest`) runs the full suite and exits with a non-zero code on any failure
- [ ] Tests for `Players`: add/remove, score update (including negative), `getWinner` with ties, `isValidCount`, `reset`, `setActivePlayer`/`getActivePlayer`
- [ ] Tests for `Game` — scoring: `markCorrect` adds value, `markIncorrect` subtracts value, score can go negative
- [ ] Tests for `Game` — Daily Double: `getDailyDoubleWagerBounds` returns correct min/max, `setDailyDoubleWager` rejects out-of-range amounts, valid wager transitions to `CLUE_SHOWN`
- [ ] Tests for `Game` — Daily Double "No Answer": active player's wager is deducted, state returns to `BOARD`
- [ ] Tests for `Game` — state transitions: `BOARD → CLUE_SHOWN → ANSWER_SHOWN → BOARD`, `BOARD → DAILY_DOUBLE → CLUE_SHOWN`, `BOARD → FINAL_WAGER → FINAL_CLUE → FINAL_ANSWER → GAME_OVER`
- [ ] Tests for `Game` — board control: Round 1 active player is Player 1; Round 2 active player is highest scorer (Player 1 breaks ties)
- [ ] Tests for `Game` — Final Jeopardy wager: player with positive score can wager 0 to their score; player at ≤ $0 can wager 0 to $1000; `submitFinalWager` rejects out-of-range amounts
- [ ] Tests for `Game` — `markFinalAnswer` awards or deducts wager correctly; auto-transitions to `GAME_OVER` when all players are marked
- [ ] Tests for `Game` — `nextRound` transitions to the next round or to `FINAL_WAGER` when no more rounds remain
- [ ] Tests do not require a browser environment (pure Node/Vitest, no jsdom dependency for logic tests)
