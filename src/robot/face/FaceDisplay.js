import * as THREE from 'three';
import { LED_COLOR } from '../materials.js';
import { FACE_KEYS, cloneExpression } from './expressions.js';

const uniformName = (key) => `u${key[0].toUpperCase()}${key.slice(1)}`;
import { faceFragmentMain, faceFragmentPars, faceVertexMain, faceVertexPars } from './faceShader.js';

const rand = (a, b) => a + Math.random() * (b - a);
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

export class FaceDisplay {
  constructor(material, { faceScale }) {
    this.expression = 'neutral';
    this.target = cloneExpression('neutral');
    this.current = cloneExpression('neutral');
    this.transitionRate = 9;

    this.look = new THREE.Vector2();
    this.lookTarget = new THREE.Vector2();
    this.autoLook = true;
    this.nextSaccade = rand(1, 3);

    this.autoBlink = true;
    this.blinkPhase = -1;
    this.nextBlink = rand(1.5, 4);

    this.uniforms = {
      uTime: { value: 0 },
      uFaceScale: { value: faceScale },
      uFaceColor: { value: LED_COLOR.clone() },
      uFaceIntensity: { value: 3 },
      uLook: { value: this.look },
      uEyeOpen: { value: new THREE.Vector2(1, 1) },
      uEyeScale: { value: new THREE.Vector2(1, 1) },
      uScanlines: { value: 0.08 },
      uEyeSize: { value: 1.25 },
    };
    for (const key of FACE_KEYS) this.uniforms[uniformName(key)] = { value: this.current[key] };

    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = faceVertexPars + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${faceVertexMain}`,
      );
      shader.fragmentShader = faceFragmentPars + shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n${faceFragmentMain}`,
      );
    };
    material.customProgramCacheKey = () => 'wallbot-face';
    material.needsUpdate = true;
  }

  setExpression(name) {
    const { eyeOpen, eyeScale, ...rest } = cloneExpression(name);
    this.expression = name;
    Object.assign(this.target, rest);
    this.target.eyeOpen.splice(0, 2, ...eyeOpen);
    this.target.eyeScale.splice(0, 2, ...eyeScale);
  }

  blink() {
    if (this.blinkPhase < 0) this.blinkPhase = 0;
  }

  lookAt(x, y) {
    this.lookTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
  }

  #updateBlink(dt) {
    if (this.autoBlink && this.blinkPhase < 0) {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) {
        this.blink();
        this.nextBlink = Math.random() < 0.15 ? 0.22 : rand(2, 5.5);
      }
    }
    if (this.blinkPhase < 0) return 1;
    this.blinkPhase += dt / 0.16;
    if (this.blinkPhase >= 1) {
      this.blinkPhase = -1;
      return 1;
    }
    return 1 - Math.sin(this.blinkPhase * Math.PI);
  }

  #updateSaccades(dt) {
    if (!this.autoLook) return;
    this.nextSaccade -= dt;
    if (this.nextSaccade > 0) return;
    this.nextSaccade = rand(0.8, 3.2);
    if (Math.random() < 0.3) this.lookTarget.set(0, 0);
    else this.lookTarget.set(rand(-0.75, 0.75), rand(-0.4, 0.35));
  }

  update(dt, time) {
    const c = this.current;
    const t = this.target;
    const r = this.transitionRate;

    for (const key of FACE_KEYS) c[key] = damp(c[key], t[key], r, dt);
    for (let i = 0; i < 2; i++) {
      c.eyeOpen[i] = damp(c.eyeOpen[i], t.eyeOpen[i], r, dt);
      c.eyeScale[i] = damp(c.eyeScale[i], t.eyeScale[i], r, dt);
    }

    this.#updateSaccades(dt);
    this.look.x = damp(this.look.x, this.lookTarget.x, 16, dt);
    this.look.y = damp(this.look.y, this.lookTarget.y, 16, dt);

    const blink = this.#updateBlink(dt);
    const u = this.uniforms;
    u.uTime.value = time;
    u.uEyeOpen.value.set(c.eyeOpen[0] * blink, c.eyeOpen[1] * blink);
    u.uEyeScale.value.set(c.eyeScale[0], c.eyeScale[1]);
    for (const key of FACE_KEYS) u[uniformName(key)].value = c[key];
  }
}
