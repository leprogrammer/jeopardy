// ============================================================
// board.js — UI rendering
// ============================================================

import { GameState } from './game.js';

function sanitize(str) {
  if (typeof window !== 'undefined' && window.DOMPurify) {
    return window.DOMPurify.sanitize(str);
  }
  return str;
}

function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

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
    this._lastClue = null;
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
      cell.setAttribute('role', 'columnheader');
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
        cell.setAttribute('role', 'button');

        if (clue) {
          cell.textContent = '$' + clue.value;
          if (this._game.isClueUsed(catIndex, row)) {
            cell.classList.add('used');
            cell.setAttribute('aria-label', `${cat.name}, used clue`);
            cell.setAttribute('tabindex', '-1');
          } else {
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-label', `${cat.name}, $${clue.value}`);
            cell.addEventListener('click', () => this._onCellClick(catIndex, row));
            cell.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._onCellClick(catIndex, row);
              }
            });
          }
        } else {
          cell.style.visibility = 'hidden';
          cell.setAttribute('tabindex', '-1');
        }
        frag.appendChild(cell);
      });
    }

    grid.appendChild(frag);
    this.updateRoundTitle(round.name);
  }

  _onCellClick(catIndex, clueIndex) {
    if (this._game.isClueUsed(catIndex, clueIndex)) return;
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
   * Add .used to a cell and update attributes.
   */
  markCellUsed(catIndex, clueIndex) {
    const grid = this._el('board-grid');
    const cell = grid.querySelector(`.clue-cell[data-cat="${catIndex}"][data-clue="${clueIndex}"]`);
    if (cell) {
      cell.classList.add('used');
      cell.setAttribute('tabindex', '-1');
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
      score.textContent = (p.score < 0 ? '-$' : '$') + Math.abs(p.score);

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
    this._lastClue = clue;
    this._el('clue-header').textContent = `${catName} — $${clue.value}`;
    this._el('clue-text').textContent = clue.question;

    // Render media extensions if present
    const mediaContainer = this._el('clue-media');
    if (mediaContainer) {
      mediaContainer.innerHTML = '';
      if (clue.image) {
        mediaContainer.classList.remove('hidden');
        const img = document.createElement('img');
        img.src = sanitize(clue.image);
        img.alt = 'Clue illustration';
        img.loading = 'lazy';
        mediaContainer.appendChild(img);
      } else if (clue.video && clue.video.url) {
        this._renderVideoPlayer(mediaContainer, clue.video, 'question');
      } else {
        mediaContainer.classList.add('hidden');
      }
    }

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
      pill.setAttribute('role', 'radio');
      pill.setAttribute('aria-checked', p.id === activeId ? 'true' : 'false');
      pill.addEventListener('click', () => this._selectPill(pill));
      container.appendChild(pill);
    }
  }

  _selectPill(pill) {
    if (pill.disabled) return;
    const pills = this._el('player-pills').querySelectorAll('.player-pill');
    pills.forEach(p => {
      p.classList.remove('active');
      p.setAttribute('aria-checked', 'false');
    });
    pill.classList.add('active');
    pill.setAttribute('aria-checked', 'true');
  }

  /**
   * Render or update video player to show specific question clip vs extended answer clip.
   * @param {HTMLElement} container
   * @param {object} videoData
   * @param {'question'|'answer'} segmentType
   */
  _renderVideoPlayer(container, videoData, segmentType = 'question') {
    container.innerHTML = '';
    container.classList.remove('hidden');

    const seg = (segmentType === 'answer')
      ? (videoData.segments?.answer || {})
      : (videoData.segments?.question || {});

    const start = typeof seg.start === 'number' ? seg.start : 0;
    const end = typeof seg.end === 'number' ? seg.end : null;

    const label = segmentType === 'answer' ? 'Answer Clip (Extended)' : 'Question Clip (Teaser)';
    const isFile = typeof window !== 'undefined' && window.location.protocol === 'file:';

    // Header badge
    const header = document.createElement('div');
    header.className = 'video-clip-header';
    header.innerHTML = `
      <span class="video-clip-badge ${segmentType}">
        ${label}: ${start}s &ndash; ${end != null ? `${end}s` : 'End'}
      </span>
    `;
    container.appendChild(header);

    const ytid = extractYouTubeId(videoData.url);

    if (ytid) {
      const iframeWrapper = document.createElement('div');
      iframeWrapper.className = 'video-frame-wrapper';

      const iframe = document.createElement('iframe');
      iframe.id = 'clue-video-frame';
      let src = `https://www.youtube-nocookie.com/embed/${ytid}?autoplay=1&modestbranding=1&rel=0&start=${start}`;
      if (end != null) src += `&end=${end}`;
      iframe.src = sanitize(src);
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      iframe.setAttribute('allowfullscreen', 'true');
      iframeWrapper.appendChild(iframe);
      container.appendChild(iframeWrapper);

      // Controls & external fallback links
      const controls = document.createElement('div');
      controls.className = 'video-controls-row';

      const replayBtn = document.createElement('button');
      replayBtn.type = 'button';
      replayBtn.className = 'video-replay-btn';
      replayBtn.textContent = `↺ Replay ${segmentType === 'answer' ? 'Answer' : 'Question'} Clip`;
      replayBtn.addEventListener('click', () => {
        let reloadSrc = `https://www.youtube-nocookie.com/embed/${ytid}?autoplay=1&modestbranding=1&rel=0&start=${start}`;
        if (end != null) reloadSrc += `&end=${end}`;
        iframe.src = sanitize(reloadSrc);
      });
      controls.appendChild(replayBtn);

      const directLink = document.createElement('a');
      directLink.href = `https://www.youtube.com/watch?v=${ytid}&t=${start}s`;
      directLink.target = '_blank';
      directLink.rel = 'noopener noreferrer';
      directLink.className = 'video-external-link';
      directLink.textContent = `Watch ${segmentType === 'answer' ? 'Answer' : 'Question'} on YouTube ↗`;
      controls.appendChild(directLink);

      container.appendChild(controls);

      if (isFile) {
        const warning = document.createElement('div');
        warning.className = 'file-protocol-warning';
        warning.innerHTML = `
          <small>⚠️ <strong>YouTube Error 153?</strong> YouTube blocks video embeds on local <code>file://</code> paths. Run <code>npm start</code> to open at <code>http://localhost:3000</code>, or use the direct link above.</small>
        `;
        container.appendChild(warning);
      }
    } else {
      // Direct HTML5 video file
      const video = document.createElement('video');
      video.id = 'clue-video-player';
      video.src = sanitize(videoData.url);
      video.controls = true;
      video.autoplay = true;
      video.currentTime = start;
      container.appendChild(video);

      const onTimeUpdate = () => {
        if (end != null && video.currentTime >= end) {
          video.pause();
          video.currentTime = end;
          video.removeEventListener('timeupdate', onTimeUpdate);
        }
      };
      video.addEventListener('timeupdate', onTimeUpdate);

      const controls = document.createElement('div');
      controls.className = 'video-controls-row';

      const replayBtn = document.createElement('button');
      replayBtn.type = 'button';
      replayBtn.className = 'video-replay-btn';
      replayBtn.textContent = `↺ Replay ${segmentType === 'answer' ? 'Answer' : 'Question'} Clip`;
      replayBtn.addEventListener('click', () => {
        video.currentTime = start;
        video.play().catch(() => {});
        video.addEventListener('timeupdate', onTimeUpdate);
      });
      controls.appendChild(replayBtn);
      container.appendChild(controls);
    }
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

    // If video clue has segments, switch to the longer answer clip
    const clue = this._lastClue;
    const mediaContainer = this._el('clue-media');
    if (clue?.video && mediaContainer) {
      this._renderVideoPlayer(mediaContainer, clue.video, 'answer');
    }
  }

  /** Hide the clue modal. */
  hideClueModal() {
    const modal = this._el('clue-modal');
    if (modal) modal.classList.add('hidden');
    // Clear media so playback ceases immediately
    const media = this._el('clue-media');
    if (media) {
      media.innerHTML = '';
      media.classList.add('hidden');
    }
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
    this._lastClue = clue;
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
      // Comeback floor: players with score <= 0 may wager up to 1000
      const max = p.score > 0 ? p.score : 1000;
      input.max = String(max);
      input.id = `fj-wager-${p.id}`;
      input.value = '0';
      input.placeholder = `0–$${max}`;
      input.setAttribute('aria-label', `Final wager for ${p.name}`);
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
      const max = p.score > 0 ? p.score : 1000;
      if (isNaN(value) || value < 0 || value > max) {
        allValid = false;
        errEl.textContent = `${p.name}: wager must be 0–$${max}`;
        errEl.classList.remove('hidden');
        return;
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
        row.style.background = 'oklch(68% 0.16 142 / 0.3)';
      } else {
        this._audio.playIncorrect();
        row.style.background = 'oklch(66% 0.18 25 / 0.3)';
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
      scoreTd.textContent = (p.score < 0 ? '-$' : '$') + Math.abs(p.score);
      if (p.score < 0) scoreTd.className = 'negative';

      tr.appendChild(nameTd);
      tr.appendChild(scoreTd);
      body.appendChild(tr);
    }
  }

  // ============================================================
  // MODALS & HELPERS
  // ============================================================

  showError(message) {
    const modal = this._el('error-modal');
    const msgEl = this._el('error-message');
    if (msgEl) msgEl.textContent = message;
    if (modal) modal.classList.remove('hidden');
  }

  hideError() {
    const modal = this._el('error-modal');
    if (modal) modal.classList.add('hidden');
  }

  showResumeModal() {
    const modal = this._el('resume-modal');
    if (modal) modal.classList.remove('hidden');
  }

  hideResumeModal() {
    const modal = this._el('resume-modal');
    if (modal) modal.classList.add('hidden');
  }

  showRoundAction(show) {
    this._el('round-action').classList.toggle('hidden', !show);
  }

  /** Hide all game views (used before showing a specific view). */
  hideAllViews() {
    ['game-board', 'final-jeopardy', 'game-over', 'setup-screen'].forEach(id => {
      const el = this._el(id);
      if (el) el.classList.add('hidden');
    });
    const sb = this._el('scoreboard');
    if (sb) sb.classList.add('hidden');
  }
}
