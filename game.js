/**
 * game.js
 * Main orchestrator: owns the canvas, the game state machine, entity lists,
 * difficulty scaling, scoring/combo logic, and the render loop. Wires
 * together HandTracker, Collision, ParticleSystem, AudioEngine and UIManager.
 */
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.video = document.getElementById('webcam');

    this.ui = new UIManager();
    this.audio = new AudioEngine();
    this.particles = new ParticleSystem();
    this.shake = new ScreenShake();
    this.settings = Storage.getSettings();

    this.handTracker = new HandTracker(this.video, { sensitivity: this.settings.sensitivity });

    this.state = 'menu'; // menu | playing | paused | gameover
    this.fruits = [];
    this.bombs = [];
    this.score = 0;
    this.lives = 3;
    this.highScore = Storage.getHighScore();
    this.comboHits = [];
    this.comboWindowMs = 700;
    this.slowMoTimer = 0;
    this.slowMoCooldown = 0;
    this.timeScale = 1;

    this.elapsed = 0;
    this.spawnTimer = 0;
    this.lastTime = 0;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    this.fpsDisplay = 0;

    this.bladeHue = 190;

    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    this._bindUI();
    this.ui.applySettingsToControls(this.settings);
    this.ui.showMenu(this.highScore);
    this._populateCameras();

    requestAnimationFrame((t) => this._loop(t));
  }

  _resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.handTracker.setCanvasSize(this.w, this.h);
  }

  async _populateCameras() {
    try {
      // A short-lived permission probe so device labels are available; ignored if denied.
      const devices = await this.handTracker.listCameras();
      if (devices.length) this.ui.populateCameraList(devices, this.settings.cameraId);
    } catch (e) { /* user hasn't granted permission yet -- fine, list will be empty */ }
  }

  _bindUI() {
    const u = this.ui.el;

    u.startBtn.addEventListener('click', () => this._startGame());
    u.menuSettingsBtn.addEventListener('click', () => this.ui.show('settings'));

    u.pauseBtn.addEventListener('click', () => this._togglePause());
    u.resumeBtn.addEventListener('click', () => this._togglePause());
    u.restartFromPauseBtn.addEventListener('click', () => this._startGame());
    u.quitBtn.addEventListener('click', () => this._quitToMenu());

    u.restartBtn.addEventListener('click', () => this._startGame());

    u.muteBtn.addEventListener('click', () => {
      this.settings.muted = !this.settings.muted;
      this.audio.unlock();
      this.audio.setMuted(this.settings.muted);
      u.muteBtn.textContent = this.settings.muted ? '🔇' : '🔊';
      Storage.saveSettings(this.settings);
    });

    u.settingsBtn.addEventListener('click', () => this.ui.show('settings'));
    u.closeSettingsBtn.addEventListener('click', () => {
      this.ui.hide('settings');
      Storage.saveSettings(this.settings);
    });

    u.sensitivitySlider.addEventListener('input', (e) => {
      this.settings.sensitivity = parseFloat(e.target.value);
      this.handTracker.setSensitivity(this.settings.sensitivity);
    });
    u.thresholdSlider.addEventListener('input', (e) => {
      this.settings.swipeThreshold = parseFloat(e.target.value);
    });
    u.hideWebcamToggle.addEventListener('change', (e) => {
      this.settings.hideWebcam = e.target.checked;
    });
    u.darkModeToggle.addEventListener('change', (e) => {
      this.settings.darkMode = e.target.checked;
      document.body.classList.toggle('light-mode', !this.settings.darkMode);
    });
    u.musicVolSlider.addEventListener('input', (e) => {
      this.settings.musicVolume = parseFloat(e.target.value);
      this.audio.setMusicVolume(this.settings.musicVolume);
    });
    u.sfxVolSlider.addEventListener('input', (e) => {
      this.settings.sfxVolume = parseFloat(e.target.value);
      this.audio.setSfxVolume(this.settings.sfxVolume);
    });
    u.cameraSelect.addEventListener('change', async (e) => {
      this.settings.cameraId = e.target.value;
      Storage.saveSettings(this.settings);
      if (this.state === 'playing' || this.state === 'paused') {
        this.handTracker.stop();
        await this.handTracker.start(this.settings.cameraId);
      }
    });
    u.fullscreenBtn.addEventListener('click', () => this.ui.toggleFullscreen());

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'playing') this._togglePause();
      if (e.code === 'Escape' && this.state === 'paused') this._togglePause();
    });
  }

  async _startGame() {
    this.ui.hide('gameover');
    this.ui.hide('pause');
    this.ui.showLoading('Requesting camera access…');
    try {
      this.audio.unlock();
      this.audio.setMuted(this.settings.muted);
      this.audio.setMusicVolume(this.settings.musicVolume);
      this.audio.setSfxVolume(this.settings.sfxVolume);

      this.ui.showLoading('Starting hand tracking…');
      await this.handTracker.start(this.settings.cameraId || null);
      await this._populateCameras();

      this.score = 0;
      this.lives = 3;
      this.comboHits = [];
      this.elapsed = 0;
      this.spawnTimer = 0.6;
      this.fruits = [];
      this.bombs = [];
      this.particles.clear();
      this.timeScale = 1;
      this.slowMoTimer = 0;
      this.slowMoCooldown = 0;

      this.ui.hideLoading();
      this.ui.startPlaying();
      this.audio.startMusic();
      this.state = 'playing';
      this.lastTime = performance.now();
    } catch (err) {
      this.ui.hideLoading();
      this.ui.showMenu(this.highScore);
      alert('Camera access is required to play. Please allow camera permissions and try again.\n\n' + (err && err.message ? err.message : ''));
    }
  }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.ui.showPause();
      this.audio.stopMusic();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.ui.hidePause();
      this.audio.startMusic();
      this.lastTime = performance.now();
    }
  }

  _quitToMenu() {
    this.state = 'menu';
    this.handTracker.stop();
    this.audio.stopMusic();
    this.ui.showMenu(this.highScore);
  }

  _endGame(reason) {
    this.state = 'gameover';
    this.handTracker.stop();
    this.audio.stopMusic();
    const isNewHigh = this.score > this.highScore;
    if (isNewHigh) {
      this.highScore = this.score;
      Storage.setHighScore(this.highScore);
    }
    this.ui.showGameOver(this.score, this.highScore, isNewHigh, reason);
  }

  // ---- Difficulty curve -------------------------------------------------
  _spawnIntervalFor(t) {
    return Physics.clamp(1.15 - t * 0.012, 0.38, 1.15);
  }
  _speedMultiplierFor(t) {
    return Physics.clamp(1 + t * 0.01, 1, 1.9);
  }
  _bombChanceFor(t) {
    return Physics.clamp(0.06 + t * 0.0025, 0.06, 0.24);
  }
  _multiLaunchChanceFor(t) {
    return Physics.clamp(0.1 + t * 0.003, 0.1, 0.55);
  }

  _spawnWave() {
    const t = this.elapsed;
    const speedMul = this._speedMultiplierFor(t);
    const isBomb = Math.random() < this._bombChanceFor(t);
    if (isBomb) {
      this.bombs.push(spawnBomb(this.w, this.h, speedMul));
    } else {
      this.fruits.push(spawnFruit(this.w, this.h, speedMul));
    }
    if (Math.random() < this._multiLaunchChanceFor(t)) {
      const extra = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < extra; i++) {
        this.fruits.push(spawnFruit(this.w, this.h, speedMul));
      }
    }
  }

  // ---- Main loop ----------------------------------------------------------
  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    const rawDt = Math.min(0.05, (now - this.lastTime) / 1000 || 0);
    this.lastTime = now;

    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.fpsDisplay = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    if (this.state === 'playing' || this.state === 'exploding') this._update(rawDt);
    this._draw();
  }

  _update(rawDt) {
    const isExploding = this.state === 'exploding';
    // slow-motion after big combos
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= rawDt;
      this.timeScale = 0.35;
      if (this.slowMoTimer <= 0) this.timeScale = 1;
    }
    if (this.slowMoCooldown > 0) this.slowMoCooldown -= rawDt;

    const dt = rawDt * this.timeScale;
    if (!isExploding) this.elapsed += rawDt;

    if (!isExploding) {
      // spawning (unaffected by slow-mo so difficulty still reads real time)
      this.spawnTimer -= rawDt;
      if (this.spawnTimer <= 0) {
        this._spawnWave();
        this.spawnTimer = this._spawnIntervalFor(this.elapsed);
      }

      // physics update
      for (const f of this.fruits) f.update(dt);
      for (const b of this.bombs) b.update(dt);

      // life loss for missed whole fruits
      for (const f of this.fruits) {
        if (f.dead && f.fellOffScreen) {
          this.lives--;
          this.audio.playMiss();
          this.particles.addFloatingText(f.x, this.h - 60, '-1 LIFE', '#ff4d4d', 26);
          this._breakCombo();
        }
      }
      this.fruits = this.fruits.filter(f => !f.dead);
      this.bombs = this.bombs.filter(b => !b.dead);

      // hand + collisions
      const fingertip = this.handTracker.getFingertip();
      this.ui.setHandStatus(fingertip.visible);
      const trail = this.handTracker.getTrail();

      if (trail.length >= 2) {
        const allTargets = [...this.fruits.filter(f => !f.isHalf), ...this.bombs];
        const hits = Collision.checkTrailAgainstObjects(trail, allTargets, this.settings.swipeThreshold);
        for (const hit of hits) {
          if (hit.object.isBomb) {
            this._hitBomb(hit.object);
          } else {
            this._hitFruit(hit.object, hit.dir);
          }
        }
      }
    }

    // combo window decay -> reset banner when no cuts for a while
    const now = performance.now();
    this.comboHits = this.comboHits.filter(t => now - t <= this.comboWindowMs);

    this.particles.update(dt);
    this.shake.update(rawDt);

    this.ui.updateHUD({
      score: this.score,
      lives: Math.max(0, this.lives),
      combo: this.comboHits.length,
      highScore: this.highScore,
      fps: this.fpsDisplay
    });

    if (!isExploding && this.lives <= 0) {
      this._endGame('You ran out of lives!');
    }
  }

  _breakCombo() {
    this.comboHits = [];
  }

  _hitFruit(fruit, dir) {
    fruit.sliced = true;
    const halves = fruit.split(dir.dx, dir.dy);
    this.fruits.push(...halves);

    const now = performance.now();
    this.comboHits.push(now);
    const comboCount = this.comboHits.length;

    const basePoints = fruit.type.points;
    const bonus = comboCount > 1 ? comboCount - 1 : 0;
    const gained = basePoints + bonus;
    this.score += gained;

    const juiceColor = fruit.type.accent;
    this.particles.juiceSplash(fruit.x, fruit.y, juiceColor, fruit.type.golden ? 34 : 20, fruit.type.golden ? 1.4 : 1);
    this.particles.addFloatingText(fruit.x, fruit.y, `+${gained}`, fruit.type.golden ? '#ffd700' : '#ffffff', fruit.type.golden ? 34 : 24);

    this.audio.playSlice(fruit.type.golden ? 1.4 : 1);
    if (comboCount >= 2) {
      this.audio.playCombo(comboCount);
      this.ui.flashComboBanner(`x${comboCount} COMBO!`);
    }

    if (comboCount >= 5 && this.slowMoCooldown <= 0) {
      this.slowMoTimer = 1.3;
      this.slowMoCooldown = 6;
      this.ui.flashComboBanner('SLOW-MO FRENZY!');
    }
  }

  _hitBomb(bomb) {
    bomb.dead = true;
    this.particles.explosion(bomb.x, bomb.y);
    this.shake.add(1);
    this.audio.playExplosion();
    this.state = 'exploding';
    // brief delay so the explosion is visible before the game-over screen appears
    setTimeout(() => this._endGame('Sliced a bomb!'), 450);
  }

  // ---- Rendering ------------------------------------------------------
  _draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.w, this.h);

    const shakeOffset = this.shake.getOffset();
    ctx.translate(this.w / 2 + shakeOffset.x, this.h / 2 + shakeOffset.y);
    ctx.rotate(shakeOffset.rotation);
    ctx.translate(-this.w / 2, -this.h / 2);

    this._drawBackground(ctx);

    if (this.state === 'playing' || this.state === 'paused' || this.state === 'exploding') {
      this._drawTrail(ctx);
      for (const b of this.bombs) b.draw(ctx);
      for (const f of this.fruits) f.draw(ctx);
      this.particles.draw(ctx);
    }

    ctx.restore();
  }

  _drawBackground(ctx) {
    const dark = this.settings.darkMode;
    if (this.settings.hideWebcam || this.state === 'menu') {
      const grad = ctx.createLinearGradient(0, 0, 0, this.h);
      if (dark) {
        grad.addColorStop(0, '#0f1229');
        grad.addColorStop(1, '#241a3d');
      } else {
        grad.addColorStop(0, '#dff3ff');
        grad.addColorStop(1, '#ffe8d6');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.w, this.h);
      return;
    }

    if (this.video.readyState >= 2 && this.handTracker.running) {
      ctx.save();
      ctx.translate(this.w, 0);
      ctx.scale(-1, 1);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(this.video, 0, 0, this.w, this.h);
      ctx.restore();
      ctx.fillStyle = dark ? 'rgba(10,10,25,0.35)' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, 0, this.w, this.h);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, this.h);
      grad.addColorStop(0, '#0f1229');
      grad.addColorStop(1, '#241a3d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  _drawTrail(ctx) {
    const trail = this.handTracker.getTrail();
    const fingertip = this.handTracker.getFingertip();
    if (trail.length < 2) {
      if (fingertip.visible) this._drawFingertipDot(ctx, fingertip);
      return;
    }

    this.bladeHue = (this.bladeHue + 0.4) % 360;
    const fast = fingertip.speed > this.settings.swipeThreshold;
    const color = fast ? `hsl(${this.bladeHue}, 95%, 65%)` : 'hsla(190, 80%, 70%, 0.5)';

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = fast ? 25 : 8;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      const t = i / trail.length;
      ctx.globalAlpha = t;
      ctx.strokeStyle = color;
      ctx.lineWidth = Physics.lerp(2, fast ? 10 : 5, t);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    this._drawFingertipDot(ctx, fingertip);
  }

  _drawFingertipDot(ctx, fingertip) {
    if (!fingertip.visible) return;
    ctx.save();
    ctx.shadowColor = '#7CFFCB';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#eafff5';
    ctx.beginPath();
    ctx.arc(fingertip.x, fingertip.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__game = new Game();
});
