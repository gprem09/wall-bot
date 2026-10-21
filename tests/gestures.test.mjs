import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GestureRecognizer } from '../src/vision/GestureRecognizer.js';
import { DEFAULTS } from '../src/core/Settings.js';

function pose(cx, { rightWrist, rightElbow, leftWrist, leftElbow, conf = 0.95, wristConf } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: cx, y: 0.5, z: 0, visibility: 0.1 }));
  const set = (i, x, y, v = conf) => (lm[i] = { x, y, z: 0, visibility: v });
  set(0, cx, 0.2);
  set(11, cx + 0.08, 0.35);
  set(12, cx - 0.08, 0.35);
  set(13, ...(leftElbow ?? [cx + 0.1, 0.5]));
  set(15, ...(leftWrist ?? [cx + 0.1, 0.65]));
  set(19, ...(leftWrist ?? [cx + 0.1, 0.68]));
  set(14, ...(rightElbow ?? [cx - 0.1, 0.5]));
  set(16, ...(rightWrist ?? [cx - 0.1, 0.65]), wristConf ?? conf);
  set(20, ...(rightWrist ?? [cx - 0.1, 0.68]), wristConf ?? conf);
  return lm;
}

function harness() {
  const g = new GestureRecognizer(structuredClone(DEFAULTS));
  let t = 0;
  const run = (n, make) => {
    const events = [];
    for (let i = 0; i < n; i++) {
      t += 33;
      g.update(make(i), t, 4 / 3);
      events.push(...g.consumeEvents().map((e) => e.type + (e.held ? '(held)' : '')));
    }
    return events;
  };
  return { g, run };
}

const elbowWave = (i) => pose(0.3, { rightElbow: [0.18, 0.4], rightWrist: [0.18 + Math.sin(i * 0.5) * 0.06, 0.25] });

test('presence: enter after a short delay, mirrored position', () => {
  const { g, run } = harness();
  assert.deepEqual(run(10, () => null), []);
  assert.deepEqual(run(20, () => pose(0.3)), ['enter']);
  assert.ok(Math.abs(g.state.bodyU - 0.75) < 0.02, `bodyU ${g.state.bodyU}`);
});

test('presence: brief dropouts do not trigger leave, long absence does', () => {
  const { g, run } = harness();
  run(20, () => pose(0.5));
  assert.deepEqual(run(30, () => null), []);
  assert.deepEqual(run(5, () => pose(0.5)), []);
  assert.deepEqual(run(80, () => null), ['leave']);
  assert.equal(g.state.present, false);
});

test('presence: dim, low-confidence detections keep you present', () => {
  const { g, run } = harness();
  run(20, () => pose(0.5));
  assert.deepEqual(run(120, () => pose(0.5, { conf: 0.38 })), []);
  assert.equal(g.state.present, true);
});

test('presence: weak detections alone do not count as someone arriving', () => {
  const { run } = harness();
  assert.deepEqual(run(60, () => pose(0.5, { conf: 0.38 })), []);
});

test('presence: while blind, losing the person does not mean they left', () => {
  const { g, run } = harness();
  run(20, () => pose(0.5));
  g.blind = true;
  assert.deepEqual(run(200, () => null), []);
  assert.equal(g.state.present, true);
  g.blind = false;
  assert.deepEqual(run(80, () => null), ['leave']);
});

test('position: a one-frame misdetection does not teleport the person', () => {
  const { g, run } = harness();
  run(30, () => pose(0.5));
  const before = g.state.bodyU;
  run(1, () => pose(0.05));
  assert.ok(Math.abs(g.state.bodyU - before) < 0.01, `jumped to ${g.state.bodyU}`);
  run(30, () => pose(0.05));
  assert.ok(g.state.bodyU > 0.85, `followed to ${g.state.bodyU}`);
});

test('wave: side-to-side raised forearm is detected once', () => {
  const { g, run } = harness();
  run(20, () => pose(0.3));
  assert.deepEqual(run(60, elbowWave), ['wave']);
  assert.ok(g.state.hand, 'raised hand tracked');
});

test('wave: survives blurry wrist dropouts', () => {
  const { run } = harness();
  run(20, () => pose(0.3));
  const events = run(60, (i) => {
    const lm = elbowWave(i);
    if (i % 4 === 0) lm[16].visibility = 0.05;
    else lm[16].visibility = 0.35;
    return lm;
  });
  assert.deepEqual(events, ['wave']);
});

test('wave: whole-arm wave from the shoulder counts', () => {
  const { run } = harness();
  run(20, () => pose(0.3));
  const events = run(60, (i) => {
    const swing = Math.sin(i * 0.45) * 0.07;
    return pose(0.3, { rightElbow: [0.17 + swing * 0.5, 0.28], rightWrist: [0.17 + swing, 0.15] });
  });
  assert.deepEqual(events, ['wave']);
});

test('wave: jitter of a still raised hand is ignored', () => {
  const { run } = harness();
  run(20, () => pose(0.3));
  const events = run(120, () => pose(0.3, { rightElbow: [0.18, 0.4], rightWrist: [0.18 + (Math.random() - 0.5) * 0.01, 0.25] }));
  assert.deepEqual(events, []);
});

test('wave: arms swinging at your sides while walking are ignored', () => {
  const { run } = harness();
  run(20, () => pose(0.3));
  const events = run(120, (i) => pose(0.3, { rightWrist: [0.2 + Math.sin(i * 0.4) * 0.06, 0.65], leftWrist: [0.4 - Math.sin(i * 0.4) * 0.06, 0.65] }));
  assert.deepEqual(events, []);
});

test('hello: a hand held up above the head greets once', () => {
  const { run } = harness();
  run(20, () => pose(0.3));
  const up = () => pose(0.3, { rightElbow: [0.17, 0.25], rightWrist: [0.17, 0.1] });
  assert.deepEqual(run(150, up), ['wave(held)']);
  run(20, () => pose(0.3));
  assert.deepEqual(run(60, up), ['wave(held)']);
});

test('hello: both hands up (stretching) is not a greeting', () => {
  const { run } = harness();
  run(20, () => pose(0.3));
  const events = run(90, () => pose(0.3, { rightElbow: [0.2, 0.25], rightWrist: [0.2, 0.1], leftElbow: [0.4, 0.25], leftWrist: [0.4, 0.1] }));
  assert.deepEqual(events, []);
});

test('wave: raising a wobbly arm straight out to the side is not a wave', () => {
  const { run } = harness();
  run(20, () => pose(0.3));
  const events = run(60, (i) => {
    const k = Math.min(1, i / 12);
    const wob = Math.sin(i * 1.3) * 0.025;
    return pose(0.3, { rightElbow: [0.22 - 0.12 * k, 0.5 - 0.15 * k + wob * 0.5], rightWrist: [0.2 - 0.2 * k + wob, 0.65 - 0.3 * k + wob] });
  });
  assert.deepEqual(events, []);
});
