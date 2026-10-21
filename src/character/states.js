const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const env = (t, a, b, fade = 0.25) => smooth(a, a + fade, t) * (1 - smooth(b - fade, b, t));
const hop = (t, start, dur, h) => {
  const k = (t - start) / dur;
  return k > 0 && k < 1 ? 4 * h * k * (1 - k) : 0;
};
const dip = (t, at, depth, width = 0.12) => depth * Math.max(0, 1 - Math.abs(t - at) / width);
const then = (p, fallback = 'idle') => p.then ?? fallback;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const IDLE_FACES = ['uwu', 'smug', 'deadpan', 'nervous', 'pouty', 'love'];
const WALK_FACES = ['neutral', 'neutral', 'happy', 'uwu', 'smug'];

function jump(c, t, start, dur, height) {
  c.overlay.bodyY += hop(t, start, dur, height);
  c.overlay.crouch += dip(t, start - 0.04, 0.07) + dip(t, start + dur + 0.04, 0.06);
}

function sideToward(c) {
  if (c.attention) return c.attention.x > c.loco.x ? 'L' : 'R';
  return Math.random() < 0.5 ? 'L' : 'R';
}

const GESTURES = {
  point(c, t, { S, sign }, on) {
    c.target[`armRaise${S}`] = 1.35 * on;
    c.target[`armSwing${S}`] = 0.55 * on;
    c.target[`elbow${S}`] = 0.2 * on;
    c.overlay[`armRaise${S}`] = Math.sin(t * 5) * 0.06 * on;
    c.target.headRoll = 0.1 * sign * on;
  },
  wave(c, t, { S, sign }, on) {
    const up = on * env(t, 0, 2.6, 0.35);
    c.target[`armRaise${S}`] = 2.5 * up;
    c.target[`elbow${S}`] = 0.5 * up;
    c.target[`armSwing${S}`] = 0.25 * up;
    c.overlay[`armRaise${S}`] = Math.sin(t * 9) * 0.22 * up;
    c.overlay[`wrist${S}`] = Math.sin(t * 9 + 0.6) * 0.45 * up;
    c.target.headRoll = 0.12 * sign * on;
  },
  flex(c, t, g, on) {
    const pump = 0.5 + 0.5 * Math.sin(t * 5);
    for (const k of ['L', 'R']) {
      c.target[`armRaise${k}`] = 1.45 * on;
      c.target[`armTwist${k}`] = 1.5 * on;
      c.target[`elbow${k}`] = (1.5 + 0.4 * pump) * on;
    }
    c.overlay.crouch = 0.02 * pump * on;
    c.target.torsoPitch = -0.05 * on;
  },
  drink(c, t, { O }, on) {
    const sip = on * env(t, 0.3, 3.2, 0.5);
    c.target[`armSwing${O}`] = (1.2 + 0.25 * sip) * on;
    c.target[`armRaise${O}`] = 0.25 * on;
    c.target[`elbow${O}`] = 1.9 * on + 0.35 * sip;
    c.target.headPitch = -0.22 * sip;
    c.lookHint = sip > 0.5 ? [0, 0.6] : null;
  },
  stretch(c, t, g, on) {
    const up = on * env(t, 0.2, 3.4, 0.6);
    c.target.armRaiseL = c.target.armRaiseR = 2.7 * up;
    c.target.elbowL = c.target.elbowR = 0.15 * up;
    c.target.torsoRoll = Math.sin(t * 1.4) * 0.12 * up;
    c.target.torsoPitch = -0.08 * up;
    c.target.headPitch = -0.2 * up;
  },
  think(c, t, { O, sign }, on) {
    c.target[`armSwing${O}`] = 1.3 * on;
    c.target[`elbow${O}`] = 1.9 * on;
    c.target[`armRaise${O}`] = -0.1 * on;
    c.target.headRoll = 0.28 * sign * on;
    c.target.torsoPitch = 0.1 * on;
    c.overlay.headRoll = Math.sin(t * 3) * 0.04 * on;
  },
  shrug(c, t, { sign }, on) {
    const up = env(t % 2.2, 0.2, 1.6, 0.35) * on;
    c.target.armRaiseL = c.target.armRaiseR = 0.5 * up;
    c.target.armSwingL = c.target.armSwingR = 0.35 * up;
    c.target.elbowL = c.target.elbowR = 1.3 * up;
    c.target.headRoll = 0.2 * sign * up;
  },
  bounce(c, t, g, on) {
    c.overlay.bodyY = Math.abs(Math.sin(t * 7)) * 0.05 * on;
    c.target.armRaiseL = c.target.armRaiseR = 1.0 * on;
    c.overlay.armRaiseL = Math.sin(t * 7) * 0.4 * on;
    c.overlay.armRaiseR = -Math.sin(t * 7) * 0.4 * on;
    c.target.elbowL = c.target.elbowR = 0.9 * on;
  },
  breathe(c, t, g, on) {
    const b = (0.5 - 0.5 * Math.cos(t * 1.4)) * on;
    c.target.armRaiseL = c.target.armRaiseR = 1.2 * b;
    c.target.elbowL = c.target.elbowR = 0.3 * b;
    c.target.headPitch = -0.15 * b;
    c.overlay.bodyY = 0.015 * b;
  },
  nod(c, t, { sign }, on) {
    c.overlay.headPitch = Math.max(0, Math.sin(t * 6)) * 0.14 * env(t, 0.2, 1.8, 0.2) * on;
    c.target.headRoll = 0.1 * sign * on;
    c.target.armSwingL = c.target.armSwingR = 0.2 * on;
    c.target.elbowL = c.target.elbowR = 0.6 * on;
  },
  salute(c, t, { O, sign }, on) {
    c.target[`armRaise${O}`] = 1.5 * on;
    c.target[`armSwing${O}`] = 0.35 * on;
    c.target[`armTwist${O}`] = 1.5 * on;
    c.target[`elbow${O}`] = 2.3 * on;
    c.target.torsoPitch = -0.06 * on;
    c.target.headRoll = -0.06 * sign * on;
  },
};

export const GESTURE_NAMES = Object.keys(GESTURES);

export const STATES = {
  boot: {
    priority: 9,
    autoLook: false,
    blink: false,
    enter(c) {
      c.robot.power = 0;
      c.face.setExpression('asleep');
    },
    update(c, dt, t) {
      const flicker = t < 1.1 ? (Math.sin(t * 37) > 0.2 ? 1 : 0.25) : 1;
      c.robot.power = smooth(0.15, 1.5, t) * flicker;
      c.poseRate = 4;
      c.target.headPitch = t < 1.3 ? 0.4 : 0;
      c.target.crouch = t < 1.3 ? 0.05 : 0.01;
      c.target.armSwingL = c.target.armSwingR = t < 1.3 ? 0.15 : 0;
      if (t > 1.3 && c.face.expression === 'asleep') c.face.setExpression('neutral');
      if (t > 2.4) return { name: 'wave', params: { then: 'idle' } };
    },
    exit(c) {
      c.robot.power = 1;
    },
  },

  idle: {
    priority: 0,
    enter(c, p, s) {
      s.baseExpr = c.socialMode ? 'neutral' : c.brain.idleExpression();
      c.face.setExpression(s.baseExpr);
      s.duration = p.duration ?? rand(4, 9);
      s.fidget = null;
      s.nextFidget = rand(1.5, 4);
    },
    update(c, dt, t, s) {
      c.target.torsoRoll = Math.sin(t * 0.5) * 0.025;
      c.target.crouch = 0.01 + 0.006 * Math.sin(t * 0.9);

      s.nextFidget -= dt;
      if (!s.fidget && s.nextFidget <= 0) {
        s.fidget = { type: pick(['tilt', 'tilt', 'lookBack', 'shrug', 'hands', 'sway', 'face', 'face']), t0: t, dur: rand(1.4, 2.4), side: Math.random() < 0.5 ? -1 : 1 };
        if (s.fidget.type === 'face') {
          s.fidget.dur = rand(1.8, 2.8);
          c.face.setExpression(pick(IDLE_FACES));
        }
      }
      if (s.fidget) {
        const f = s.fidget;
        const k = (t - f.t0) / f.dur;
        if (k >= 1) {
          if (f.type === 'face') c.face.setExpression(s.baseExpr);
          s.fidget = null;
          s.nextFidget = rand(2, 5);
        } else {
          if (f.type === 'face') c.target.headRoll += 0.15 * f.side * Math.sin(k * Math.PI);
          const e = Math.sin(k * Math.PI);
          if (f.type === 'tilt') c.target.headRoll += 0.3 * f.side * e;
          if (f.type === 'lookBack') {
            c.target.headYaw += 0.75 * f.side * e;
            c.lookHint = [f.side * 0.8 * e, 0.1];
          }
          if (f.type === 'shrug') {
            c.target.armRaiseL += 0.3 * e;
            c.target.armRaiseR += 0.3 * e;
            c.target.headRoll += 0.12 * f.side * e;
          }
          if (f.type === 'hands') {
            c.target.armSwingL = c.target.armSwingR = 0.55 * e;
            c.target.elbowL = c.target.elbowR = 1.0 * e;
            c.target.headPitch += 0.3 * e;
            c.lookHint = [0, -0.7 * e];
          }
          if (f.type === 'sway') {
            c.target.torsoRoll += 0.08 * f.side * Math.sin(k * Math.PI * 2);
            c.target.headRoll -= 0.1 * f.side * Math.sin(k * Math.PI * 2);
          }
        }
      }
      if (t > s.duration) return c.brain.nextAction(c);
    },
  },

  walk: {
    priority: 1,
    enter(c, p) {
      c.loco.walkTo(p.x ?? c.loco.x);
      c.face.setExpression(p.mood ?? pick(WALK_FACES));
    },
    update(c, dt, t, s, p) {
      c.target.torsoPitch = 0.05;
      if (!c.attention) c.lookHint = [-Math.sign(c.loco.speed) * 0.35, -0.05];
      if (c.loco.arrived && t > 0.3) return then(p);
      if (t > 15) return 'idle';
    },
    exit(c) {
      c.loco.stop();
    },
  },

  happy: {
    priority: 2,
    enter(c) {
      c.face.setExpression('joy');
      c.emote('heart', 0.6);
    },
    update(c, dt, t, s, p) {
      c.poseRate = 10;
      c.led.level = 1.3;
      c.led.pulse = 5;
      if (t > 1.5 && c.face.expression === 'joy') c.face.setExpression('happy');
      jump(c, t, 0.35, 0.42, 0.16);
      jump(c, t, 1.05, 0.42, 0.16);
      const up = env(t, 0.2, 2.4, 0.3);
      c.target.armRaiseL = c.target.armRaiseR = 2.3 * up;
      c.target.elbowL = c.target.elbowR = 0.4 * up;
      c.overlay.wristL = Math.sin(t * 12) * 0.4 * up;
      c.overlay.wristR = -Math.sin(t * 12) * 0.4 * up;
      c.target.headPitch = -0.12 * up;
      if (t > 1.8 && !s.second) {
        s.second = true;
        c.emote('heart', -0.6);
      }
      if (t > 3) return then(p);
    },
  },

  sad: {
    priority: 2,
    enter(c) {
      c.face.setExpression('sad');
    },
    update(c, dt, t, s, p) {
      c.poseRate = 3;
      c.led.level = 0.5;
      c.led.pulse = 1;
      if (t > 1.3 && c.face.expression === 'sad') c.face.setExpression('crying');
      const crying = c.face.expression === 'crying';
      c.target.headPitch = crying ? 0.18 : 0.45;
      c.target.torsoPitch = 0.14;
      c.target.crouch = 0.03;
      c.target.armSwingL = c.target.armSwingR = 0.15;
      c.target.armRaiseL = c.target.armRaiseR = -0.08;
      c.target.headRoll = 0.1 * Math.sin(t * 0.7);
      c.overlay.bodyY = -0.012 * env(t, 1.5, 2.6, 0.5);
      c.lookHint = crying ? [0.15 * Math.sin(t * 0.5), -0.2] : [0.2 * Math.sin(t * 0.5), -0.8];
      if (t > 4.5) return then(p);
    },
  },

  sleepy: {
    priority: 2,
    autoLook: false,
    enter(c) {
      c.face.setExpression('sleepy');
    },
    update(c, dt, t, s, p) {
      c.poseRate = 4;
      c.led.level = 0.7;
      c.led.pulse = 1.2;
      const yawn = env(t, 0.5, 2.6, 0.5);
      c.face.target.mouthOpen = 0.9 * yawn;
      c.face.target.eyeOpen[0] = c.face.target.eyeOpen[1] = 0.28 * (1 - yawn) + 0.05 * yawn;
      c.target.armRaiseL = c.target.armRaiseR = 2.6 * yawn;
      c.target.elbowL = c.target.elbowR = 0.3 * yawn;
      c.target.torsoPitch = -0.1 * yawn;
      c.target.headPitch = -0.25 * yawn;
      if (t > 2.6) {
        const nod = Math.max(0, Math.sin((t - 2.6) * 2.2));
        c.target.headPitch = 0.25 + nod * 0.15;
        c.target.crouch = 0.03;
      }
      if (t > 5.5) return 'sleep';
    },
  },

  sleep: {
    priority: 3,
    autoLook: false,
    blink: false,
    attentive: false,
    enter(c, p, s) {
      c.face.setExpression('asleep');
      s.nextZ = 1.2;
      s.zSide = 1;
    },
    update(c, dt, t, s) {
      c.poseRate = 2.5;
      c.led.level = 0.3;
      c.led.pulse = 0.9;
      c.target.sit = 1;
      c.target.headPitch = 0.5;
      c.target.headRoll = 0.15;
      c.target.torsoPitch = 0.18;
      c.target.armSwingL = c.target.armSwingR = 0.35;
      c.target.elbowL = c.target.elbowR = 0.5;
      s.nextZ -= dt;
      if (s.nextZ <= 0) {
        c.emote('zzz', 0.5);
        s.nextZ = 1.6;
      }
      if (c.allowAutoWake && c.brain.energy >= 1 && t > 20) return 'wake';
    },
  },

  wake: {
    priority: 3,
    autoLook: false,
    enter(c) {
      c.face.setExpression('sleepy');
    },
    update(c, dt, t, s, p) {
      c.poseRate = 3.5;
      c.led.level = 0.4 + smooth(0, 2, t) * 0.6;
      if (t > 1 && c.face.expression === 'sleepy') c.face.setExpression('neutral');
      const stretch = env(t, 1.0, 2.4, 0.4);
      c.target.armRaiseL = c.target.armRaiseR = 2.5 * stretch;
      c.target.torsoPitch = -0.08 * stretch;
      c.target.headPitch = t < 0.6 ? 0.4 : -0.15 * stretch;
      if (t > 3) return then(p);
    },
  },

  curious: {
    priority: 1,
    enter(c, p, s) {
      c.face.setExpression('curious');
      c.emote('question', 0.5);
      s.side = Math.random() < 0.5 ? -1 : 1;
      s.spot = [rand(-0.8, 0.8), rand(-0.3, 0.5)];
    },
    update(c, dt, t, s, p) {
      c.poseRate = 6;
      c.target.headRoll = 0.32 * s.side;
      c.target.torsoPitch = 0.12;
      c.target.headPitch = 0.05;
      c.target.armSwingR = 1.3;
      c.target.elbowR = 1.9;
      c.target.armRaiseR = -0.1;
      c.overlay.headRoll = 0.04 * Math.sin(t * 3);
      if (!c.attention) c.lookHint = s.spot;
      if (t > 4) return then(p);
    },
  },

  surprised: {
    priority: 4,
    enter(c) {
      c.face.setExpression('surprised');
      c.emote('exclaim', 0);
    },
    update(c, dt, t, s, p) {
      c.poseRate = 16;
      c.led.level = 1.5;
      c.target.sit = 0;
      jump(c, t, 0.06, 0.3, 0.12);
      c.target.armRaiseL = c.target.armRaiseR = 1.0;
      c.target.elbowL = c.target.elbowR = 0.9;
      c.target.torsoPitch = -0.12;
      c.target.headPitch = -0.15;
      if (t > 1.6) return then(p);
    },
  },

  excited: {
    priority: 2,
    enter(c) {
      c.face.setExpression(Math.random() < 0.4 ? 'love' : 'excited');
      c.emote('sparkle', 0.6);
    },
    update(c, dt, t, s, p) {
      c.poseRate = 10;
      c.led.level = 1.4;
      c.led.pulse = 7;
      const on = env(t, 0, 3.4, 0.3);
      c.overlay.bodyY = Math.abs(Math.sin(t * 8)) * 0.07 * on;
      c.target.armRaiseL = c.target.armRaiseR = 1.5 * on;
      c.overlay.armRaiseL = Math.sin(t * 8) * 0.6 * on;
      c.overlay.armRaiseR = -Math.sin(t * 8) * 0.6 * on;
      c.target.elbowL = c.target.elbowR = 0.8 * on;
      c.overlay.headRoll = Math.sin(t * 4) * 0.12 * on;
      if (t > 1.6 && !s.second) {
        s.second = true;
        c.emote('sparkle', -0.6);
        c.face.setExpression('joy');
      }
      if (t > 3.5) return then(p);
    },
  },

  wave: {
    priority: 2,
    enter(c, p, s) {
      c.face.setExpression(pick(['happy', 'uwu', 'joy']));
      s.side = p.side ?? sideToward(c);
    },
    update(c, dt, t, s, p) {
      c.poseRate = 9;
      const S = s.side;
      const sign = S === 'L' ? 1 : -1;
      const up = env(t, 0, 2.7, 0.35);
      c.target[`armRaise${S}`] = 2.5 * up;
      c.target[`elbow${S}`] = 0.5 * up;
      c.target[`armSwing${S}`] = 0.25 * up;
      c.overlay[`armRaise${S}`] = Math.sin(t * 9) * 0.22 * up;
      c.overlay[`wrist${S}`] = Math.sin(t * 9 + 0.6) * 0.45 * up;
      c.target.headRoll = 0.15 * sign * up;
      c.target.torsoRoll = -0.05 * sign * up;
      if (t > 2.8) return then(p);
    },
  },

  talk: {
    priority: 2,
    enter(c, p, s) {
      const m = p.message;
      c.loco.stop();
      c.face.setExpression(m.expression ?? 'neutral');
      s.baseMouth = c.face.target.mouthOpen;
      s.side = c.bubbleSide();
      s.arms = s.side > 0 ? { S: 'L', O: 'R', sign: 1 } : { S: 'R', O: 'L', sign: -1 };
      s.gesture = GESTURES[m.gesture] ?? GESTURES.nod;
      c.bubble.show(m.text, s.side);
      s.duration = c.bubble.duration;
      if (m.emote) c.emote(m.emote, -s.side * 0.6);
    },
    update(c, dt, t, s, p) {
      c.poseRate = 7;
      c.led.level = 1.15;
      const on = env(t, 0, s.duration, 0.4);
      s.gesture(c, t, s.arms, on);

      if (c.bubble.typing) {
        c.face.target.mouthOpen = Math.min(1, s.baseMouth * 0.6 + 0.12 + 0.4 * Math.abs(Math.sin(t * 13)));
        c.led.pulse = 13;
      } else c.face.target.mouthOpen = s.baseMouth;

      if (!c.lookHint && !c.attention) c.lookHint = t < 0.9 ? [s.side * 0.7, 0.35] : [0, 0];
      if (t > s.duration) return then(p);
    },
    exit(c) {
      c.bubble.hide();
    },
  },

  dance: {
    priority: 1,
    enter(c, p, s) {
      c.face.setExpression('happy');
      s.nextNote = 0.2;
      s.noteSide = 1;
    },
    update(c, dt, t, s, p) {
      c.poseRate = 12;
      c.led.level = 1.3;
      c.led.pulse = 12.6;
      const beat = t * Math.PI * 4;
      const on = env(t, 0, 6, 0.4);
      c.overlay.crouch = (0.03 + 0.03 * Math.sin(beat)) * on;
      c.overlay.torsoRoll = Math.sin(beat / 2) * 0.12 * on;
      c.overlay.headRoll = -Math.sin(beat / 2) * 0.2 * on;
      c.overlay.torsoYaw = Math.sin(beat / 4) * 0.2 * on;
      c.target.armRaiseL = (1.2 + Math.sin(beat / 2) * 1.0) * on;
      c.target.armRaiseR = (1.2 - Math.sin(beat / 2) * 1.0) * on;
      c.target.elbowL = c.target.elbowR = 0.9 * on;
      c.overlay.legSwingL = Math.max(0, Math.sin(beat / 2)) * 0.25 * on;
      c.overlay.legSwingR = Math.max(0, -Math.sin(beat / 2)) * 0.25 * on;
      c.overlay.kneeL = c.overlay.legSwingL * 1.5;
      c.overlay.kneeR = c.overlay.legSwingR * 1.5;
      s.nextNote -= dt;
      if (s.nextNote <= 0) {
        c.face.setExpression(['happy', 'joy', 'uwu'][Math.floor(t / 1.1) % 3]);
        c.emote('note', 0.6 * s.noteSide);
        s.noteSide *= -1;
        s.nextNote = 1.1;
      }
      if (t > 6) return then(p);
    },
  },
};

export const ACTIONS = ['idle', 'happy', 'sad', 'sleepy', 'sleep', 'wake', 'curious', 'surprised', 'excited', 'wave', 'dance'];
export const KEY_ACTIONS = ['idle', 'happy', 'sad', 'sleepy', 'curious', 'surprised', 'excited', 'wave', 'dance', 'walk'];
