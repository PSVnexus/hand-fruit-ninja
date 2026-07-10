/**
 * physics.js
 * Small, dependency-free projectile-motion helpers shared by fruit/bomb/particles.
 */
const Physics = (() => {
  const GRAVITY = 1400; // px / s^2 -- tuned for a satisfying arc at typical 1280x720 canvas

  /**
   * Advances a physics body (must have x,y,vx,vy) by dt seconds using
   * simple semi-implicit Euler integration. Optional drag dampens vx slightly
   * so thrown objects feel like they're moving through air, not a vacuum.
   */
  function step(body, dt, opts = {}) {
    const gravityScale = opts.gravityScale !== undefined ? opts.gravityScale : 1;
    const drag = opts.drag !== undefined ? opts.drag : 0.999;
    body.vy += GRAVITY * gravityScale * dt;
    body.vx *= drag;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    if (opts.spin !== undefined && body.rotation !== undefined) {
      body.rotation += body.angularVelocity * dt;
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  return { GRAVITY, step, lerp, clamp, dist };
})();
