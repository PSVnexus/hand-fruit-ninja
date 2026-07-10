/**
 * bomb.js
 * Bomb entity -- flies like a fruit but ends the game instantly if sliced.
 * Visually distinct: dark sphere, glowing pulsating red aura, lit fuse.
 */

let bombIdCounter = 0;

class Bomb {
  constructor(x, y, vx, vy, canvasW, canvasH) {
    this.id = ++bombIdCounter;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 44;
    this.rotation = Math.random() * Math.PI * 2;
    this.angularVelocity = (Math.random() * 2 - 1) * 1.6;
    this.dead = false;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.isBomb = true;
  }

  update(dt) {
    Physics.step(this, dt, { gravityScale: 1, drag: 0.999 });
    if (this.y - this.radius > this.canvasH + 40) {
      this.dead = true;
    }
    return !this.dead;
  }

  containsPoint(px, py) {
    return Physics.dist(px, py, this.x, this.y) <= this.radius;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(4, this.radius * 0.35, this.radius * 0.9, this.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // pulsating red danger aura
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
    const auraGrad = ctx.createRadialGradient(0, 0, this.radius * 0.6, 0, 0, this.radius * 1.6);
    auraGrad.addColorStop(0, `rgba(255,60,60,${0.25 + pulse * 0.25})`);
    auraGrad.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(this.rotation);
    const grad = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.1, 0, 0, this.radius);
    grad.addColorStop(0, '#5a5a5a');
    grad.addColorStop(0.6, '#232323');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // shine highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.18, this.radius * 0.1, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // fuse
    ctx.strokeStyle = '#c68a3f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.quadraticCurveTo(10, -this.radius - 14, 4, -this.radius - 22);
    ctx.stroke();

    // spark
    ctx.fillStyle = `rgba(255,${200 + Math.floor(pulse * 55)},80,1)`;
    ctx.beginPath();
    ctx.arc(4, -this.radius - 22, 4 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function spawnBomb(canvasW, canvasH, speedMultiplier = 1) {
  const x = canvasW * 0.15 + Math.random() * canvasW * 0.7;
  const y = canvasH + 60;
  const targetHeight = canvasH * (0.25 + Math.random() * 0.4);
  const vy = -Math.sqrt(2 * Physics.GRAVITY * (canvasH + 60 - targetHeight)) * speedMultiplier;
  const vx = (Math.random() * 2 - 1) * 140 * speedMultiplier;
  return new Bomb(x, y, vx, vy, canvasW, canvasH);
}
