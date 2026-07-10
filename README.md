# Hand Slice — Webcam Fruit Ninja

A browser-based Fruit Ninja clone where your **hand** is the blade. Built with
plain HTML/CSS/JS, the Canvas API, and MediaPipe Hands for real-time hand
tracking. No backend, no build step, no external audio/image assets — all
sound is synthesized and all fruit/bomb art is drawn procedurally.

## Running it

Browsers block webcam access (`getUserMedia`) on plain `file://` pages, so
you need to serve the folder over `http://localhost` (or HTTPS). Any static
server works, for example:

```bash
cd fruit-ninja-hand
python3 -m http.server 8000
# then open http://localhost:8000 in Chrome, Edge, or Firefox
```

or, with Node installed:

```bash
npx serve .
```

You need an internet connection the first time you load the page — MediaPipe
Hands is loaded from a CDN (`cdn.jsdelivr.net`) rather than bundled. Once
loaded, everything else (physics, audio, rendering) runs fully offline/client-side.

## How to play

1. Click **Start Game** and allow camera access when prompted.
2. Hold your hand up so your **index fingertip** is visible to the camera.
3. **Swipe fast** through fruit to slice it — slow, hovering movements won't
   cut anything (this is intentional, and tunable in Settings).
4. Avoid the **bombs** — slicing one ends the run immediately.
5. Let a fruit fall off the bottom uncut and you lose a life. Run out of
   lives and it's game over.
6. Chain fast slices together for **combo bonuses** and a slow-motion
   "frenzy" effect at 5+ combo.

## Project structure

```
index.html          Markup: canvas, HUD, menu/pause/game-over/settings overlays
styles.css           Visual design system (dark "computer-vision HUD" theme)
src/
  storage.js         localStorage: high score + persisted settings
  physics.js          Gravity/projectile-motion helpers shared by all entities
  particles.js         Juice splashes, explosion debris, floating text, shockwaves, screen shake
  fruit.js             Fruit entity: spawning, physics, procedural drawing, slicing into halves
  bomb.js               Bomb entity: physics, procedural drawing, danger aura
  collision.js           Segment-vs-circle swipe collision, speed-gated
  handTracker.js          MediaPipe Hands wrapper: camera capture, smoothing, mirrored coords, trail
  audio.js                 Web Audio API synthesized SFX + generative background music
  ui.js                     DOM/overlay/HUD management
  game.js                   Main loop, state machine, difficulty curve, scoring/combo logic
```

## Settings

Open the ⚙ settings panel (from the main menu or in-game) to adjust:

- **Hand sensitivity** — how responsive vs. smoothed the tracked fingertip is.
- **Swipe speed threshold** — how fast a motion must be (px/sec) to register as a cut.
- **Music / SFX volume**, mute toggle.
- **Hide webcam feed** — play against a plain animated background instead of the camera image.
- **Dark / light mode**.
- **Camera selection**, if multiple webcams are available.
- **Fullscreen** toggle.

All settings and your high score persist locally via `localStorage`.

## Notes on hand tracking

- Only one hand is tracked at a time (first hand MediaPipe detects) — this
  keeps the "blade" behavior predictable per the game's design.
- The index fingertip (landmark 8) is smoothed with an exponential moving
  average to reduce jitter; the smoothing factor is the "sensitivity" setting.
- A short trail of recent fingertip positions (with per-segment speed) is
  kept and checked against every fruit/bomb each frame — collisions only
  count on trail segments that exceed the swipe-speed threshold, so hovering
  near a fruit does nothing but a fast swipe slices it.
