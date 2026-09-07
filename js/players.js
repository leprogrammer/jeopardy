// ============================================================
// players.js — Player management
// ============================================================

export class Players {
  constructor() {
    /** @type {Map<number, {id:number, name:string, score:number}>} */
    this._players = new Map();
    this._nextId = 1;
    this._activePlayerId = null;
  }

  /**
   * Add a player.
   * @param {string} name
   * @returns {{id:number, name:string, score:number}}
   */
  addPlayer(name) {
    if (this._players.size >= 10) {
      throw new Error('Cannot add more than 10 players.');
    }
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new Error('Player name cannot be empty.');
    }
    const player = { id: this._nextId++, name: trimmed, score: 0 };
    this._players.set(player.id, player);
    return player;
  }

  /**
   * Update a player's score by a delta (may be negative).
   * @param {number} id
   * @param {number} delta
   */
  updateScore(id, delta) {
    const p = this._players.get(id);
    if (p) p.score += delta;
  }

  /**
   * Remove a player by id.
   * @param {number} id
   */
  removePlayer(id) {
    if (!this._players.has(id)) {
      throw new Error('Player not found.');
    }
    this._players.delete(id);
    if (this._activePlayerId === id) {
      // if the removed player was active, pick another or null
      const remaining = this.getPlayers();
      this._activePlayerId = remaining.length ? remaining[0].id : null;
    }
  }

  /** @returns {Array<{id:number,name:string,score:number}>} sorted by id ascending */
  getPlayers() {
    return Array.from(this._players.values()).sort((a, b) => a.id - b.id);
  }

  /**
   * @param {number} id
   * @returns {{id:number,name:string,score:number}|undefined}
   */
  getPlayer(id) {
    return this._players.get(id);
  }

  /** @returns {number} */
  getCount() {
    return this._players.size;
  }

  /** @param {number} id */
  setActivePlayer(id) {
    if (this._players.has(id)) this._activePlayerId = id;
  }

  /** @returns {{id:number,name:string,score:number}|null} */
  getActivePlayer() {
    return this._activePlayerId == null ? null : (this._players.get(this._activePlayerId) || null);
  }

  /** @returns {Array} players sorted by score descending */
  getScoreboard() {
    return Array.from(this._players.values())
      .sort((a, b) => b.score - a.score || a.id - b.id);
  }

  /** @returns {Array} player(s) with the highest score (handles ties) */
  getWinner() {
    const list = this.getScoreboard();
    if (!list.length) return [];
    const top = list[0].score;
    return list.filter(p => p.score === top);
  }

  /**
   * Reset all player scores to zero.
   */
  reset() {
    for (const p of this.getPlayers()) {
      p.score = 0;
    }
  }

  /** @returns {boolean} true if player count is between 2 and 10 inclusive */
  isValidCount() {
    const count = this.getCount();
    return count >= 2 && count <= 10;
  }

  /**
   * Serialize player state.
   */
  toJSON() {
    return {
      players: Array.from(this._players.values()),
      nextId: this._nextId,
      activePlayerId: this._activePlayerId
    };
  }

  /**
   * Restore player state.
   * @param {object} data
   */
  loadState(data) {
    if (!data) return;
    this._players.clear();
    if (Array.isArray(data.players)) {
      for (const p of data.players) {
        this._players.set(p.id, { id: p.id, name: p.name, score: p.score });
      }
    }
    this._nextId = data.nextId || (this._players.size + 1);
    this._activePlayerId = data.activePlayerId != null ? data.activePlayerId : null;
  }
}
