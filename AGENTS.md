# Agent Guide — Bikini Bottom Jeopardy

A fully client-side Jeopardy! game built with vanilla HTML, CSS, and JavaScript (ES modules).
No frameworks, no build step. Themed with the **Bikini Bottom** nautical aesthetic.

---

## Project overview

| Item | Detail |
|---|---|
| **Entry point** | `index.html` — single-page app |
| **Dev server** | `node server.js` → `http://localhost:3000` |
| **Tests** | `npm test` (Vitest, ES-module native) |
| **External runtime dep** | DOMPurify via CDN (XSS sanitization only) |
| **State persistence** | `localStorage` (full game state) |
| **Offline** | Service Worker in `sw.js` |

---

## File map

```
index.html              Single-page app shell; all views rendered here
sw.js                   Service Worker — cache-first offline strategy
css/
  style.css             All styling: Bikini Bottom tokens, grid, modals, responsive
js/
  app.js                Orchestrator: JSON normalization, setup, state routing, view switching
  game.js               Core state machine (GameState enum + Game class)
  board.js              DOM rendering: board grid, modals, Daily Double, Final Jeopardy, Game Over
  audio.js              Web Audio API synthesized sound effects (AudioManager class)
  players.js            Player roster, scores, active player, winner/tie logic (Players class)
data/
  questions.json        Default question set (2 rounds + Final Jeopardy, includes image & video clues)
  buckets.mp4           Sample video asset
tests/
  game.test.js          Unit tests — Game state machine
  players.test.js       Unit tests — Players class
docs/
  implementation_plan.md  Full architectural spec, CSS tokens, JS API contracts, HTML ID contract
server.js               Zero-dependency Node static dev server (port 3000, range-request support)
package.json            { "type": "module", scripts: { start, test }, devDependencies: { vitest } }
```

---

## Architecture

### Module responsibilities

| Module | Exports | Responsibility |
|---|---|---|
| `js/players.js` | `Players` | Add/remove players, score updates, active player, scoreboard, winner/tie detection |
| `js/game.js` | `Game`, `GameState` | State machine: clue selection, scoring, Daily Double wagers, round/FJ flow |
| `js/board.js` | `Board` | All DOM mutations: grid render, modal show/hide, scoreboard, round banners |
| `js/audio.js` | `AudioManager` | Lazy-init Web Audio API; synthesized SFX; mute toggle |
| `js/app.js` | *(side effects)* | Wires everything: JSON load + normalize, setup UI, `game.onStateChange` routing |

### State machine (`GameState`)

```
SETUP → BOARD → CLUE_SHOWN → ANSWER_SHOWN → BOARD
              ↘ DAILY_DOUBLE → CLUE_SHOWN
        BOARD → FINAL_WAGER → FINAL_CLUE → FINAL_ANSWER → GAME_OVER
```

Full transition table is in [`docs/implementation_plan.md`](docs/implementation_plan.md#State-Machine-Flow).

---

## Development commands

```bash
node server.js        # Start dev server on :3000
npm test              # Run Vitest unit tests
npx vitest --watch    # Watch mode
```

> **Important**: The game fetches `data/questions.json` via `fetch()`, so it must be served over
> HTTP — opening `index.html` directly with `file://` will fail due to CORS.

---

## Key conventions

### View toggling
Use the `.hidden` CSS class (`display: none !important`) to show/hide views. **Never** use
`element.style.display` directly — it conflicts with the `!important` rule.

### HTML ID contract
All JS modules reference a fixed set of IDs/classes defined in `index.html`. Do not rename them
without updating all JS modules. Full contract in [`docs/implementation_plan.md`](docs/implementation_plan.md#HTML-Structure--Element-ID-Contract).

### JSON formats
The app accepts two JSON shapes for question data:
- **Format A** (`rounds` array) — canonical; used by `data/questions.json`
- **Format B** (`round1`/`round2` keys) — auto-normalized in `app.js` on load

Both `isDailyDouble` and `dailyDouble` field names are accepted on clues.

### Security
All JSON-derived content (questions, answers, category names) is passed through
`DOMPurify.sanitize()` before any `innerHTML` assignment. Player names and wager inputs
use `textContent` only.

### CSS design tokens
Colors use `oklch()`. Core palette: `--sponge-yellow` (primary), `--patrick-coral` (incorrect/destructive),
`--kelp-green` (correct), `--jellyfish-teal` (category headers), `--tiki-brass` (borders).
Full token set in [`docs/implementation_plan.md`](docs/implementation_plan.md#Design-Tokens).

## Domain docs

- Architecture & full spec: [`docs/implementation_plan.md`](docs/implementation_plan.md)
