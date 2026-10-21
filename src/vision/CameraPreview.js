const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [15, 19], [16, 20], [23, 25], [24, 26], [25, 27], [26, 28],
];

export class CameraPreview {
  constructor({ tracker, gestures, settings }) {
    this.tracker = tracker;
    this.gestures = gestures;
    this.settings = settings;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cam-preview';
    this.canvas.width = 320;
    this.canvas.height = 240;
    this.ctx = this.canvas.getContext('2d');
    document.body.appendChild(this.canvas);
    tracker.onResult(() => this.draw());
  }

  update() {
    this.canvas.style.display = this.settings.showPreview && this.tracker.running ? 'block' : 'none';
  }

  draw() {
    if (!this.settings.showPreview || !this.tracker.running) return;
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const mirror = this.settings.camMirror;
    const X = (x) => (mirror ? 1 - x : x) * W;

    ctx.save();
    if (mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.globalAlpha = 0.55;
    ctx.drawImage(this.tracker.source, 0, 0, W, H);
    ctx.restore();

    const lm = this.gestures.landmarks;
    if (lm) {
      ctx.strokeStyle = '#4de6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [a, b] of BONES) {
        if ((lm[a].visibility ?? 0) < 0.4 || (lm[b].visibility ?? 0) < 0.4) continue;
        ctx.moveTo(X(lm[a].x), lm[a].y * H);
        ctx.lineTo(X(lm[b].x), lm[b].y * H);
      }
      ctx.stroke();
    }

    const s = this.gestures.state;
    const left = this.settings.camXMin * W;
    const right = this.settings.camXMax * W;
    ctx.fillStyle = 'rgba(255,64,204,0.8)';
    ctx.fillRect(left, 0, 1.5, H);
    ctx.fillRect(right, 0, 1.5, H);
    if (s.present) {
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(left + s.bodyU * (right - left) - 2, H - 14, 4, 14);
    }
    if (s.hand) {
      ctx.fillStyle = '#ff5c9a';
      ctx.beginPath();
      ctx.arc(left + s.hand.u * (right - left), (1 - s.hand.v) * H, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '12px ui-monospace, monospace';
    const q = this.tracker.quality;
    const status = q === 'dark' ? 'TOO DARK' : s.present ? 'PRESENT' : 'nobody';
    ctx.fillStyle = q === 'dark' || q === 'stalled' ? '#ff6b6b' : q === 'dim' ? '#ffd166' : '#fff';
    ctx.fillText(`${status}  ${this.tracker.fps.toFixed(0)} fps  ${q}  ${this.gestures.lastEvent}`, 6, 14);
  }
}
