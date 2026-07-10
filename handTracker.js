/**
 * handTracker.js
 * Wraps MediaPipe Hands to provide a smoothed, mirrored fingertip position
 * plus a timestamped trail used for swipe-speed collision detection.
 *
 * Coordinate convention: MediaPipe returns normalized landmark coordinates
 * (0..1) relative to the *unmirrored* input frame. Since we display the
 * webcam mirrored (like a real mirror, which feels natural to users), we
 * flip x when converting to canvas pixel space: canvasX = (1 - lm.x) * W.
 */
class HandTracker {
  constructor(videoEl, options = {}) {
    this.video = videoEl;
    this.onFrameCallback = options.onFrame || null;
    this.hands = null;
    this.stream = null;
    this.running = false;
    this.canvasW = options.canvasW || 1280;
    this.canvasH = options.canvasH || 720;

    this.sensitivity = options.sensitivity !== undefined ? options.sensitivity : 0.55;
    this.trailMaxAgeMs = 160;
    this.trailMaxPoints = 24;

    this.smoothX = null;
    this.smoothY = null;
    this.lastRawTime = null;

    this.fingertip = { x: 0, y: 0, visible: false, speed: 0 };
    this.trail = [];
    this.landmarksForDebug = null;

    this._loopHandle = null;
    this._lastSendTime = 0;
    this._processing = false;
  }

  setCanvasSize(w, h) {
    this.canvasW = w;
    this.canvasH = h;
  }

  setSensitivity(s) {
    this.sensitivity = Physics.clamp(s, 0.05, 0.98);
  }

  async listCameras() {
    try {
      // Requesting a throwaway stream first ensures device labels are populated
      // (browsers hide labels until permission has been granted at least once).
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'videoinput');
    } catch (e) {
      return [];
    }
  }

  async start(deviceId = null) {
    const constraints = {
      video: {
        width: { ideal: 960 },
        height: { ideal: 540 },
        facingMode: deviceId ? undefined : 'user',
        deviceId: deviceId ? { exact: deviceId } : undefined
      },
      audio: false
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;
    await new Promise(resolve => {
      this.video.onloadedmetadata = () => {
        this.video.play();
        resolve();
      };
    });

    if (!this.hands) {
      this.hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.55
      });
      this.hands.onResults(results => this._onResults(results));
    }

    this.running = true;
    this._loop();
    return true;
  }

  stop() {
    this.running = false;
    if (this._loopHandle) cancelAnimationFrame(this._loopHandle);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  _loop() {
    if (!this.running) return;
    this._loopHandle = requestAnimationFrame(() => this._loop());
    if (this._processing) return; // avoid overlapping sends if detection is slow
    if (this.video.readyState < 2) return;
    this._processing = true;
    this.hands.send({ image: this.video }).finally(() => { this._processing = false; });
  }

  _onResults(results) {
    const now = performance.now();
    const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

    if (!hasHand) {
      this.fingertip.visible = false;
      this.landmarksForDebug = null;
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    this.landmarksForDebug = landmarks;
    const tip = landmarks[8]; // index fingertip

    const rawX = (1 - tip.x) * this.canvasW;
    const rawY = tip.y * this.canvasH;

    if (this.smoothX === null) {
      this.smoothX = rawX;
      this.smoothY = rawY;
    } else {
      // higher sensitivity => less smoothing => more responsive but jitterier
      const alpha = Physics.lerp(0.15, 0.85, this.sensitivity);
      this.smoothX = Physics.lerp(this.smoothX, rawX, alpha);
      this.smoothY = Physics.lerp(this.smoothY, rawY, alpha);
    }

    let speed = 0;
    if (this.lastRawTime !== null) {
      const dt = Math.max(1, now - this.lastRawTime) / 1000;
      const last = this.trail[this.trail.length - 1];
      if (last) speed = Physics.dist(this.smoothX, this.smoothY, last.x, last.y) / dt;
    }
    this.lastRawTime = now;

    this.trail.push({ x: this.smoothX, y: this.smoothY, t: now, speed });
    while (this.trail.length > this.trailMaxPoints) this.trail.shift();
    this.trail = this.trail.filter(p => now - p.t <= this.trailMaxAgeMs);

    this.fingertip = { x: this.smoothX, y: this.smoothY, visible: true, speed };
  }

  getFingertip() {
    return this.fingertip;
  }

  getTrail() {
    return this.trail;
  }
}
