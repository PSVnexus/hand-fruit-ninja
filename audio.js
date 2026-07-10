/**
 * audio.js
 * All sound is synthesized with the Web Audio API -- no external mp3/ogg
 * assets required, so the game works fully offline once the page (and the
 * MediaPipe CDN scripts) have loaded. Includes slice/explosion/miss SFX and
 * a soft generative background pad loop.
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicNodes = [];
    this.musicPlaying = false;
  }

  _ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.masterGain);
  }

  /** Must be called from a user gesture (click) to satisfy autoplay policies. */
  unlock() {
    this._ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    this._ensureContext();
    this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  setMusicVolume(v) {
    this._ensureContext();
    this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setSfxVolume(v) {
    this._ensureContext();
    this.sfxGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  _envGain(startTime, attack, decay, peak = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(peak, startTime + attack);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + attack + decay);
    return g;
  }

  playSlice(pitchMul = 1) {
    this._ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800 * pitchMul, t);
    osc.frequency.exponentialRampToValueAtTime(200 * pitchMul, t + 0.12);
    const noise = this._noiseBurst(0.06);
    const g = this._envGain(t, 0.002, 0.14, 0.5);
    osc.connect(g);
    g.connect(this.sfxGain);
    noise.gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  playCombo(streak) {
    this._ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const base = 520 + Math.min(streak, 8) * 60;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 2, t + 0.15);
    const g = this._envGain(t, 0.01, 0.2, 0.35);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  playMiss() {
    this._ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.25);
    const g = this._envGain(t, 0.005, 0.3, 0.35);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  playExplosion() {
    this._ensureContext();
    const t = this.ctx.currentTime;
    const noise = this._noiseBurst(0.9, 0.9);
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    const g = this._envGain(t, 0.005, 0.7, 0.8);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  _noiseBurst(duration, peak = 0.4) {
    this._ensureContext();
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this._envGain(this.ctx.currentTime, 0.002, duration, peak);
    src.connect(g);
    g.connect(this.sfxGain);
    src.start();
    return { source: src, gain: g };
  }

  /** Gentle ambient generative pad + soft pulse, looped via scheduled oscillators. */
  startMusic() {
    this._ensureContext();
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    const chords = [
      [220, 277.18, 329.63],
      [196, 246.94, 293.66],
      [174.61, 220, 261.63],
      [196, 246.94, 293.66]
    ];
    let chordIndex = 0;
    const playChord = () => {
      if (!this.musicPlaying) return;
      const t = this.ctx.currentTime;
      const chord = chords[chordIndex % chords.length];
      chordIndex++;
      chord.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq / 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.18, t + 1.2);
        g.gain.linearRampToValueAtTime(0, t + 3.6);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 3.7);
        this.musicNodes.push(osc);
      });
      this._musicTimeout = setTimeout(playChord, 3200);
    };
    playChord();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this._musicTimeout) clearTimeout(this._musicTimeout);
    this.musicNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    this.musicNodes = [];
  }
}
