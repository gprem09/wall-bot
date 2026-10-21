import * as THREE from 'three';

const W = 1024;
const H = 512;
const FONT = '600 54px "SF Pro Rounded", "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';
const LINE_H = 68;
const PAD = 40;
const MAX_TEXT_W = W - 2 * PAD - 60;
const TAIL = 56;
const MARGIN = 16;
const CPS = 30;
const WORLD_W = 2.6;

const easeOutBack = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;

export class SpeechBubble {
  constructor(scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, H / W), this.material);
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.chars = [];
    this.shown = 0;
    this.t = 0;
    this.fade = 0;
    this.side = 1;
    this.size = 1;
  }

  get active() {
    return this.mesh.visible;
  }

  get typing() {
    return this.active && !this.fade && this.shown < this.chars.length;
  }

  get duration() {
    return this.#durationFor(this.chars);
  }

  #durationFor(chars) {
    const words = chars.join('').split(/\s+/).length;
    return 0.3 + chars.length / CPS + Math.max(2.8, words * 0.32) + 0.5;
  }

  show(text, side, autoHide = false) {
    this.chars = Array.from(text);
    this.side = side;
    this.shown = -1;
    this.t = 0;
    this.fade = 0;
    this.hideAt = autoHide ? this.#durationFor(this.chars) : Infinity;
    this.#layout();
    this.#draw(0);
    this.mesh.visible = true;
  }

  hide() {
    if (this.active && !this.fade) this.fade = 0.0001;
  }

  update(dt, anchor, scale, halfWidth, halfHeight) {
    if (!this.active) return;
    this.t += dt;
    if (this.t > this.hideAt) this.hide();

    const n = Math.min(this.chars.length, Math.max(0, Math.floor((this.t - 0.3) * CPS)));
    if (n !== this.shown) this.#draw(n);

    let alpha = 1;
    if (this.fade) {
      this.fade += dt;
      alpha = 1 - this.fade / 0.35;
      if (alpha <= 0) {
        this.mesh.visible = false;
        return;
      }
    }

    const pop = easeOutBack(Math.min(this.t / 0.35, 1));
    const ww = WORLD_W * this.size * Math.max(0.75, Math.min(1.2, scale / 0.55));
    const k = ww / W;
    const s = ww * pop * (this.fade ? 1 - 0.15 * this.fade / 0.35 : 1);
    this.mesh.scale.set(s, s, 1);
    this.material.opacity = alpha;

    const [tipX, tipY] = this.tip;
    let x = anchor.x + (W / 2 - tipX) * k * pop;
    let y = anchor.y + (tipY - H / 2) * k * pop + Math.sin(this.t * 1.6) * 0.012;
    const { x0, x1, y0 } = this.box;
    const left = x + (x0 - W / 2) * k;
    const right = x + (x1 - W / 2) * k;
    if (left < -halfWidth) x += -halfWidth - left;
    if (right > halfWidth) x -= right - halfWidth;
    const top = y + (H / 2 - y0) * k;
    if (top > halfHeight) y -= top - halfHeight;
    this.mesh.position.set(x, y, anchor.z);
  }

  #layout() {
    const ctx = this.ctx;
    ctx.font = FONT;
    const words = this.chars.join('').split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(next).width > MAX_TEXT_W) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    this.lines = lines;
    this.lineStarts = [];
    let i = 0;
    for (const l of lines) {
      this.lineStarts.push(i);
      i += Array.from(l).length + 1;
    }

    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 200);
    const bw = textW + 2 * PAD;
    const bh = lines.length * LINE_H + 2 * PAD - 12;
    const right = this.side > 0;
    const x0 = right ? MARGIN + 24 : W - MARGIN - 24 - bw;
    const y0 = H - MARGIN - TAIL - bh;
    this.box = { x0, x1: x0 + bw, y0, y1: y0 + bh };
    this.tip = right ? [MARGIN, H - MARGIN] : [W - MARGIN, H - MARGIN];
  }

  #draw(n) {
    this.shown = n;
    const { ctx } = this;
    const { x0, x1, y0, y1 } = this.box;
    const r = 34;
    const right = this.side > 0;
    const [tx, ty] = this.tip;
    const baseA = right ? x0 + 40 : x1 - 110;
    const baseB = baseA + 70;

    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x1, y0, x1, y1, r);
    ctx.arcTo(x1, y1, x0, y1, r);
    ctx.lineTo(baseB, y1);
    ctx.lineTo(tx, ty);
    ctx.lineTo(baseA, y1);
    ctx.arcTo(x0, y1, x0, y0, r);
    ctx.arcTo(x0, y0, x1, y0, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(77, 230, 255, 0.8)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#4de6ff';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = FONT;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f2fbff';
    this.lines.forEach((line, i) => {
      const visible = Array.from(line).slice(0, Math.max(0, n - this.lineStarts[i])).join('');
      if (visible) ctx.fillText(visible, x0 + PAD, y0 + PAD + i * LINE_H - 4);
    });
    if (n < this.chars.length) {
      const i = this.lines.findLastIndex((_, k) => this.lineStarts[k] <= n);
      const visible = Array.from(this.lines[i]).slice(0, Math.max(0, n - this.lineStarts[i])).join('');
      ctx.fillStyle = '#4de6ff';
      ctx.fillRect(x0 + PAD + ctx.measureText(visible).width + 6, y0 + PAD + i * LINE_H + 2, 6, 50);
    }
    this.texture.needsUpdate = true;
  }
}
