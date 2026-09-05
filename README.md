# Jeopardy! — Custom Game

A fully client-side **Jeopardy!** game. No frameworks, no build step, no dependencies — just HTML, CSS, and modern JavaScript (ES modules). Load your own questions from a JSON file and run classic **Jeopardy! → Double Jeopardy! → Final Jeopardy!** rounds for **2 to 10 players**.

## Features

- **Custom question data** — load any questions JSON (drag & drop a file, or upload). A sample board ships in [`data/questions.json`](data/questions.json).
- **2–10 players** — add, remove, and score players on the setup screen.
- **Classic three-round flow** — Jeopardy!, Double Jeopardy!, and Final Jeopardy!, with automatic round transitions and game-over screen.
- **Host mode** — after a clue is revealed, the host clicks the player who answered, then marks the response **Correct** or **Incorrect**. Score updates are applied automatically.
- **Daily Double support** — any clue can be flagged as a Daily Double in your data; the game pauses for a wager before revealing the answer.
- **Final Jeopardy wagers** — each player wagers (including "all-in"), then answers; the game auto-advances to game over.
- **Synthesized audio** — sound effects (Daily Double sting, correct/incorrect, final-Jeopardy think music, fanfare) generated with the Web Audio API — **no audio files required**. A mute toggle is provided.
- **Scoreboard & tie handling** — live scoreboard, plus tie detection with a tiebreak prompt.
- **Responsive, SpongeBob-themed UI** — custom Bikini Bottom nautical aesthetic featuring lagoon blues, sunny sponge yellow accents, Patrick coral, and tiki brass porthole styling.

## How to run

The game loads `data/questions.json` via `fetch()`, so it needs to be served over HTTP (opening `index.html` directly with `file://` will be blocked by the browser's CORS policy for local fetches).

Any static file server works:

```bash
# Option 1 — Python
python -m http.server 8000
# then open http://localhost:8000

# Option 2 — Node
npx serve .
# or
npx http-server -p 8000

# Option 3 — VS Code "Live Server" extension
# right-click index.html → "Open with Live Server"
```

Then open the shown URL in a modern desktop browser.

## How to play

1. **Setup** — add player names (2–10), then either load your own questions JSON or use the default sample. Click **Start Game**.
2. **Board** — the host clicks any clue. The clue is shown.
3. **Answer** — the host clicks the player who answered (the "pill"), then clicks **Correct** or **Incorrect**. Use **No Answer** if nobody buzzed in.
4. **Daily Double** — if the clue is a Daily Double, players must wager first (with "All-in" and "Minimum" shortcuts), then answer.
5. **Round complete** — once every clue in a round is used, **Next Round** appears and advances to the next round (or Final Jeopardy).
6. **Final Jeopardy** — reveal the category, have each player wager, reveal the clue, then mark each player's answer. The game ends and shows the winner.
7. **Play again** — keep the same players or go back to a full setup.

## Question data format

The canonical format (**Format A**) is:

```json
{
  "rounds": [
    {
      "name": "Jeopardy",
      "categories": [
        {
          "name": "Science",
          "clues": [
            {
              "value": 200,
              "question": "This force keeps planets in orbit around the Sun.",
              "answer": "What is gravity?",
              "isDailyDouble": false
            }
          ]
        }
      ]
    }
  ],
  "finalJeopardy": {
    "category": "American Government",
    "question": "This 1803 decision established judicial review...",
    "answer": "What is Marbury v. Madison?"
  }
}
```

Field reference:

| Field | Type | Notes |
| --- | --- | --- |
| `rounds` | array | One entry per round (typically 2: Jeopardy!, Double Jeopardy!). |
| `rounds[].name` | string | Round title shown in the header. |
| `rounds[].categories` | array | 1–8 categories (columns). |
| `categories[].name` | string | Category title shown above the column. |
| `categories[].clues` | array | 1–5 clues (rows), in board order (top→bottom = increasing value). |
| `clues[].value` | number | Dollar value (e.g. `200`, `400`). |
| `clues[].question` | string | The clue text. |
| `clues[].answer` | string | Acceptable response (usually a "What is …?" response). |
| `clues[].isDailyDouble` | boolean | Optional. `true` makes this clue a Daily Double. |
| `finalJeopardy` | object | `category`, `question`, `answer`. |

### Alternate format (Format B)

For convenience, the app also accepts a flatter shape and normalizes it automatically:

```json
{
  "round1": { "categories": [ ... ] },
  "round2": { "categories": [ ... ] },
  "final":  { "category": "...", "question": "...", "answer": "..." }
}
```

`round1`/`round2` map to rounds named "Jeopardy" / "Double Jeopardy", and `final` maps to `finalJeopardy`. The `dailyDouble` (boolean) and `isDailyDouble` (boolean) spellings are both accepted on a clue.

See [`implementation_plan.md`](implementation_plan.md) for the full specification.

## Project structure

```
jeopardy/
├── index.html              # Single page: setup, board, modals, overlays
├── css/
│   └── style.css           # Knicks-themed styling, board grid, modals, responsive layout
├── js/
│   ├── app.js              # Entry point: wires DOM to game logic, state routing, setup/upload
│   ├── game.js             # Game state machine: rounds, clues, scoring, Daily Double, Final Jeopardy
│   ├── board.js            # Board + modal rendering and view switching
│   ├── audio.js            # Web Audio API sound effects (no audio files)
│   └── players.js          # Player roster, scores, active player, winner/tie logic
└── data/
    └── questions.json      # Sample question set (2 rounds + Final Jeopardy)
```

## Tech

- **Vanilla JavaScript** with ES modules (`<script type="module">`) — no bundler.
- **Web Audio API** for all sound.
- **CSS Grid + custom properties** for the responsive board.
- **`fetch()`** to load the default question set; **`FileReader`** for user-uploaded files.

## Attribution

Question content in the sample data is original placeholder material for demonstration. This is a fan-made, non-commercial implementation for personal/educational use.
