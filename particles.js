/**
 * particles.js
 * Lightweight particle system: juice splashes, explosion debris, floating
 * score text, expanding shockwave rings, and a screen-shake helper.
 * All pools are simple arrays that get filtered each frame -- fine for the
 * particle counts a fruit-slicing game needs (a few hundred live at once).
 */

class Particle {
  constructor(x, y, vx, vy, color, radius, life, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.life = life;
    this.maxLife = life;
    this.gravityScale = opts.gravityScale !== undefined ? opts.gravityScale : 0.6;
    this.shrink = opts.shrink !== undefined ? opts.shrink : true;
    this.square = opts.square || false;
  }

  update(dt) {
    Physics.step(this, dt, { gravityScale: this.gravityScale, drag: 0.98 });
    this.life -= dt;
    return this.life > 0;
  }

  draw(ctx) {
    const t = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = t;
    ctx.fillStyle = this.color;
    const r = this.shrink ? this.radius * t : this.radius;
    if (this.square) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((1 - t) * 4);
      ctx.fillRect(-r / 2, -r / 2, r, r);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

class FloatingText {
  constructor(x, y, text, color, size = 28) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.life = 1.0;
    this.vy = -60;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.vy *= 0.94;
    this.life -= dt * 1.1;
    return this.life > 0;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.font = `800 ${this.size}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = this.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 4;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

class Shockwave {
  constructor(x, y, color, maxRadius = 160) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = 4;
    this.maxRadius = maxRadius;
    this.life = 1;
  }

  update(dt) {
    this.radius += (this.maxRadius - this.radius) * dt * 6;
    this.life -= dt * 1.6;
    return this.life > 0;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 6 * Math.max(0, this.life);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

class ScreenShake {
  constructor() {
    this.trauma = 0;
  }
  add(amount) {
    this.trauma = Physics.clamp(this.trauma + amount, 0, 1);
  }
  update(dt) {
    this.trauma = Physics.clamp(this.trauma - dt * 1.5, 0, 1);
  }
  getOffset() {
    const power = this.trauma * this.trauma;
    return {
      x: (Math.random() * 2 - 1) * 24 * power,
      y: (Math.random() * 2 - 1) * 24 * power,
      rotation: (Math.random() * 2 - 1) * 0.03 * power
    };
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.shockwaves = [];
  }

  juiceSplash(x, y, color, count = 18, speedMul = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (80 + Math.random() * 260) * speedMul;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 80,
        color,
        3 + Math.random() * 5,
        0.5 + Math.random() * 0.5
      ));
    }
  }

  explosion(x, y) {
    const colors = ['#ff6b35', '#ff9f1c', '#ffd166', '#3a3a3a', '#8d99ae'];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 500;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        colors[Math.floor(Math.random() * colors.length)],
        4 + Math.random() * 10,
        0.6 + Math.random() * 0.8,
        { gravityScale: 0.3, square: Math.random() > 0.5 }
      ));
    }
    this.shockwaves.push(new Shockwave(x, y, 'rgba(255,140,60,0.9)', 260));
  }

  addFloatingText(x, y, text, color, size) {
    this.texts.push(new FloatingText(x, y, text, color, size));
  }

  update(dt) {
    this.particles = this.particles.filter(p => p.update(dt));
    this.texts = this.texts.filter(t => t.update(dt));
    this.shockwaves = this.shockwaves.filter(s => s.update(dt));
  }

  draw(ctx) {
    for (const p of this.particles) p.draw(ctx);
    for (const s of this.shockwaves) s.draw(ctx);
    for (const t of this.texts) t.draw(ctx);
  }

  clear() {
    this.particles.length = 0;
    this.texts.length = 0;
    this.shockwaves.length = 0;
  }

  get count() {
    return this.particles.length + this.texts.length + this.shockwaves.length;
  }
}
