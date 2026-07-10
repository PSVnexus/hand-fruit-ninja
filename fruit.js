/**
 * fruit.js
 * Fruit entity: launches from the bottom of the screen along a ballistic arc,
 * spins as it flies, and can be split into two independently-animated halves
 * when sliced. Fruits are drawn procedurally (gradients + simple shapes) so
 * the whole game is self-contained with no image assets to load.
 */

const FRUIT_TYPES = [
  { name: 'apple', radius: 46, color: '#ff4d4d', dark: '#b30000', accent: '#7ac74f', points: 1 },
  { name: 'orange', radius: 48, color: '#ff9f1c', dark: '#c96e00', accent: '#ffd166', points: 1 },
  { name: 'watermelon', radius: 58, color: '#2ec4b6', dark: '#0f8b7a', accent: '#ff4d6d', points: 1 },
  { name: 'plum', radius: 40, color: '#9b5de5', dark: '#5e2b91', accent: '#c8a2e8', points: 1 },
  { name: 'lemon', radius: 42, color: '#ffe066', dark: '#e0b800', accent: '#fff3b0', points: 1 },
  { name: 'golden', radius: 44, color: '#ffd700', dark: '#b8860b', accent: '#fff4c2', points: 5, golden: true }
];

let fruitIdCounter = 0;

class Fruit {
  constructor(x, y, vx, vy, type, canvasW, canvasH) {
    this.id = ++fruitIdCounter;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.type = type;
    this.radius = type.radius;
    this.rotation = Math.random() * Math.PI * 2;
    this.angularVelocity = (Math.random() * 2 - 1) * 2.4;
    this.sliced = false;
    this.dead = false;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.spawnTime = performance.now();
    // half-fruit animation state (only used after slicing, see split())
    this.isHalf = false;
  }

  update(dt) {
    Physics.step(this, dt, { gravityScale: 1, drag: 0.999 });
    if (this.isHalf) {
      this.halfLife -= dt;
      if (this.halfLife <= 0) this.dead = true;
    }
    // fell off bottom
    if (this.y - this.radius > this.canvasH + 40) {
      this.dead = true;
      this.fellOffScreen = !this.sliced;
    }
    return !this.dead;
  }

  containsPoint(px, py) {
    return Physics.dist(px, py, this.x, this.y) <= this.radius;
  }

  /**
   * Splits this fruit into two half-fruit objects that fly apart along the
   * perpendicular of the swipe direction, each spinning and fading out.
   * Returns an array of two new Fruit instances flagged isHalf=true.
   */
  split(swipeDirX, swipeDirY) {
    this.sliced = true;
    // normal perpendicular to swipe direction determines how halves separate
    const len = Math.hypot(swipeDirX, swipeDirY) || 1;
    const nx = -swipeDirY / len;
    const ny = swipeDirX / len;
    const kick = 120 + Math.random() * 60;
    const halves = [];
    for (const sign of [-1, 1]) {
      const half = new Fruit(this.x, this.y, this.vx + nx * kick * sign, this.vy + ny * kick * sign - 40, this.type, this.canvasW, this.canvasH);
      half.isHalf = true;
      half.halfSign = sign;
      half.sliceAngle = Math.atan2(swipeDirY, swipeDirX);
      half.rotation = this.rotation;
      half.angularVelocity = this.angularVelocity + sign * (2 + Math.random() * 2);
      half.halfLife = 1.1;
      half.sliced = true; // halves are never collidable / never count as a miss
      halves.push(half);
    }
    return halves;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // drop shadow
    if (!this.isHalf) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(4, this.radius * 0.35, this.radius * 0.9, this.radius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const t = this.type;
    const alpha = this.isHalf ? Physics.clamp(this.halfLife / 1.1, 0, 1) : 1;
    ctx.globalAlpha = alpha;

    if (this.isHalf) {
      // draw only one semicircle (a "half" of the fruit) clipped along the slice angle
      ctx.rotate(-this.rotation); // undo, we want clip relative to slice angle not spin
      ctx.rotate(this.sliceAngle);
      ctx.beginPath();
      ctx.rect(this.halfSign > 0 ? 0 : -this.radius * 1.4, -this.radius * 1.4, this.radius * 1.4, this.radius * 2.8);
      ctx.clip();
      ctx.rotate(-this.sliceAngle);
      ctx.rotate(this.rotation);
    }

    const grad = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.1, 0, 0, this.radius);
    grad.addColorStop(0, t.golden ? '#fffbe0' : lightenHex(t.color, 0.35));
    grad.addColorStop(0.6, t.color);
    grad.addColorStop(1, t.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    if (t.golden) {
      ctx.save();
      ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(performance.now() / 120));
      ctx.strokeStyle = '#fff8c4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // flesh cross-section shown on cut faces
    if (this.isHalf) {
      ctx.rotate(-this.rotation);
      ctx.rotate(this.sliceAngle);
      ctx.fillStyle = t.accent;
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(0, this.radius);
      ctx.lineTo(this.halfSign > 0 ? this.radius * 0.15 : -this.radius * 0.15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-this.sliceAngle);
      ctx.rotate(this.rotation);
    } else {
      // stem + leaf for whole fruit
      ctx.fillStyle = '#5b3a29';
      ctx.fillRect(-3, -this.radius - 10, 6, 12);
      ctx.fillStyle = t.accent;
      ctx.beginPath();
      ctx.ellipse(10, -this.radius - 6, 10, 5, -0.5, 0, Math.PI * 2);
      ctx.fill();
      // highlight
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-this.radius * 0.35, -this.radius * 0.35, this.radius * 0.22, this.radius * 0.12, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function lightenHex(hex, amt) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  let r = (num >> 16) + Math.round(255 * amt);
  let g = ((num >> 8) & 0xff) + Math.round(255 * amt);
  let b = (num & 0xff) + Math.round(255 * amt);
  r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
  return `rgb(${r},${g},${b})`;
}

/**
 * Spawns a fruit from a random bottom position with an upward launch
 * velocity tuned so it arcs into (and back out of) the visible play area.
 */
function spawnFruit(canvasW, canvasH, speedMultiplier = 1) {
  const type = pickFruitType();
  const x = canvasW * 0.15 + Math.random() * canvasW * 0.7;
  const y = canvasH + 60;
  const targetHeight = canvasH * (0.25 + Math.random() * 0.45);
  // vy needed to reach targetHeight above launch point: v^2 = 2*g*h
  const vy = -Math.sqrt(2 * Physics.GRAVITY * (canvasH + 60 - targetHeight)) * speedMultiplier;
  const vx = (Math.random() * 2 - 1) * 140 * speedMultiplier;
  return new Fruit(x, y, vx, vy, type, canvasW, canvasH);
}

function pickFruitType() {
  const roll = Math.random();
  if (roll < 0.04) return FRUIT_TYPES.find(f => f.golden);
  const normal = FRUIT_TYPES.filter(f => !f.golden);
  return normal[Math.floor(Math.random() * normal.length)];
}
