// ============================================================
// game.js — Core state machine
// ============================================================

export const GameState = {
  BOARD: 'board',
  CLUE_SHOWN: 'clue_shown',
  ANSWER_SHOWN: 'answer_shown',
  DAILY_DOUBLE: 'daily_double',
  FINAL_WAGER: 'final_wager',
  FINAL_CLUE: 'final_clue',
  FINAL_ANSWER: 'final_answer',
  GAME_OVER: 'game_over'
};

export class Game {
  /**
   * @param {object} questionsData normalized questions JSON (Format A)
   * @param {import('./players.js').Players} players
   */
  constructor(questionsData, players) {
    this._data = questionsData;
    this._players = players;
    this._rounds = questionsData.rounds || [];
    this._finalJeopardy = questionsData.finalJeopardy || null;

    this._state = GameState.BOARD;
    this._roundIndex = 0;
    this._currentClue = null;
    this._attemptedPlayers = new Set();
    this._ddWager = null;

    // Final Jeopardy
    this._fjWagers = {};           // playerId -> amount
    this._fjAnswers = {};          // playerId -> boolean (correct?)

    this._listeners = [];

    // Start at the first round.
    this._enterRoundBoard(false);
  }

  // ----- Event plumbing -----

  /**
   * @param {(state:string, data:object)=>void} callback
   */
  onStateChange(callback) {
    this._listeners.push(callback);
  }

  /**
   * @param {string} newState
   * @param {object} [data]
   */
  setState(newState, data = {}) {
    this._state = newState;
    const snapshot = { ...data };
    for (const cb of this._listeners) {
      try { cb(newState, snapshot); } catch (e) { console.error(e); }
    }
  }

  /** @returns {string} */
  getState() { return this._state; }

  /** @returns {object} */
  getCurrentRound() { return this._rounds[this._roundIndex]; }

  /** @returns {number} 0-based */
  getCurrentRoundIndex() { return this._roundIndex; }

  // ----- Clue selection -----

  /**
   * Select a clue, mark used, and emit DAILY_DOUBLE or CLUE_SHOWN.
   * @param {number} catIndex
   * @param {number} clueIndex
   * @returns {object} enriched clue
   */
  selectClue(catIndex, clueIndex) {
    const round = this.getCurrentRound();
    const cat = round.categories[catIndex];
    const clue = cat.clues[clueIndex];
    if (clue._used) {
      throw new Error('Clue already used.');
    }
    clue._used = true;
    this._attemptedPlayers = new Set();
    this._currentClue = {
      ...clue,
      categoryName: cat.name,
      catIndex,
      clueIndex
    };

    if (clue.isDailyDouble) {
      const active = this._players.getActivePlayer();
      this.setState(GameState.DAILY_DOUBLE, { clue: this._currentClue, activePlayer: active });
    } else {
      this.setState(GameState.CLUE_SHOWN, { clue: this._currentClue });
    }
    return this._currentClue;
  }

  /**
   * @param {number} catIndex
   * @param {number} clueIndex
   * @returns {boolean}
   */
  isClueUsed(catIndex, clueIndex) {
    const round = this.getCurrentRound();
    const clue = round?.categories[catIndex]?.clues[clueIndex];
    return !!(clue && clue._used);
  }

  // ----- Answering -----

  /** CLUE_SHOWN -> ANSWER_SHOWN */
  showAnswer() {
    if (this._state !== GameState.CLUE_SHOWN) {
      throw new Error('showAnswer called in wrong state.');
    }
    this.setState(GameState.ANSWER_SHOWN, { clue: this._currentClue });
  }

  /**
   * Award points and set the active player. -> BOARD
   * @param {number} playerId
   */
  markCorrect(playerId) {
    if (this._attemptedPlayers.has(playerId)) return;
    this._attemptedPlayers.add(playerId);
    const clue = this._currentClue;
    const value = clue.isDailyDouble && this._ddWager != null ? this._ddWager : clue.value;
    this._players.updateScore(playerId, value);
    this._players.setActivePlayer(playerId);
    this._finishClue();
  }

  /**
   * Deduct points. DD -> BOARD. Normal -> ANSWER_SHOWN (others can try).
   * @param {number} playerId
   */
  markIncorrect(playerId) {
    if (this._attemptedPlayers.has(playerId)) return;
    this._attemptedPlayers.add(playerId);

    const clue = this._currentClue;
    const value = clue.isDailyDouble && this._ddWager != null ? this._ddWager : clue.value;
    this._players.updateScore(playerId, -value);

    if (clue.isDailyDouble || this._attemptedPlayers.size >= this._players.getCount()) {
      this._finishClue();
    } else {
      this.setState(GameState.ANSWER_SHOWN, { clue: this._currentClue, incorrectPlayerId: playerId });
    }
  }

  /** -> BOARD with no score change */
  noAnswer() {
    this._finishClue();
  }

  /** Shared "clue resolved" path: back to BOARD. */
  _finishClue() {
    this.setState(GameState.BOARD, { roundComplete: this.isRoundComplete() });
  }

  // ----- Daily Double -----

  /** @returns {number} highest printed clue value on the current round's board */
  _highestBoardValue() {
    const round = this.getCurrentRound();
    return round ? Math.max(0, ...round.categories.flatMap(c => c.clues.map(cl => cl.value))) : 0;
  }

  /**
   * Validate and accept a Daily Double wager.
   * Valid range: 5 <= amount <= max(player.score, highestBoardValue)
   * @param {number} amount
   * @returns {boolean} true if accepted (-> CLUE_SHOWN)
   */
  setDailyDoubleWager(amount) {
    const player = this._players.getActivePlayer();
    if (!player) throw new Error('No active player for Daily Double wager.');
    const maxWager = Math.max(player.score, this._highestBoardValue());
    if (!Number.isFinite(amount) || amount < 5 || amount > maxWager) return false;
    this._ddWager = amount;
    this.setState(GameState.CLUE_SHOWN, { clue: this._currentClue });
    return true;
  }

  /** @returns {{min:number, max:number}} */
  getDailyDoubleWagerBounds() {
    const player = this._players.getActivePlayer();
    const score = player ? player.score : 0;
    return { min: 5, max: Math.max(score, this._highestBoardValue()) };
  }

  // ----- Round management -----

  /** @returns {boolean} true when every clue in the current round is used */
  isRoundComplete() {
    return this.getCurrentRound()?.categories.every(c => c.clues.every(cl => cl._used)) ?? true;
  }

  /** Advance to the next round, or to Final Jeopardy, or end the game. */
  nextRound() {
    const nextIndex = this._roundIndex + 1;
    if (nextIndex < this._rounds.length) {
      this._roundIndex = nextIndex;
      this._enterRoundBoard(true);
    } else if (this._finalJeopardy) {
      this._startFinalJeopardy();
    } else {
      this.endGame();
    }
  }

  _enterRoundBoard(isNewRound) {
    this._currentClue = null;
    this._ddWager = null;
    this.setState(GameState.BOARD, { round: this.getCurrentRound(), isNewRound });
  }

  // ----- Final Jeopardy -----

  _startFinalJeopardy() {
    this._fjWagers = {};
    this._fjAnswers = {};
    this.setState(GameState.FINAL_WAGER, { finalJeopardy: this._finalJeopardy });
  }

  /**
   * @param {number} playerId
   * @param {number} amount
   * @returns {boolean} true if accepted; auto -> FINAL_CLUE when all submitted
   */
  submitFinalWager(playerId, amount) {
    const player = this._players.getPlayer(playerId);
    if (!player) return false;
    const max = Math.max(0, player.score);
    if (!Number.isFinite(amount) || amount < 0 || amount > max) return false;
    this._fjWagers[playerId] = amount;
    if (this._players.getPlayers().every(p => this._fjWagers[p.id] != null)) {
      this.setState(GameState.FINAL_CLUE, { finalJeopardy: this._finalJeopardy });
    }
    return true;
  }

  /** FINAL_CLUE -> FINAL_ANSWER */
  showFinalAnswer() {
    this.setState(GameState.FINAL_ANSWER, { finalJeopardy: this._finalJeopardy });
  }

  /**
   * @param {number} playerId
   * @param {boolean} correct
   * @returns {boolean} true if accepted; auto endGame when all marked
   */
  markFinalAnswer(playerId, correct) {
    if (this._state !== GameState.FINAL_ANSWER || this._fjAnswers[playerId] != null) return false;
    const wager = this._fjWagers[playerId] || 0;
    this._players.updateScore(playerId, correct ? wager : -wager);
    this._fjAnswers[playerId] = correct;
    if (this._players.getPlayers().every(p => this._fjAnswers[p.id] != null)) {
      this.endGame();
    }
    return true;
  }

  /** -> GAME_OVER with { winner, scoreboard } */
  endGame() {
    this.setState(GameState.GAME_OVER, {
      winner: this._players.getWinner(),
      scoreboard: this._players.getScoreboard()
    });
  }
}
