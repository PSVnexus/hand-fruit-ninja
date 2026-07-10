/**
 * storage.js
 * Thin wrapper around localStorage for persisting high score and user settings.
 * All access is wrapped in try/catch since some browsers (privacy mode, etc.)
 * can throw when localStorage is unavailable.
 */
const Storage = (() => {
  const HIGH_SCORE_KEY = 'fnh_highScore';
  const SETTINGS_KEY = 'fnh_settings';

  const DEFAULT_SETTINGS = {
    sensitivity: 0.55,      // 0..1 -> controls smoothing (higher = snappier)
    swipeThreshold: 900,    // px/sec fingertip must exceed to count as a "cut"
    hideWebcam: false,      // show only skeleton/hand overlay instead of video
    darkMode: true,
    muted: false,
    musicVolume: 0.35,
    sfxVolume: 0.8,
    cameraId: null
  };

  function getHighScore() {
    try {
      const v = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
      return Number.isFinite(v) ? v : 0;
    } catch (e) {
      return 0;
    }
  }

  function setHighScore(value) {
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(value));
    } catch (e) { /* ignore */ }
  }

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) { /* ignore */ }
  }

  return { getHighScore, setHighScore, getSettings, saveSettings, DEFAULT_SETTINGS };
})();
