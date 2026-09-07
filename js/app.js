// ============================================================
// app.js — Orchestrator
// ============================================================

import { Players } from './players.js';
import { Game, GameState } from './game.js';
import { Board } from './board.js';
import { AudioManager } from './audio.js';

const STORAGE_KEY = 'jeopardy_game_state';

// ------------------------------------------------------------
// JSON validation & normalization
// ------------------------------------------------------------

/**
 * Validate raw JSON against schema requirements.
 * @param {object} raw
 * @returns {string|null} error message or null if valid
 */
function validateData(raw) {
  if (!raw || typeof raw !== 'object') {
    return 'Invalid JSON: root must be an object.';
  }
  const isFormatB = Object.keys(raw).some(k => /^round\d+$/i.test(k));
  const rounds = isFormatB
    ? Object.keys(raw).filter(k => /^round\d+$/i.test(k)).map(k => raw[k])
    : raw.rounds;

  if (!Array.isArray(rounds) || rounds.length === 0) {
    return 'Invalid question data: must contain at least one round.';
  }

  for (let rIdx = 0; rIdx < rounds.length; rIdx++) {
    const round = rounds[rIdx];
    if (!round.categories || !Array.isArray(round.categories) || round.categories.length === 0) {
      return `Round ${rIdx + 1} must contain a valid categories array.`;
    }
    let dailyDoubleCount = 0;
    for (let cIdx = 0; cIdx < round.categories.length; cIdx++) {
      const cat = round.categories[cIdx];
      if (!cat.name || typeof cat.name !== 'string') {
        return `Round ${rIdx + 1}, Category ${cIdx + 1} is missing a name.`;
      }
      if (!Array.isArray(cat.clues) || cat.clues.length === 0) {
        return `Round ${rIdx + 1}, Category "${cat.name}" has no clues.`;
      }
      for (let clIdx = 0; clIdx < cat.clues.length; clIdx++) {
        const clue = cat.clues[clIdx];
        if (typeof clue.value !== 'number' || clue.value <= 0) {
          return `Round ${rIdx + 1}, Category "${cat.name}", Clue ${clIdx + 1} has an invalid value: ${clue.value}.`;
        }
        if (!clue.question || typeof clue.question !== 'string') {
          return `Round ${rIdx + 1}, Category "${cat.name}", Clue ${clIdx + 1} is missing question text.`;
        }
        if (!clue.answer || typeof clue.answer !== 'string') {
          return `Round ${rIdx + 1}, Category "${cat.name}", Clue ${clIdx + 1} is missing answer text.`;
        }
        if (clue.isDailyDouble || clue.dailyDouble) {
          dailyDoubleCount++;
        }
      }
    }
    // Round 1 (Jeopardy) check for multiple Daily Doubles
    if (rIdx === 0 && dailyDoubleCount > 1) {
      return `Round 1 ("Jeopardy") cannot have duplicate Daily Doubles (found ${dailyDoubleCount}).`;
    }
  }

  return null;
}

/**
 * Convert raw JSON (Format A or Format B) into canonical Format A.
 * Also normalizes `dailyDouble` -> `isDailyDouble`, attaches media, and initializes `_used: false`.
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
        image: cl.image || null,
        video: cl.video ? {
          url: cl.video.url,
          segments: cl.video.segments || null
        } : null,
        _used: !!cl._used
      }))
    }))
  };
}

// ------------------------------------------------------------
// State Persistence Helpers
// ------------------------------------------------------------

function saveGameState(players, game, questions) {
  try {
    if (!game || game.getState() === GameState.GAME_OVER || game.getState() === GameState.SETUP) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload = {
      players: players.toJSON(),
      game: game.toJSON(),
      questions,
      savedAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to persist game state:', e);
  }
}

function loadSavedGameState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearSavedGameState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
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
    this._bindKeyboard();
    this._bindModals();
    this._loadDefaultQuestions();
    this._registerServiceWorker();
    this._checkResumeState();
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
        this._showError('Maximum of 10 players allowed.');
        return;
      }
      this._addPlayerInput(list);
    });

    upload.addEventListener('change', () => this._onFileUpload(upload));
    startBtn.addEventListener('click', () => this._startGame());
    document.getElementById('play-again-btn').addEventListener('click', () => this._playAgain());

    // Next Round
    document.getElementById('next-round-btn').addEventListener('click', () => {
      if (this._game) {
        this._game.nextRound();
        this._save();
      }
    });

    // Clue modal buttons
    document.getElementById('show-answer-btn').addEventListener('click', () => {
      this._revealAnswer();
    });

    document.getElementById('btn-correct').addEventListener('click', () => this._evaluateCurrentClue(true));
    document.getElementById('btn-incorrect').addEventListener('click', () => this._evaluateCurrentClue(false));
    document.getElementById('btn-no-answer').addEventListener('click', () => {
      if (this._game) {
        this._game.noAnswer();
        this._save();
      }
    });

    // Daily Double submit
    const submitWager = document.getElementById('submit-wager-btn');
    submitWager.addEventListener('click', () => this._onSubmitDailyDoubleWager());
    document.getElementById('wager-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._onSubmitDailyDoubleWager();
    });
  }

  _bindModals() {
    // Error modal close
    const errorClose = document.getElementById('error-close-btn');
    if (errorClose) {
      errorClose.addEventListener('click', () => {
        document.getElementById('error-modal').classList.add('hidden');
      });
    }

    // Resume modal buttons
    const resumeYes = document.getElementById('resume-yes-btn');
    const resumeNo = document.getElementById('resume-no-btn');
    if (resumeYes) {
      resumeYes.addEventListener('click', () => this._onResumeGame());
    }
    if (resumeNo) {
      resumeNo.addEventListener('click', () => this._onNewGameFromModal());
    }
  }

  _showError(msg) {
    if (this._board) {
      this._board.showError(msg);
    } else {
      const errEl = document.getElementById('error-message');
      if (errEl) errEl.textContent = msg;
      const modal = document.getElementById('error-modal');
      if (modal) modal.classList.remove('hidden');
    }
  }

  _addPlayerInput(list, name = '') {
    const group = document.createElement('div');
    group.className = 'player-input-group';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-name-input';
    input.placeholder = `Player ${list.children.length + 1}`;
    input.value = name;
    input.setAttribute('aria-label', `Player ${list.children.length + 1} name`);

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

    // File size limit: reject > 5MB
    if (file.size > 5 * 1024 * 1024) {
      this._showError('File size exceeds the 5 MB limit. Please upload a smaller file.');
      upload.value = '';
      return;
    }

    // MIME type check
    const isJsonType = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
    if (!isJsonType) {
      this._showError('Invalid file type. Please upload a valid JSON (.json) file.');
      upload.value = '';
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validationError = validateData(parsed);
      if (validationError) {
        this._showError(validationError);
        upload.value = '';
        return;
      }
      this._questions = normalizeData(parsed);
      this._updateStartButton();
    } catch (e) {
      this._showError('Failed to parse JSON file: ' + e.message);
      upload.value = '';
    }
  }

  async _loadDefaultQuestions() {
    try {
      const res = await fetch('data/questions.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const parsed = await res.json();
      const validationError = validateData(parsed);
      if (validationError) {
        console.warn('Default questions.json validation warning:', validationError);
      }
      this._questions = normalizeData(parsed);
    } catch (e) {
      console.warn('Could not auto-load default questions.json:', e);
      this._showError('Could not load default questions.json. Please upload custom questions or verify connectivity.');
    }
    this._updateStartButton();
  }

  _updateStartButton() {
    const startBtn = document.getElementById('start-game-btn');
    const list = document.getElementById('player-list');
    const namedPlayers = Array.from(list.querySelectorAll('.player-name-input'))
      .filter(input => input.value.trim().length > 0);
    startBtn.disabled = !(this._questions && namedPlayers.length >= 2);
  }

  _checkResumeState() {
    const saved = loadSavedGameState();
    if (saved && saved.game && saved.game.state !== GameState.GAME_OVER && saved.players?.players?.length >= 2) {
      const modal = document.getElementById('resume-modal');
      if (modal) modal.classList.remove('hidden');
    }
  }

  _onResumeGame() {
    const saved = loadSavedGameState();
    if (!saved) {
      this._onNewGameFromModal();
      return;
    }
    document.getElementById('resume-modal').classList.add('hidden');

    this._questions = saved.questions;
    this._players = new Players();
    this._players.loadState(saved.players);

    this._game = new Game(this._questions, this._players);
    this._game.loadState(saved.game);
    this._board = new Board(this._game, this._players, this._audio);
    this._game.onStateChange((state, data) => this._onStateChange(state, data));

    // Show restored view
    document.getElementById('setup-screen').classList.add('hidden');
    const state = this._game.getState();

    if (state === GameState.FINAL_WAGER || state === GameState.FINAL_CLUE || state === GameState.FINAL_ANSWER) {
      this._board.hideAllViews();
      document.getElementById('final-jeopardy').classList.remove('hidden');
      if (state === GameState.FINAL_WAGER) {
        this._board.showFinalCategory(this._questions.finalJeopardy?.category || 'Final Jeopardy');
        this._board.showFinalWagerInputs(this._players.getPlayers());
      } else if (state === GameState.FINAL_CLUE) {
        this._board.showFinalClue(this._questions.finalJeopardy?.question || '');
      } else {
        this._board.showFinalAnswerMarking(this._questions.finalJeopardy?.answer || '', this._players.getPlayers());
      }
    } else {
      this._board.hideAllViews();
      document.getElementById('game-board').classList.remove('hidden');
      this._board.renderBoard();
      this._board.renderScoreboard();
      document.getElementById('scoreboard').classList.remove('hidden');

      if (this._game.isRoundComplete()) {
        this._board.showRoundAction(true);
        const hasMoreRounds = this._game.getCurrentRoundIndex() + 1 < (this._questions?.rounds.length || 0);
        document.getElementById('next-round-btn').textContent = hasMoreRounds ? 'Next Round →' : 'Final Jeopardy!';
      }
    }
  }

  _onNewGameFromModal() {
    clearSavedGameState();
    const modal = document.getElementById('resume-modal');
    if (modal) modal.classList.add('hidden');
  }

  _save() {
    saveGameState(this._players, this._game, this._questions);
  }

  _startGame() {
    const list = document.getElementById('player-list');
    const names = Array.from(list.querySelectorAll('.player-name-input'))
      .map(i => i.value.trim())
      .filter(n => n.length > 0);

    if (names.length < 2) {
      this._showError('Please add at least 2 players.');
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

    this._save();
  }

  // ---------- State routing ----------

  /**
   * Route a state change to board rendering + audio.
   * @param {string} state
   * @param {object} data
   */
  _onStateChange(state, data) {
    this._save();

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
        clearSavedGameState();
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

  _revealAnswer() {
    if (!this._game) return;
    this._game.showAnswer();
    const clue = this._board.lastClue;
    if (clue) this._board.showAnswer(clue.answer);
    this._save();
  }

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
          pill.setAttribute('aria-checked', 'false');
        }
      }
    }
    this._board.renderScoreboard();
    this._save();
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
      this._save();
    } else {
      const bounds = this._game.getDailyDoubleWagerBounds();
      this._board.showWagerError(`Wager must be $${bounds.min}–$${bounds.max}.`);
    }
  }

  // ---------- Keyboard Shortcuts ----------

  _bindKeyboard() {
    window.addEventListener('keydown', e => {
      // Ignore if typing in text input (except Enter / Arrow keys)
      const isInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);

      // 'M' toggles mute when not in text input
      if (!isInput && (e.key === 'm' || e.key === 'M')) {
        this._toggleMute();
        return;
      }

      // 'Esc' closes open error modal
      if (e.key === 'Escape') {
        const errModal = document.getElementById('error-modal');
        if (errModal && !errModal.classList.contains('hidden')) {
          errModal.classList.add('hidden');
          return;
        }
      }

      // 'Space' / 'Enter' to show answer if clue modal is open
      const clueModal = document.getElementById('clue-modal');
      if (clueModal && !clueModal.classList.contains('hidden')) {
        const showAnswerBtn = document.getElementById('show-answer-btn');
        if (!showAnswerBtn.classList.contains('hidden') && (e.key === ' ' || e.key === 'Enter') && !isInput) {
          e.preventDefault();
          this._revealAnswer();
          return;
        }
      }

      // Arrow keys navigation between clue cells on the board
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const active = document.activeElement;
        if (active && active.classList.contains('clue-cell')) {
          this._navigateClueCells(active, e.key);
          e.preventDefault();
        }
      }
    });
  }

  _navigateClueCells(currentCell, key) {
    const curCat = parseInt(currentCell.dataset.cat, 10);
    const curClue = parseInt(currentCell.dataset.clue, 10);
    let nextCat = curCat;
    let nextClue = curClue;

    if (key === 'ArrowUp') nextClue--;
    else if (key === 'ArrowDown') nextClue++;
    else if (key === 'ArrowLeft') nextCat--;
    else if (key === 'ArrowRight') nextCat++;

    const target = document.querySelector(`.clue-cell[data-cat="${nextCat}"][data-clue="${nextClue}"]`);
    if (target && target.style.visibility !== 'hidden') {
      target.focus();
    }
  }

  // ---------- Mute ----------

  _toggleMute() {
    const btn = document.getElementById('mute-btn');
    const muted = this._audio.toggleMute();
    btn.classList.toggle('muted', muted);
    btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  _bindMute() {
    const btn = document.getElementById('mute-btn');
    btn.addEventListener('click', () => {
      this._toggleMute();
    });
  }

  // ---------- Play again ----------

  _playAgain() {
    clearSavedGameState();
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

  // ---------- Service Worker ----------

  _registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
          console.warn('Service Worker registration failed:', err);
        });
      });
    }
  }
}

// Boot the app on DOM ready.
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
