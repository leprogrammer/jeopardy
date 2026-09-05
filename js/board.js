// ============================================================
// board.js — UI rendering
// ============================================================

import { GameState } from './game.js';

export class Board {
  /**
   * @param {import('./game.js').Game} game
   * @param {import('./players.js').Players} players
   * @param {import('./audio.js').AudioManager} audio
   */
  constructor(game, players, audio) {
    this._game = game;
    this._players = players;
    this._audio = audio;
  }

  _el(id) { return document.getElementById(id); }

  /** @returns {object|null} the most recently selected clue */
  get lastClue() { return this._lastClue || null; }

  // ============================================================
  // BOARD
  // ============================================================

  /** Build the grid in #board-grid and set --num-categories. */
  renderBoard() {
    const round = this._game.getCurrentRound();
    if (!round) return;
    const grid = this._el('board-grid');
    grid.innerHTML = '';

    const numCats = round.categories.length;
    grid.style.setProperty('--num-categories', String(numCats));

    const frag = document.createDocumentFragment();

    // Row 1: category names
    for (const cat of round.categories) {
      const cell = document.createElement('div');
      cell.className = 'category-cell';
      cell.textContent = cat.name;
      frag.appendChild(cell);
    }

    // Remaining rows: one row per clue depth
    const maxClues = Math.max(...round.categories.map(c => c.clues.length));
    for (let row = 0; row < maxClues; row++) {
      round.categories.forEach((cat, catIndex) => {
        const clue = cat.clues[row];
        const cell = document.createElement('div');
        cell.className = 'clue-cell';
        cell.dataset.cat = String(catIndex);
        cell.dataset.clue = String(row);
        if (clue) {
          cell.textContent = '$' + clue.value;
          if (this._game.isClueUsed(catIndex, row)) {
            cell.classList.add('used');
          } else {
            cell.addEventListener('click', () => this._onCellClick(catIndex, row));
          }
        } else {
          cell.style.visibility = 'hidden';
        }
        frag.appendChild(cell);
      });
    }

    grid.appendChild(frag);
    this.updateRoundTitle(round.name);
  }

  _onCellClick(catIndex, clueIndex) {
    const clue = this._game.selectClue(catIndex, clueIndex);
    this._lastClue = clue;
    this.markCellUsed(catIndex, clueIndex);
    if (clue.isDailyDouble) {
      const active = this._players.getActivePlayer();
      this._audio.playDailyDouble();
      this.showDailyDouble(clue, clue.categoryName, active);
    } else {
      this.showClueModal(clue, clue.categoryName);
    }
  }

  /** Update the round title banner. @param {string} roundName */
  updateRoundTitle(roundName) {
    this._el('round-title').textContent = roundName;
  }

  /**
   * Add .used to a cell and remove its click handler.
   */
  markCellUsed(catIndex, clueIndex) {
    const grid = this._el('board-grid');
    const cell = grid.querySelector(`.clue-cell[data-cat="${catIndex}"][data-clue="${clueIndex}"]`);
    if (cell) {
      cell.classList.add('used');
    }
  }

  /**
   * Full-screen round transition banner, auto-dismiss after 2s.
   * @param {string} roundName
   */
  showRoundTransition(roundName) {
    const banner = document.createElement('div');
    banner.className = 'round-banner';
    const text = document.createElement('div');
    text.className = 'banner-text';
    text.textContent = roundName;
    banner.appendChild(text);
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2000);
  }

  // ============================================================
  // SCOREBOARD
  // ============================================================

  /** Update #scoreboard with player cards. */
  renderScoreboard() {
    const sb = this._el('scoreboard');
    sb.innerHTML = '';
    const activeId = this._players.getActivePlayer()?.id;
    const players = this._players.getPlayers();
    for (const p of players) {
      const card = document.createElement('div');
      card.className = 'player-card' + (p.id === activeId ? ' active' : '');
      card.dataset.playerId = String(p.id);

      const name = document.createElement('div');
      name.className = 'player-name';
      name.textContent = p.name;

      const score = document.createElement('div');
      score.className = 'player-score' + (p.score < 0 ? ' negative' : '');
      score.textContent = '$' + p.score;

      card.appendChild(name);
      card.appendChild(score);
      sb.appendChild(card);
    }
  }

  // ============================================================
  // CLUE MODAL
  // ============================================================

  /**
   * Show the clue modal.
   * @param {object} clue enriched clue
   * @param {string} catName
   */
  showClueModal(clue, catName) {
    this._el('clue-header').textContent = `${catName} — $${clue.value}`;
    this._el('clue-text').textContent = clue.question;

    const answer = this._el('answer-text');
    answer.textContent = clue.answer;
    answer.classList.add('hidden');
    this._el('show-answer-btn').classList.remove('hidden');
    this._el('eval-controls').classList.add('hidden');

    // Build player pills.
    this._buildPlayerPills();

    this._el('clue-modal').classList.remove('hidden');
  }

  _buildPlayerPills() {
    const container = this._el('player-pills');
    container.innerHTML = '';
    const activeId = this._players.getActivePlayer()?.id;
    for (const p of this._players.getPlayers()) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'player-pill' + (p.id === activeId ? ' active' : '');
      pill.dataset.playerId = String(p.id);
      pill.textContent = p.name;
      pill.addEventListener('click', () => this._selectPill(pill));
      container.appendChild(pill);
    }
  }

  _selectPill(pill) {
    if (pill.disabled) return;
    const pills = this._el('player-pills').querySelectorAll('.player-pill');
    pills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
  }

  /**
   * Reveal the answer and evaluation controls.
   * @param {string} answer
   */
  showAnswer(answer) {
    const answerEl = this._el('answer-text');
    answerEl.textContent = answer;
    answerEl.classList.remove('hidden');
    this._el('show-answer-btn').classList.add('hidden');
    this._el('eval-controls').classList.remove('hidden');
  }

  /** Hide the clue modal. */
  hideClueModal() {
    this._el('clue-modal').classList.add('hidden');
  }

  // ============================================================
  // DAILY DOUBLE
  // ============================================================

  /**
   * Show Daily Double overlay.
   * @param {object} clue
   * @param {string} catName
   * @param {{id:number,name:string,score:number}|null} activePlayer
   */
  showDailyDouble(clue, catName, activePlayer) {
    const info = this._el('wager-info');
    if (activePlayer) {
      info.textContent = `${activePlayer.name} — Score: $${activePlayer.score}`;
    } else {
      info.textContent = `Score: $0`;
    }
    const bounds = this._game.getDailyDoubleWagerBounds();
    const input = this._el('wager-input');
    input.min = String(bounds.min);
    input.max = String(bounds.max);
    input.value = '';
    this._el('wager-error').classList.add('hidden');
    this._el('daily-double-overlay').classList.remove('hidden');
    // Focus the input for quick wager entry.
    setTimeout(() => input.focus(), 50);
  }

  hideDailyDouble() {
    this._el('daily-double-overlay').classList.add('hidden');
  }

  /**
   * Show the wager error message.
   * @param {string} msg
   */
  showWagerError(msg) {
    const el = this._el('wager-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  // ============================================================
  // FINAL JEOPARDY (all render into #fj-content)
  // ============================================================

  _fj() { return this._el('fj-content'); }

  /** @param {string} category */
  showFinalCategory(category) {
    const fj = this._fj();
    fj.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'fj-category';
    div.textContent = category;
    fj.appendChild(div);
  }

  /**
   * Create wager input per player.
   * @param {Array<{id:number,name:string,score:number}>} playersArr
   */
  showFinalWagerInputs(playersArr) {
    const fj = this._fj();
    const list = document.createElement('div');
    list.className = 'fj-wager-list';
    for (const p of playersArr) {
      const row = document.createElement('div');
      row.className = 'fj-wager-row';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = String(Math.max(0, p.score));
      input.id = `fj-wager-${p.id}`;
      input.value = '0';
      input.placeholder = 'Wager';
      row.appendChild(name);
      row.appendChild(input);
      list.appendChild(row);
    }
    fj.appendChild(list);

    const err = document.createElement('div');
    err.id = 'fj-wager-error';
    err.className = 'wager-error hidden';
    fj.appendChild(err);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'start-btn fj-wager-submit';
    btn.id = 'fj-wager-submit';
    btn.textContent = 'Submit Wagers';
    btn.addEventListener('click', () => this._onSubmitFjWagers(playersArr));
    fj.appendChild(btn);
  }

  _onSubmitFjWagers(playersArr) {
    let allValid = true;
    const errEl = this._el('fj-wager-error');
    for (const p of playersArr) {
      const input = this._el(`fj-wager-${p.id}`);
      const value = parseInt(input.value, 10);
      const max = Math.max(0, p.score);
      if (isNaN(value) || value < 0 || value > max) {
        allValid = false;
        errEl.textContent = `${p.name}: wager must be 0–$${max}`;
        errEl.classList.remove('hidden');
      }
    }
    if (!allValid) return;
    for (const p of playersArr) {
      const value = parseInt(this._el(`fj-wager-${p.id}`).value, 10);
      this._game.submitFinalWager(p.id, value);
    }
  }

  /** @param {string} question */
  showFinalClue(question) {
    const fj = this._fj();
    fj.innerHTML = '';
    const q = document.createElement('div');
    q.className = 'fj-question';
    q.textContent = question;
    fj.appendChild(q);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'start-btn';
    btn.textContent = 'Reveal Answer';
    btn.addEventListener('click', () => {
      this._audio.playIncorrect(); // short cue before answer
      this._game.showFinalAnswer();
    });
    fj.appendChild(btn);
  }

  /**
   * Show the answer + per-player correct/incorrect marking.
   * @param {string} answer
   * @param {Array<{id:number,name:string,score:number}>} playersArr
   */
  showFinalAnswerMarking(answer, playersArr) {
    const fj = this._fj();
    fj.innerHTML = '';
    const a = document.createElement('div');
    a.className = 'fj-answer';
    a.textContent = answer;
    fj.appendChild(a);

    const list = document.createElement('div');
    list.className = 'fj-mark-list';
    for (const p of playersArr) {
      const row = document.createElement('div');
      row.className = 'fj-mark-row';
      row.dataset.playerId = String(p.id);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      row.appendChild(name);

      const correct = document.createElement('button');
      correct.type = 'button';
      correct.className = 'btn-correct';
      correct.textContent = 'Correct';
      correct.addEventListener('click', () => this._onFjMark(p.id, true, row));
      row.appendChild(correct);

      const incorrect = document.createElement('button');
      incorrect.type = 'button';
      incorrect.className = 'btn-incorrect';
      incorrect.textContent = 'Wrong';
      incorrect.addEventListener('click', () => this._onFjMark(p.id, false, row));
      row.appendChild(incorrect);

      list.appendChild(row);
    }
    fj.appendChild(list);
  }

  _onFjMark(playerId, correct, row) {
    const ok = this._game.markFinalAnswer(playerId, correct);
    if (ok) {
      if (correct) {
        this._audio.playCorrect();
        row.style.background = 'rgba(92, 184, 92, 0.3)';
      } else {
        this._audio.playIncorrect();
        row.style.background = 'rgba(217, 83, 79, 0.3)';
      }
      // Disable the row's buttons.
      row.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
    }
  }

  // ============================================================
  // GAME OVER
  // ============================================================

  /**
   * @param {Array<{id:number,name:string,score:number}>} winner
   * @param {Array<{id:number,name:string,score:number}>} scoreboard
   */
  showGameOver(winner, scoreboard) {
    const winnerLabel = this._el('winner-name');
    if (winnerLabel) {
      winnerLabel.textContent = winner.length === 0
        ? 'Game Over'
        : winner.length === 1
          ? `${winner[0].name} Wins!`
          : `${winner.map(w => w.name).join(' & ')} Tie!`;
    }

    const body = this._el('final-scores-body');
    body.innerHTML = '';
    const winnerIds = new Set(winner.map(w => w.id));
    for (const p of scoreboard) {
      const tr = document.createElement('tr');
      if (winnerIds.has(p.id)) tr.className = 'winner-row';

      const nameTd = document.createElement('td');
      nameTd.textContent = p.name;

      const scoreTd = document.createElement('td');
      scoreTd.textContent = '$' + p.score;
      if (p.score < 0) scoreTd.className = 'negative';

      tr.appendChild(nameTd);
      tr.appendChild(scoreTd);
      body.appendChild(tr);
    }
  }

  // ============================================================
  // VIEW HELPERS
  // ============================================================

  showRoundAction(show) {
    this._el('round-action').classList.toggle('hidden', !show);
  }

  /** Hide all game views (used before showing a specific view). */
  hideAllViews() {
    ['game-board', 'final-jeopardy', 'game-over'].forEach(id => {
      this._el(id).classList.add('hidden');
    });
    this._el('scoreboard').classList.add('hidden');
  }
}
