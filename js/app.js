// ============================================================
// app.js — Orchestrator
// ============================================================

import { Players } from './players.js';
import { Game, GameState } from './game.js';
import { Board } from './board.js';
import { AudioManager } from './audio.js';

// ------------------------------------------------------------
// JSON normalization (Format A canonical / Format B alternative)
// ------------------------------------------------------------

/**
 * Convert raw JSON (Format A or Format B) into canonical Format A.
 * Also normalizes `dailyDouble` -> `isDailyDouble` and initializes `_used: false` on every clue.
 * @param {object} raw
 * @returns {object}
 */
function normalizeData(raw) {
  const result = { rounds: [], finalJeopardy: null };

  // Format B: top-level round1/round2 (or arbitrary "roundN") keys
  const roundKeys = Object.keys(raw).filter(k => /^round\d+$/i.test(k));
  if (roundKeys.length) {
    roundKeys.sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
    for (const key of roundKeys) {
      const r = raw[key];
      result.rounds.push(normalizeRound({ name: r.name || key, categories: r.categories }));
    }
  } else if (Array.isArray(raw.rounds)) {
    // Format A
    result.rounds = raw.rounds.map(r => normalizeRound(r));
  }

  if (raw.finalJeopardy) {
    result.finalJeopardy = {
      category: raw.finalJeopardy.category,
      question: raw.finalJeopardy.question,
      answer: raw.finalJeopardy.answer
    };
  }
  return result;
}

function normalizeRound(round) {
  return {
    name: round.name,
    categories: (round.categories || []).map(cat => ({
      name: cat.name,
      clues: (cat.clues || []).map(cl => ({
        value: cl.value,
        question: cl.question,
        answer: cl.answer,
        isDailyDouble: !!(cl.isDailyDouble || cl.dailyDouble),
        _used: false
      }))
    }))
  };
}

// ------------------------------------------------------------
// App
// ------------------------------------------------------------

class App {
  constructor() {
    this._players = new Players();
    this._game = null;
    this._board = null;
    this._audio = new AudioManager();
    this._questions = null;

    this._bindSetup();
    this._bindMute();
    this._loadDefaultQuestions();
    this._updateStartButton();
  }

  // ---------- Setup screen ----------

  _bindSetup() {
    const list = document.getElementById('player-list');
    const addBtn = document.getElementById('add-player-btn');
    const upload = document.getElementById('game-data-upload');
    const startBtn = document.getElementById('start-game-btn');

    // Seed two empty inputs.
    this._addPlayerInput(list);
    this._addPlayerInput(list);

    // Delegated input listener for real-time button enabling
    list.addEventListener('input', () => this._updateStartButton());

    addBtn.addEventListener('click', () => {
      if (list.children.length >= 10) {
        alert('Maximum of 10 players.');
        return;
      }
      this._addPlayerInput(list);
    });

    upload.addEventListener('change', () => this._onFileUpload(upload));
    startBtn.addEventListener('click', () => this._startGame());
    document.getElementById('play-again-btn').addEventListener('click', () => this._playAgain());

    // Next Round
    document.getElementById('next-round-btn').addEventListener('click', () => {
      if (this._game) this._game.nextRound();
    });

    // Clue modal buttons
    document.getElementById('show-answer-btn').addEventListener('click', () => {
      if (!this._game) return;
      this._game.showAnswer();
      const clue = this._board.lastClue;
      if (clue) this._board.showAnswer(clue.answer);
    });

    document.getElementById('btn-correct').addEventListener('click', () => this._evaluateCurrentClue(true));
    document.getElementById('btn-incorrect').addEventListener('click', () => this._evaluateCurrentClue(false));
    document.getElementById('btn-no-answer').addEventListener('click', () => {
      if (this._game) this._game.noAnswer();
    });

    // Daily Double submit
    const submitWager = document.getElementById('submit-wager-btn');
    submitWager.addEventListener('click', () => this._onSubmitDailyDoubleWager());
    document.getElementById('wager-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._onSubmitDailyDoubleWager();
    });
  }

  _addPlayerInput(list, name = '') {
    const group = document.createElement('div');
    group.className = 'player-input-group';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-name-input';
    input.placeholder = 'Player name';
    input.value = name;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove player');
    removeBtn.addEventListener('click', () => {
      if (list.children.length <= 2) {
        input.value = '';
        input.focus();
        this._updateStartButton();
        return;
      }
      group.remove();
      this._updateStartButton();
    });

    group.appendChild(input);
    group.appendChild(removeBtn);
    list.appendChild(group);
  }

  async _onFileUpload(upload) {
    const file = upload.files?.[0];
    if (!file) return;
    try {
      this._questions = normalizeData(JSON.parse(await file.text()));
      this._updateStartButton();
    } catch (e) {
      alert('Failed to parse JSON file: ' + e.message);
    }
  }

  async _loadDefaultQuestions() {
    try {
      const res = await fetch('data/questions.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const parsed = await res.json();
      this._questions = normalizeData(parsed);
    } catch (e) {
      console.warn('Could not auto-load default questions.json:', e);
    }
    this._updateStartButton();
  }

  _updateStartButton() {
    const startBtn = document.getElementById('start-game-btn');
    const list = document.getElementById('player-list');
    const hasPlayers = Array.from(list.querySelectorAll('.player-name-input'))
      .some(input => input.value.trim().length > 0);
    startBtn.disabled = !(this._questions && hasPlayers);
  }

  _startGame() {
    const list = document.getElementById('player-list');
    const names = Array.from(list.querySelectorAll('.player-name-input'))
      .map(i => i.value.trim())
      .filter(n => n.length > 0);

    if (names.length < 2) {
      alert('Please add at least 2 players.');
      return;
    }

    this._players = new Players();
    for (const name of names) {
      this._players.addPlayer(name);
    }
    this._players.setActivePlayer(this._players.getPlayers()[0].id);

    this._game = new Game(this._questions, this._players);
    this._board = new Board(this._game, this._players, this._audio);
    this._game.onStateChange((state, data) => this._onStateChange(state, data));

    document.getElementById('setup-screen').classList.add('hidden');
    this._board.hideAllViews();
    document.getElementById('game-board').classList.remove('hidden');
    this._board.renderBoard();
    this._board.renderScoreboard();
    document.getElementById('scoreboard').classList.remove('hidden');
    this._audio.playFanfare();
  }

  // ---------- State routing ----------

  /**
   * Route a state change to board rendering + audio.
   * @param {string} state
   * @param {object} data
   */
  _onStateChange(state, data) {
    switch (state) {
      case GameState.BOARD: {
        this._board.hideClueModal();
        this._board.hideDailyDouble();
        this._board.renderBoard();
        this._board.renderScoreboard();
        if (data && data.isNewRound) {
          this._board.showRoundAction(false);
          this._board.showRoundTransition(this._game.getCurrentRound().name);
        }
        if (data && data.roundComplete) {
          this._board.showRoundAction(true);
          const hasMoreRounds = this._game.getCurrentRoundIndex() + 1 < (this._questions?.rounds.length || 0);
          document.getElementById('next-round-btn').textContent = hasMoreRounds ? 'Next Round →' : 'Final Jeopardy!';
        }
        break;
      }

      case GameState.FINAL_WAGER: {
        this._board.hideAllViews();
        document.getElementById('final-jeopardy').classList.remove('hidden');
        this._board.showFinalCategory(data.finalJeopardy.category);
        this._board.showFinalWagerInputs(this._players.getPlayers());
        break;
      }

      case GameState.FINAL_CLUE: {
        this._board.showFinalClue(data.finalJeopardy.question);
        this._audio.playFinalJeopardy();
        break;
      }

      case GameState.FINAL_ANSWER: {
        this._audio.stopFinalJeopardy();
        this._board.showFinalAnswerMarking(data.finalJeopardy.answer, this._players.getPlayers());
        break;
      }

      case GameState.GAME_OVER: {
        this._board.hideAllViews();
        document.getElementById('game-over').classList.remove('hidden');
        this._board.showGameOver(data.winner, data.scoreboard);
        this._audio.stopFinalJeopardy();
        this._audio.playFanfare();
        break;
      }

      default:
        break;
    }
  }

  // ---------- Clue evaluation ----------

  _selectedPillId() {
    const pill = document.querySelector('.player-pill.active');
    return pill ? parseInt(pill.dataset.playerId, 10) : null;
  }

  _evaluateCurrentClue(correct) {
    if (!this._game) return;
    const playerId = this._selectedPillId();
    if (playerId == null) {
      alert('Select a player first.');
      return;
    }
    if (correct) {
      this._game.markCorrect(playerId);
      this._audio.playCorrect();
    } else {
      this._game.markIncorrect(playerId);
      this._audio.playIncorrect();
      if (this._game.getState() === GameState.ANSWER_SHOWN) {
        const pill = document.querySelector(`.player-pill[data-player-id="${playerId}"]`);
        if (pill) {
          pill.disabled = true;
          pill.classList.remove('active');
        }
      }
    }
    this._board.renderScoreboard();
  }

  // ---------- Daily Double ----------

  _onSubmitDailyDoubleWager() {
    if (!this._game) return;
    const input = document.getElementById('wager-input');
    const amount = parseInt(input.value, 10);
    if (isNaN(amount)) {
      this._board.showWagerError('Enter a valid wager amount.');
      return;
    }
    const ok = this._game.setDailyDoubleWager(amount);
    if (ok) {
      this._board.hideDailyDouble();
      const clue = this._board.lastClue;
      if (clue) this._board.showClueModal(clue, clue.categoryName);
      document.getElementById('wager-error').classList.add('hidden');
    } else {
      const bounds = this._game.getDailyDoubleWagerBounds();
      this._board.showWagerError(`Wager must be $${bounds.min}–$${bounds.max}.`);
    }
  }

  // ---------- Mute ----------

  _bindMute() {
    const btn = document.getElementById('mute-btn');
    btn.addEventListener('click', () => {
      btn.classList.toggle('muted', this._audio.toggleMute());
    });
  }

  // ---------- Play again ----------

  _playAgain() {
    const names = this._players.getPlayers().map(p => p.name);
    this._players = new Players();
    for (const n of names) this._players.addPlayer(n);

    this._board.hideAllViews();
    this._board.hideClueModal();
    this._board.hideDailyDouble();
    this._audio.stopFinalJeopardy();

    const list = document.getElementById('player-list');
    list.innerHTML = '';
    for (const n of names) this._addPlayerInput(list, n);

    this._game = null;
    document.getElementById('setup-screen').classList.remove('hidden');
    this._updateStartButton();
  }
}

// Boot the app on DOM ready.
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
