import { OneEuroFilter } from './OneEuroFilter.js';

const NOSE = 0;
const ARMS = {
  left: { shoulder: 11, elbow: 13, wrist: 15, index: 19 },
  right: { shoulder: 12, elbow: 14, wrist: 16, index: 20 },
};

const ENTER_DELAY = 0.35;
const LEAVE_DELAY = 2.0;
const ENTER_CONF = 0.5;
const STAY_CONF = 0.3;
const JUMP = 0.25;
const JUMP_CONFIRM = 0.3;

const WAVE_WINDOW = 1.8;
const WAVE_SWINGS = 3;
const WAVE_COOLDOWN = 3;
const WAVE_VIS = 0.3;
const WAVE_DROPOUT = 0.35;
const HELLO_HOLD = 1.0;
const HAND_ON = 0.15;
const HAND_OFF = 0.35;
const vis = (l) => l?.visibility ?? 0;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function newArm() {
  return {
    rel: null, dir: 0, peak: 0, cand: 0, swings: [], lostFor: 0, downFor: 0,
    helloTime: 0, helloArmed: true,
  };
}

function resetWave(a) {
  a.swings.length = 0;
  a.dir = 0;
  a.rel = null;
}

export class GestureRecognizer {
  constructor(settings) {
    this.settings = settings;
    this.blind = false;
    this.present = false;
    this.seenSince = null;
    this.lostSince = null;
    this.lastT = 0;
    this.events = [];
    this.lastEvent = '';
    this.landmarks = null;
    this.state = { present: false, bodyU: 0.5, headV: 0.8, hand: null };
    this.filters = {
      body: new OneEuroFilter(0.8, 1.5),
      head: new OneEuroFilter(0.8, 1.5),
      handU: new OneEuroFilter(1.2, 3),
      handV: new OneEuroFilter(1.2, 3),
    };
    this.arms = { left: newArm(), right: newArm() };
    this.jumpSince = null;
    this.hand = { raw: null, raisedFor: 0, loweredFor: 0 };
    this.waveCooldown = 0;
  }

  mapU(x) {
    const s = this.settings;
    const m = s.camMirror ? 1 - x : x;
    return clamp01((m - s.camXMin) / Math.max(s.camXMax - s.camXMin, 0.05));
  }

  consumeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  #emit(event) {
    this.events.push(event);
    this.lastEvent = event.type + (event.held ? ' (hand up)' : '');
  }

  #resetPerson() {
    this.arms = { left: newArm(), right: newArm() };
    Object.values(this.filters).forEach((f) => f.reset());
    this.jumpSince = null;
    this.hand = { raw: null, raisedFor: 0, loweredFor: 0 };
    this.state.hand = null;
  }

  update(lm, tMs, aspect = 4 / 3) {
    const t = tMs / 1000;
    const dt = this.lastT ? Math.min(t - this.lastT, 0.2) : 1 / 30;
    this.lastT = t;
    this.landmarks = lm;

    const shoulders = lm ? Math.min(vis(lm[11]), vis(lm[12])) : 0;
    const visible = !!lm && (this.present ? Math.max(shoulders, vis(lm[NOSE])) > STAY_CONF : shoulders > ENTER_CONF);
    if (visible) {
      this.lostSince = null;
      this.seenSince ??= t;
      if (!this.present && t - this.seenSince > ENTER_DELAY) {
        this.present = true;
        this.#emit({ type: 'enter' });
      }
    } else {
      this.seenSince = null;
      if (this.blind) this.lostSince = null;
      else this.lostSince ??= t;
      if (this.present && this.lostSince !== null && t - this.lostSince > LEAVE_DELAY) {
        this.present = false;
        this.#emit({ type: 'leave' });
        this.#resetPerson();
      }
    }
    this.state.present = this.present;
    if (!visible || !this.present) {
      this.#updateHand(null, t, dt);
      return;
    }

    const P = (i) => ({ x: lm[i].x * aspect, y: lm[i].y, v: vis(lm[i]), rawX: lm[i].x });
    const ls = P(11);
    const rs = P(12);
    const nose = P(NOSE);
    const sw = Math.max(Math.hypot(ls.x - rs.x, ls.y - rs.y), 0.03);
    const torsoX = (ls.x + rs.x) / 2;

    const u = this.mapU((lm[11].x + lm[12].x) / 2);
    const prev = this.filters.body.x;
    if (prev !== null && Math.abs(u - prev) > JUMP) {
      this.jumpSince ??= t;
      if (t - this.jumpSince < JUMP_CONFIRM) return;
      this.filters.body.reset();
    }
    this.jumpSince = null;
    this.state.bodyU = this.filters.body.filter(u, t);
    this.state.headV = this.filters.head.filter(1 - lm[NOSE].y, t);

    const res = {};
    for (const side of ['left', 'right']) {
      const idx = ARMS[side];
      res[side] = this.#updateArm(this.arms[side], P(idx.shoulder), P(idx.elbow), P(idx.wrist), P(idx.index), nose, torsoX, sw, t, dt);
    }
    if (this.settings.raisedHandGreets && !(res.left.high && res.right.high)) {
      for (const side of ['left', 'right']) {
        const a = this.arms[side];
        if (a.helloTime > HELLO_HOLD && a.helloArmed && t > this.waveCooldown) {
          this.#emit({ type: 'wave', held: true });
          this.waveCooldown = t + WAVE_COOLDOWN;
          a.helloArmed = false;
        }
      }
    }

    const best = [res.left, res.right].filter((r) => r.raised).sort((a, b) => b.height - a.height)[0] ?? null;
    this.#updateHand(best, t, dt);
  }

  #updateHand(best, t, dt) {
    const h = this.hand;
    if (best) {
      h.raisedFor += dt;
      h.loweredFor = 0;
      h.raw = best;
    } else {
      h.loweredFor += dt;
      h.raisedFor = 0;
    }
    const show = this.state.hand ? h.loweredFor < HAND_OFF : h.raisedFor > HAND_ON;
    if (show && h.raw) {
      this.state.hand = { u: this.filters.handU.filter(h.raw.u, t), v: this.filters.handV.filter(h.raw.v, t) };
    } else {
      this.state.hand = null;
      this.filters.handU.reset();
      this.filters.handV.reset();
    }
  }

  #updateArm(a, s, e, w, idx, nose, torsoX, sw, t, dt) {
    if (w.v < WAVE_VIS) {
      a.lostFor += dt;
      if (a.lostFor > WAVE_DROPOUT) resetWave(a);
      a.helloTime = 0;
      return { raised: false, high: false };
    }
    a.lostFor = 0;

    const elbowOk = e.v > WAVE_VIS;
    const high = nose.v > 0.3 && w.y < nose.y;

    let outstretched = false;
    if (elbowOk) {
      const ux = s.x - e.x, uy = s.y - e.y, vx = w.x - e.x, vy = w.y - e.y;
      const cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) + 1e-6);
      const straight = cos < Math.cos((140 * Math.PI) / 180);
      const horizontal = Math.abs(w.y - s.y) < 0.7 * sw;
      const extended = Math.abs(w.x - s.x) > 1.0 * sw;
      outstretched = straight && horizontal && extended;
    }

    const up = !outstretched && (w.y < s.y + 0.4 * sw || (elbowOk && w.y < e.y));

    if (up) {
      a.downFor = 0;
      const raw = (w.x - torsoX) / sw;
      a.rel = a.rel === null ? raw : a.rel + (raw - a.rel) * 0.6;
      const rel = a.rel;
      const threshold = 0.2 / this.settings.waveSensitivity;
      if (a.dir === 0) {
        a.dir = 1;
        a.peak = a.cand = rel;
      } else {
        const v = rel - a.cand;
        if (Math.sign(v) === a.dir || Math.abs(v) < 0.02) {
          if (a.dir * v > 0) a.cand = rel;
        } else {
          if (Math.abs(a.cand - a.peak) > threshold) {
            a.swings.push(t);
            a.peak = a.cand;
          }
          a.dir = -a.dir;
          a.cand = rel;
        }
      }
      a.swings = a.swings.filter((st) => t - st < WAVE_WINDOW);
      if (a.swings.length >= WAVE_SWINGS) {
        if (t > this.waveCooldown) {
          this.#emit({ type: 'wave' });
          this.waveCooldown = t + WAVE_COOLDOWN;
          a.helloArmed = false;
        }
        a.swings.length = 0;
      }
    } else {
      a.downFor += dt;
      if (a.downFor > 0.25) resetWave(a);
    }

    a.helloTime = high ? a.helloTime + dt : 0;
    if (!up) a.helloArmed = true;
    const raised = w.y < s.y + 0.3 * sw && (!elbowOk || w.y < e.y);
    const tip = idx.v > 0.4 ? idx : w;
    return { raised, high, height: s.y - w.y, u: this.mapU(tip.rawX), v: 1 - tip.y };
  }
}
