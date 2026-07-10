/**
 * ui.js
 * Central place for all DOM interaction: menu, HUD, pause/game-over screens,
 * and the settings panel. Keeps game.js free of querySelector calls.
 */
class UIManager {
  constructor() {
    this.el = {
      menu: document.getElementById('overlay-menu'),
      pause: document.getElementById('overlay-pause'),
      gameover: document.getElementById('overlay-gameover'),
      settings: document.getElementById('overlay-settings'),
      loading: document.getElementById('overlay-loading'),
      loadingText: document.getElementById('loading-text'),
      hud: document.getElementById('hud'),

      menuHighScore: document.getElementById('menu-high-score'),
      startBtn: document.getElementById('btn-start'),
      menuSettingsBtn: document.getElementById('btn-menu-settings'),

      score: document.getElementById('hud-score'),
      lives: document.getElementById('hud-lives'),
      combo: document.getElementById('hud-combo'),
      highScore: document.getElementById('hud-high-score'),
      fps: document.getElementById('hud-fps'),

      pauseBtn: document.getElementById('btn-pause'),
      resumeBtn: document.getElementById('btn-resume'),
      restartFromPauseBtn: document.getElementById('btn-restart-from-pause'),
      quitBtn: document.getElementById('btn-quit'),

      finalScore: document.getElementById('final-score'),
      finalHighScore: document.getElementById('final-high-score'),
      newHighBadge: document.getElementById('new-high-badge'),
      restartBtn: document.getElementById('btn-restart'),
      gameOverReason: document.getElementById('gameover-reason'),

      muteBtn: document.getElementById('btn-mute'),
      settingsBtn: document.getElementById('btn-settings'),
      closeSettingsBtn: document.getElementById('btn-close-settings'),
      sensitivitySlider: document.getElementById('setting-sensitivity'),
      thresholdSlider: document.getElementById('setting-threshold'),
      hideWebcamToggle: document.getElementById('setting-hide-webcam'),
      darkModeToggle: document.getElementById('setting-dark-mode'),
      cameraSelect: document.getElementById('setting-camera'),
      musicVolSlider: document.getElementById('setting-music-vol'),
      sfxVolSlider: document.getElementById('setting-sfx-vol'),
      fullscreenBtn: document.getElementById('btn-fullscreen'),

      comboBanner: document.getElementById('combo-banner'),
      handStatus: document.getElementById('hand-status')
    };
  }

  show(elName) { this.el[elName].classList.remove('hidden'); }
  hide(elName) { this.el[elName].classList.add('hidden'); }

  showLoading(text) {
    this.el.loadingText.textContent = text;
    this.show('loading');
  }
  hideLoading() { this.hide('loading'); }

  showMenu(highScore) {
    this.el.menuHighScore.textContent = highScore;
    this.show('menu');
    this.hide('pause');
    this.hide('gameover');
    this.hide('hud');
  }

  startPlaying() {
    this.hide('menu');
    this.hide('pause');
    this.hide('gameover');
    this.show('hud');
  }

  showPause() { this.show('pause'); }
  hidePause() { this.hide('pause'); }

  showGameOver(score, highScore, isNewHigh, reason) {
    this.el.finalScore.textContent = score;
    this.el.finalHighScore.textContent = highScore;
    this.el.newHighBadge.classList.toggle('hidden', !isNewHigh);
    this.el.gameOverReason.textContent = reason || '';
    this.hide('hud');
    this.show('gameover');
  }

  updateHUD({ score, lives, combo, highScore, fps }) {
    if (score !== undefined) this.el.score.textContent = score;
    if (highScore !== undefined) this.el.highScore.textContent = highScore;
    if (fps !== undefined) this.el.fps.textContent = fps;
    if (lives !== undefined) {
      this.el.lives.innerHTML = '';
      for (let i = 0; i < lives; i++) {
        const heart = document.createElement('span');
        heart.className = 'life-heart';
        heart.textContent = '❤';
        this.el.lives.appendChild(heart);
      }
    }
    if (combo !== undefined) {
      this.el.combo.textContent = combo > 1 ? `x${combo} COMBO` : '';
      this.el.combo.classList.toggle('visible', combo > 1);
    }
  }

  flashComboBanner(text) {
    const el = this.el.comboBanner;
    el.textContent = text;
    el.classList.remove('pop');
    void el.offsetWidth; // restart animation
    el.classList.add('pop');
  }

  setHandStatus(visible) {
    this.el.handStatus.textContent = visible ? '✋ Hand tracked' : '🔍 Show your hand to the camera';
    this.el.handStatus.classList.toggle('tracked', visible);
  }

  populateCameraList(devices, selectedId) {
    const sel = this.el.cameraSelect;
    sel.innerHTML = '';
    devices.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Camera ${i + 1}`;
      if (d.deviceId === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  applySettingsToControls(settings) {
    this.el.sensitivitySlider.value = settings.sensitivity;
    this.el.thresholdSlider.value = settings.swipeThreshold;
    this.el.hideWebcamToggle.checked = settings.hideWebcam;
    this.el.darkModeToggle.checked = settings.darkMode;
    this.el.musicVolSlider.value = settings.musicVolume;
    this.el.sfxVolSlider.value = settings.sfxVolume;
    this.el.muteBtn.textContent = settings.muted ? '🔇' : '🔊';
    document.body.classList.toggle('light-mode', !settings.darkMode);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
}
