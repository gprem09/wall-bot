import { DIMS, buildRobotRig } from './RobotRig.js';
import { LED_COLOR, createMaterials } from './materials.js';
import { FaceDisplay } from './face/FaceDisplay.js';

const SEGMENT = -DIMS.leg.kneeY;
const SIT_DROP = 0.44;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class Robot {
  constructor() {
    this.materials = createMaterials();
    const { root, joints, parts } = buildRobotRig(this.materials);
    this.root = root;
    this.joints = joints;
    this.parts = parts;
    this.face = new FaceDisplay(this.materials.visor, { faceScale: DIMS.visor.ry });

    this.ledColor = LED_COLOR.clone();
    this.ledIntensity = 4;
    this.faceIntensity = 3;
    this.power = 1;
    this.ledLevel = 1;
    this.ledPulse = 2.2;
    this.glow = 1;
    this.pulsePhase = 0;
  }

  setFaceColor(color) {
    this.ledColor.copy(color);
    this.face.uniforms.uFaceColor.value.copy(color);
  }

  applyPose(p, breath = 0) {
    const j = this.joints;
    const crouchA = Math.acos(clamp(1 - p.crouch / (2 * SEGMENT), -1, 1));
    const sit = p.sit;

    j.hips.position.y = DIMS.hipHeight + p.bodyY - p.crouch - sit * SIT_DROP;
    this.parts.body.scale.set(1 + breath * 0.006, 1 + breath * 0.01, DIMS.body.zScale * (1 + breath * 0.006));
    j.torso.rotation.set(p.torsoPitch - sit * 0.06, p.torsoYaw, p.torsoRoll);
    j.neck.position.y = DIMS.neckY + breath * 0.006;
    j.neck.rotation.set(p.headPitch, p.headYaw, p.headRoll);

    const rest = DIMS.shoulder.restOut;
    for (const s of ['L', 'R']) {
      const sign = s === 'L' ? 1 : -1;
      const shoulder = j[`shoulder${s}`];
      shoulder.position.y = DIMS.shoulder.y + breath * 0.005;
      shoulder.rotation.set(-p[`armSwing${s}`], sign * p[`armTwist${s}`], sign * (rest + p[`armRaise${s}`] + breath * 0.02));
      j[`elbow${s}`].rotation.x = -(0.18 + p[`elbow${s}`]);
      j[`wrist${s}`].rotation.z = sign * p[`wrist${s}`];

      const hipX = -p[`legSwing${s}`] - crouchA - sit * 1.45;
      const kneeX = p[`knee${s}`] + 2 * crouchA + sit * 0.15;
      j[`hip${s}`].rotation.set(hipX, 0, sign * p[`legSpread${s}`]);
      j[`knee${s}`].rotation.x = kneeX;
      j[`ankle${s}`].rotation.x = -(hipX + kneeX) * (1 - sit * 0.6);
    }
  }

  updateLights(dt) {
    this.pulsePhase += dt * this.ledPulse;
    const pulse = 0.85 + 0.15 * Math.sin(this.pulsePhase);
    const ledGlow = 0.35 + 0.65 * this.glow;
    const faceGlow = 0.5 + 0.5 * this.glow;
    this.materials.led.color.copy(this.ledColor).multiplyScalar(this.ledIntensity * ledGlow * this.ledLevel * this.power * pulse);
    this.face.uniforms.uFaceIntensity.value = this.faceIntensity * faceGlow * this.power * (0.7 + 0.3 * Math.min(this.ledLevel, 1.3));
  }
}
