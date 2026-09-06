# 01: Re-review: core gameplay & audio

**What to build:** A full pass through the implemented game confirming every behavior still matches the plan. Play a complete game — setup through board rendering, clue modal, scoring, Daily Double, round transitions, Double Jeopardy, Final Jeopardy, game over, and all audio cues. Any regressions found are fixed so the checklist passes cleanly.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Board renders categories × clue values correctly at any grid size; clicking a clue opens the modal with question text
- [ ] "Show Answer" reveals the answer and player evaluation controls
- [ ] Correct answer awards points, sets board control, returns to board
- [ ] Incorrect answer deducts points; other players can still answer (normal clue); Daily Double returns to board immediately
- [ ] "No Answer" on a normal clue returns to board with no score change; last active player retains control
- [ ] Daily Double shows wager overlay; wager validated to $5…max(score, highest board value) with inline error
- [ ] Daily Double "No Answer" deducts the active player's wager and reveals the answer
- [ ] Round completes when all clues are used; "Next Round" action appears
- [ ] Round transition shows brief full-screen banner
- [ ] Double Jeopardy starts with highest-scoring player as active (Player 1 breaks ties)
- [ ] Final Jeopardy flow: category → wagers → question → think music → answer marking → game over
- [ ] Players with positive scores wager 0 to their score; players at ≤ $0 wager 0 to $1000
- [ ] Game Over shows winner(s) with trophy and final-scores table; ties shown as co-winners
- [ ] "Play Again" returns to setup screen
- [ ] Audio cues fire: fanfare (start), Daily Double arpeggio, correct chime, incorrect buzz, FJ think music start/stop
- [ ] Mute button toggles all audio and switches SVG icons
