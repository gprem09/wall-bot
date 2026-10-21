const alpha = (dt, cutoff) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

export class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.5, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.x = null;
    this.dx = 0;
    this.t = 0;
  }

  filter(x, t) {
    if (this.x === null) {
      this.x = x;
      this.t = t;
      return x;
    }
    const dt = Math.max(t - this.t, 1e-3);
    this.t = t;
    const dx = (x - this.x) / dt;
    this.dx += alpha(dt, this.dCutoff) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(dt, cutoff) * (x - this.x);
    return this.x;
  }
}
