// ============================================================
// audio.js — Web Audio API synthesized sound effects (no files)
// ============================================================

export class AudioManager {
  constructor() {
    /** @type {AudioContext|null} lazily created on first user gesture */
    this._ctx = null;
    this._muted = false;
    /** @type {OscillatorNode[]} oscillators to stop for Final Jeopardy loop */
    this._fjOscillators = [];
    this._fjGain = null;
    this._fjTimer = null;
  }

  /**
   * Create / resume the AudioContext (must follow a user gesture).
   * @returns {AudioContext}
   */
  _ensureContext() {
    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error('Web Audio API not supported.');
      this._ctx = new Ctx();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx;
  }

  /**
   * Build a single oscillator + gain envelope.
   */
  _tone({ freq, start, duration, type = 'sine', peak = 0.25, sweepTo = null }) {
    const ctx = this._ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    if (sweepTo != null) {
      osc.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + start + duration);
    }
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.02);
    return { osc, gain };
  }

  _play(fn) {
    if (this._muted) return;
    try { fn(); } catch (e) {}
  }

  // ----- Individual sounds -----

  /** Rising arpeggio C4 -> C6 (~1.5s). */
  playDailyDouble() {
    this._play(() => {
      const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => this._tone({ freq: f, start: i * 0.18, duration: 0.35, type: 'triangle', peak: 0.3 }));
    });
  }

  /** Bright two-tone chime (~0.5s). */
  playCorrect() {
    this._play(() => {
      this._tone({ freq: 659.25, start: 0, duration: 0.22, type: 'sine', peak: 0.3 });
      this._tone({ freq: 987.77, start: 0.16, duration: 0.35, type: 'sine', peak: 0.3 });
    });
  }

  /** Low sawtooth buzz (~0.5s). */
  playIncorrect() {
    this._play(() => {
      this._tone({ freq: 150, start: 0, duration: 0.45, type: 'sawtooth', peak: 0.28, sweepTo: 90 });
    });
  }

  /** C major chord (~2s). */
  playFanfare() {
    this._play(() => {
      const chord = [261.63, 329.63, 392.0, 523.25];
      chord.forEach(f => this._tone({ freq: f, start: 0, duration: 1.8, type: 'triangle', peak: 0.22 }));
      chord.forEach(f => this._tone({ freq: f * 2, start: 0.9, duration: 1.0, type: 'sine', peak: 0.15 }));
    });
  }

  /** Single click (~0.1s). */
  playTimerTick() {
    this._play(() => {
      this._tone({ freq: 800, start: 0, duration: 0.05, type: 'square', peak: 0.15 });
    });
  }

  // ----- Final Jeopardy think music (looping) -----

  /**
   * Start a simple looping two-note "think" melody.
   */
  playFinalJeopardy() {
    if (this._muted) return;
    this.stopFinalJeopardy();
    const ctx = this._ensureContext();

    this._fjGain = ctx.createGain();
    this._fjGain.gain.value = 0.12;
    this._fjGain.connect(ctx.destination);

    const beat = 0.6;
    const loopDuration = this._scheduleFjLoop(ctx, beat);
    this._fjTimer = setInterval(() => this._scheduleFjLoop(ctx, beat), loopDuration * 1000);
  }

  _scheduleFjLoop(ctx, beat) {
    if (!this._fjGain) return 0;
    const notes = [440.0, 329.63, 440.0, 261.63];
    let t = 0;
    for (let i = 0; i < notes.length * 2; i++) {
      const f = notes[i % notes.length];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + beat);
      osc.connect(g).connect(this._fjGain);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + beat + 0.05);
      this._fjOscillators.push(osc);
      t += beat;
    }
    if (this._fjOscillators.length > 64) {
      this._fjOscillators = this._fjOscillators.slice(-32);
    }
    return t;
  }

  /** Stop Final Jeopardy music and clear scheduled oscillators. */
  stopFinalJeopardy() {
    if (this._fjTimer) {
      clearInterval(this._fjTimer);
      this._fjTimer = null;
    }
    if (this._ctx && this._fjGain) {
      try {
        this._fjGain.gain.cancelScheduledValues(this._ctx.currentTime);
        this._fjGain.gain.setTargetAtTime(0.0001, this._ctx.currentTime, 0.1);
      } catch (e) { /* ignore */ }
    }
    this._fjOscillators = [];
    this._fjGain = null;
  }

  // ----- Controls -----

  /**
   * Toggle mute.
   * @returns {boolean} new mute state
   */
  toggleMute() {
    this._muted = !this._muted;
    if (this._muted) this.stopFinalJeopardy();
    return this._muted;
  }

  /**
   * Check if sound is muted.
   * @returns {boolean}
   */
  isMuted() {
    return this._muted;
  }
}
