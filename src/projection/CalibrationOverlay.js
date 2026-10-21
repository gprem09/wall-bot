import { DEFAULTS } from '../core/Settings.js';

const LABELS = ['bottom-left', 'bottom-right', 'top-right', 'top-left'];

export class CalibrationOverlay {
  constructor({ settings, pass, onChange }) {
    this.settings = settings;
    this.pass = pass;
    this.onChange = onChange;
    this.active = false;

    this.root = document.createElement('div');
    this.root.className = 'calib';
    this.root.innerHTML = `<div class="calib-help">
      <b>Projection calibration</b><br>
      Drag the corner handles onto the edges of your wall area.<br>
      <span style="color:#ff9a26">orange</span> = floor line,
      <span style="color:#ff40cc">pink</span> = movement bounds (adjust in the Projection panel).<br>
      Press <b>C</b> to finish.
    </div>`;
    this.handles = LABELS.map((label, i) => {
      const h = document.createElement('div');
      h.className = 'calib-handle';
      h.title = label;
      h.addEventListener('pointerdown', (e) => this.#startDrag(e, i));
      this.root.appendChild(h);
      return h;
    });
    document.body.appendChild(this.root);

    pass.setCorners(settings.corners);
    window.addEventListener('resize', () => this.layout());
  }

  toggle(force = !this.active) {
    this.active = force;
    this.root.style.display = force ? 'block' : 'none';
    document.body.classList.toggle('calibrating', force);
    this.pass.uniforms.uCalib.value = force ? 1 : 0;
    this.layout();
  }

  resetCorners() {
    this.settings.corners = structuredClone(DEFAULTS.corners);
    this.pass.setCorners(this.settings.corners);
    this.layout();
    this.onChange?.();
  }

  layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.settings.corners.forEach(([x, y], i) => {
      this.handles[i].style.left = `${x * w}px`;
      this.handles[i].style.top = `${(1 - y) * h}px`;
    });
  }

  #startDrag(e, index) {
    e.preventDefault();
    const handle = this.handles[index];
    handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const x = Math.min(1.25, Math.max(-0.25, ev.clientX / window.innerWidth));
      const y = Math.min(1.25, Math.max(-0.25, 1 - ev.clientY / window.innerHeight));
      this.settings.corners[index] = [x, y];
      this.pass.setCorners(this.settings.corners);
      this.layout();
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      this.onChange?.();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  }
}
