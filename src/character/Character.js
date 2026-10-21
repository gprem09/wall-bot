import * as THREE from 'three';
import { StateMachine } from '../animation/StateMachine.js';
import { createPose, dampPose, resetPose } from '../animation/Pose.js';
import { Locomotion } from './Locomotion.js';
import { Personality } from './Personality.js';
import { Emotes } from './Emotes.js';
import { SpeechBubble } from './SpeechBubble.js';
import { STATES } from './states.js';

const _head = new THREE.Vector3();
const _dir = new THREE.Vector3();
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class Character {
  constructor({ robot, scene, settings }) {
    this.robot = robot;
    this.face = robot.face;
    this.settings = settings;

    this.target = createPose();
    this.current = createPose();
    this.overlay = createPose();
    this.final = createPose();
    this.poseRate = 8;

    this.lookHint = null;
    this.attention = null;
    this.socialMode = false;
    this.allowAutoWake = true;
    this.led = { level: 1, pulse: 2.2 };
    this.placement = { scale: 0.55, floorY: -1.5, minX: -3, maxX: 3, halfWidth: 4, halfHeight: 2 };
    this.breathPhase = 0;

    this.loco = new Locomotion();
    this.brain = new Personality();
    this.emotes = new Emotes(scene);
    this.bubble = new SpeechBubble(scene);
    this.quipFace = null;
    this.fsm = new StateMachine(this, STATES);
    this.fsm.go(settings.startAsleep ? 'sleep' : 'boot');
  }

  get stateName() {
    return this.fsm.name;
  }

  trigger(name, params = {}, force = false) {
    const current = this.fsm.state;
    const next = STATES[name];
    if (!next) return false;
    if (!force && current && (current.priority ?? 0) > (next.priority ?? 0)) return false;
    this.fsm.go(name, params);
    return true;
  }

  setPlacement(p) {
    Object.assign(this.placement, p);
    this.loco.setBounds(p.minX, p.maxX);
  }

  emote(type, side = 0) {
    const s = this.placement.scale;
    this.robot.joints.head.getWorldPosition(_head);
    _head.y += 0.65 * s;
    _head.x += side * 0.5 * s;
    _head.z += 0.3 * s;
    this.emotes.spawn(type, _head, s, side);
  }

  say(message, force = false) {
    return this.trigger('talk', { message }, force);
  }

  quip(text, expression) {
    if (this.fsm.name === 'talk' || ['sleep', 'boot'].includes(this.fsm.name)) return false;
    if (expression) {
      this.quipFace = { name: expression, underneath: this.face.expression };
      this.face.setExpression(expression);
    }
    this.bubble.show(text, this.bubbleSide(), true);
    return true;
  }

  #holdQuipFace() {
    const q = this.quipFace;
    if (!q) return;
    const face = this.face;
    if (this.fsm.name === 'talk') {
      this.quipFace = null;
    } else if (this.bubble.active) {
      if (face.expression !== q.name) {
        q.underneath = face.expression;
        face.setExpression(q.name);
      }
    } else {
      this.quipFace = null;
      if (face.expression === q.name && q.underneath) face.setExpression(q.underneath);
    }
  }

  bubbleSide() {
    const { minX, maxX } = this.placement;
    return this.loco.x <= (minX + maxX) / 2 ? 1 : -1;
  }

  #updateBubble(dt) {
    const b = this.bubble;
    if (!b.active) return;
    const { scale, halfWidth, halfHeight } = this.placement;
    this.robot.joints.head.getWorldPosition(_head);
    _head.x += b.side * 0.62 * scale;
    _head.y += 0.42 * scale;
    _head.z += 0.4 * scale;
    b.size = this.settings.bubbleSize;
    b.update(dt, _head, scale, halfWidth, halfHeight);
  }

  update(dt, t) {
    resetPose(this.target);
    resetPose(this.overlay);
    this.poseRate = 8;
    this.lookHint = null;
    this.led.level = 1;
    this.led.pulse = 2.2;

    this.fsm.update(dt);
    this.#holdQuipFace();
    const state = this.fsm.state;
    this.brain.update(dt, this.fsm.name);

    const { scale, floorY } = this.placement;
    this.loco.maxSpeed = 0.9 * this.settings.walkSpeed;
    this.loco.update(dt, scale);

    dampPose(this.current, this.target, this.poseRate, dt);
    const f = this.final;
    for (const k in f) f[k] = this.current[k] + this.overlay[k];
    this.#applyWalk(f);
    this.#applyGaze(f, state);

    const sleeping = this.fsm.name === 'sleep';
    this.breathPhase += dt * (sleeping ? 1.1 : 1.7);
    const breath = Math.sin(this.breathPhase) * (sleeping ? 1.8 : 1);

    const root = this.robot.root;
    root.position.set(this.loco.x, floorY, 0);
    root.scale.setScalar(scale);
    root.rotation.y = this.loco.facing;
    this.robot.applyPose(f, breath);

    this.face.autoBlink = state.blink !== false;
    this.face.update(dt, t);
    const r = this.robot;
    r.ledLevel += (this.led.level - r.ledLevel) * (1 - Math.exp(-3 * dt));
    r.ledPulse = this.led.pulse;
    r.glow = this.emotes.glow = this.settings.glow;
    r.updateLights(dt);
    this.emotes.update(dt);
    this.#updateBubble(dt);
  }

  #applyWalk(f) {
    const w = this.loco.walkAmount;
    if (w < 0.001) return;
    const s = Math.sin(this.loco.phase);
    const c = Math.cos(this.loco.phase);
    f.legSwingL += s * 0.45 * w;
    f.legSwingR -= s * 0.45 * w;
    f.kneeL += Math.max(0, c) * 0.75 * w;
    f.kneeR += Math.max(0, -c) * 0.75 * w;
    f.armSwingL -= s * 0.4 * w;
    f.armSwingR += s * 0.4 * w;
    f.bodyY += (Math.abs(c) - 0.5) * 0.035 * w;
    f.torsoYaw += s * 0.08 * w;
    f.headRoll -= s * 0.04 * w;
    f.torsoPitch += 0.04 * w;
  }

  #applyGaze(f, state) {
    let look = null;
    if (this.attention && state.attentive !== false) {
      this.robot.joints.head.getWorldPosition(_head);
      _dir.subVectors(this.attention, _head);
      const yaw = Math.atan2(_dir.x, _dir.z);
      const pitch = Math.atan2(_dir.y, Math.hypot(_dir.x, _dir.z));
      look = [clamp((yaw - this.loco.facing) / 0.9, -1, 1), clamp(pitch / 0.5, -1, 1)];
      this.loco.idleFacing = clamp(yaw * 0.45, -0.6, 0.6);
    } else {
      this.loco.idleFacing = 0;
      look = this.lookHint;
    }

    this.face.autoLook = !look && state.autoLook !== false;
    if (look) this.face.lookAt(look[0], look[1]);
    else if (state.autoLook === false) this.face.lookAt(0, 0);

    f.headYaw += this.face.look.x * 0.45;
    f.headPitch -= this.face.look.y * 0.3;
  }
}
