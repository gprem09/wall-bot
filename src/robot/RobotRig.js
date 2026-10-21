import * as THREE from 'three';
import { latheGeometry, limbGeometry, superellipsoidGeometry } from './geometry.js';

export const DIMS = {
  hipHeight: 0.57,
  body: {
    profile: [
      [0.0, 0.0], [0.17, 0.006], [0.26, 0.04], [0.31, 0.12], [0.355, 0.28],
      [0.37, 0.44], [0.36, 0.57], [0.32, 0.68], [0.22, 0.765], [0.0, 0.795],
    ],
    zScale: 0.86,
    beltY: 0.2,
    chestY: 0.47,
  },
  neckY: 0.8,
  head: { rx: 0.62, ry: 0.5, rz: 0.48, n: 3.0, centerY: 0.52 },
  visor: { rx: 0.53, ry: 0.4, rz: 0.2, n: 3.6, y: -0.03, z: 0.33 },
  ear: { radius: 0.14, depth: 0.1 },
  shoulder: { x: 0.43, y: 0.58, restOut: 0.15 },
  arm: { upperR: 0.062, upperLen: 0.12, elbowY: -0.19, foreR: 0.057, foreLen: 0.1, wristY: -0.17 },
  leg: { x: 0.16, y: -0.03, thighR: 0.078, thighLen: 0.1, kneeY: -0.2, shinR: 0.074, shinLen: 0.14, ankleY: -0.2 },
};

function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

function pivot(name, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

const GLOW = { cast: false, receive: false };

export function buildRobotRig(mats) {
  const joints = {};
  const parts = {};

  const root = pivot('robot');
  const hips = pivot('hips', 0, DIMS.hipHeight, 0);
  const torso = pivot('torso');
  root.add(hips);
  hips.add(torso);
  Object.assign(joints, { hips, torso });

  buildTorso(torso, mats, parts);
  buildHead(torso, mats, joints, parts);
  for (const side of [1, -1]) {
    buildArm(torso, mats, joints, side);
    buildLeg(hips, mats, joints, side);
  }

  return { root, joints, parts };
}

function buildTorso(torso, mats, parts) {
  const { profile, zScale, beltY, chestY } = DIMS.body;
  const { geometry, radiusAt } = latheGeometry(profile, 96, 80);
  const body = mesh(geometry, mats.shell);
  body.scale.z = zScale;
  torso.add(body);
  parts.body = body;

  const belt = mesh(new THREE.TorusGeometry(radiusAt(beltY), 0.011, 12, 128), mats.led, GLOW);
  belt.rotation.x = Math.PI / 2;
  belt.scale.y = zScale;
  belt.position.y = beltY;
  torso.add(belt);

  const chestZ = radiusAt(chestY) * zScale;
  const chestRing = mesh(new THREE.TorusGeometry(0.062, 0.012, 12, 48), mats.joint);
  chestRing.position.set(0, chestY, chestZ + 0.002);
  const chestLight = mesh(new THREE.CircleGeometry(0.05, 48), mats.led, GLOW);
  chestLight.position.set(0, chestY, chestZ + 0.006);
  torso.add(chestRing, chestLight);

  const neck = mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.12, 32), mats.joint);
  neck.position.y = DIMS.neckY;
  torso.add(neck);
}

function buildHead(torso, mats, joints, parts) {
  const { rx, ry, rz, n, centerY } = DIMS.head;
  const neck = pivot('neck', 0, DIMS.neckY, 0);
  neck.rotation.order = 'YXZ';
  const head = pivot('head', 0, centerY, 0);
  torso.add(neck);
  neck.add(head);
  Object.assign(joints, { neck, head });

  head.add(mesh(superellipsoidGeometry(rx, ry, rz, n, 128, 96), mats.shell));

  const v = DIMS.visor;
  const visor = mesh(superellipsoidGeometry(v.rx, v.ry, v.rz, v.n, 128, 96), mats.visor, { cast: false, receive: true });
  visor.position.set(0, v.y, v.z);
  head.add(visor);
  parts.visor = visor;

  const ears = new THREE.Group();
  const { radius, depth } = DIMS.ear;
  for (const s of [1, -1]) {
    const pod = mesh(new THREE.CylinderGeometry(radius, radius, depth, 48), mats.joint);
    pod.rotation.z = Math.PI / 2;
    pod.position.x = s * rx;
    const cap = mesh(new THREE.CylinderGeometry(radius * 0.6, radius * 0.66, 0.03, 48), mats.shell);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = s * (rx + depth / 2 + 0.008);
    const ring = mesh(new THREE.TorusGeometry(radius * 0.76, 0.011, 12, 64), mats.led, GLOW);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = s * (rx + depth / 2 + 0.002);
    ears.add(pod, cap, ring);
  }
  head.add(ears);
  parts.ears = ears;

  const antenna = new THREE.Group();
  antenna.position.y = ry - 0.01;
  const base = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 32), mats.joint);
  base.position.y = 0.01;
  const stalk = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 12), mats.joint);
  stalk.position.y = 0.1;
  const bulb = mesh(new THREE.SphereGeometry(0.042, 32, 16), mats.led, GLOW);
  bulb.position.y = 0.19;
  antenna.add(base, stalk, bulb);
  head.add(antenna);
  parts.antenna = antenna;
}

function buildArm(torso, mats, joints, side) {
  const key = side > 0 ? 'L' : 'R';
  const a = DIMS.arm;
  const shoulder = pivot(`shoulder${key}`, side * DIMS.shoulder.x, DIMS.shoulder.y, 0);
  const elbow = pivot(`elbow${key}`, 0, a.elbowY, 0);
  const wrist = pivot(`wrist${key}`, 0, a.wristY, 0);
  shoulder.rotation.order = 'XZY';
  torso.add(shoulder);
  shoulder.add(elbow);
  elbow.add(wrist);

  shoulder.add(mesh(new THREE.SphereGeometry(0.085, 32, 24), mats.joint));
  shoulder.add(mesh(limbGeometry(a.upperR, a.upperLen), mats.shell));
  elbow.add(mesh(new THREE.SphereGeometry(0.055, 24, 16), mats.joint));
  elbow.add(mesh(limbGeometry(a.foreR, a.foreLen), mats.shell));

  const palm = mesh(superellipsoidGeometry(0.052, 0.072, 0.07, 2.5, 48, 32), mats.shell);
  palm.position.y = -0.065;
  const thumb = mesh(limbGeometry(0.022, 0.03, 16), mats.shell);
  thumb.position.set(-side * 0.012, -0.04, 0.05);
  thumb.rotation.x = -1.1;
  const wristJoint = mesh(new THREE.SphereGeometry(0.042, 20, 12), mats.joint);
  wrist.add(wristJoint, palm, thumb);

  joints[`shoulder${key}`] = shoulder;
  joints[`elbow${key}`] = elbow;
  joints[`wrist${key}`] = wrist;
}

function buildLeg(hips, mats, joints, side) {
  const key = side > 0 ? 'L' : 'R';
  const l = DIMS.leg;
  const hip = pivot(`hip${key}`, side * l.x, l.y, 0);
  const knee = pivot(`knee${key}`, 0, l.kneeY, 0);
  const ankle = pivot(`ankle${key}`, 0, l.ankleY, 0);
  hips.add(hip);
  hip.add(knee);
  knee.add(ankle);

  hip.add(mesh(new THREE.SphereGeometry(0.085, 32, 24), mats.joint));
  hip.add(mesh(limbGeometry(l.thighR, l.thighLen), mats.shell));
  knee.add(mesh(new THREE.SphereGeometry(0.066, 24, 16), mats.joint));
  knee.add(mesh(limbGeometry(l.shinR, l.shinLen), mats.shell));
  ankle.add(mesh(new THREE.SphereGeometry(0.05, 24, 16), mats.joint));

  const foot = mesh(superellipsoidGeometry(0.11, 0.06, 0.16, 2.6, 64, 32), mats.shell);
  foot.position.set(0, -0.07, 0.035);
  const sole = mesh(superellipsoidGeometry(0.115, 0.02, 0.165, 3, 48, 16), mats.sole);
  sole.position.set(0, -0.12, 0.035);
  const stripe = mesh(new THREE.CapsuleGeometry(0.008, 0.11, 6, 12), mats.led, GLOW);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.set(side * 0.104, -0.075, 0.04);
  ankle.add(foot, sole, stripe);

  joints[`hip${key}`] = hip;
  joints[`knee${key}`] = knee;
  joints[`ankle${key}`] = ankle;
}
