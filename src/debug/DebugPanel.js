import GUI from 'lil-gui';
import Stats from 'three/addons/libs/stats.module.js';
import { EXPRESSION_NAMES } from '../robot/face/expressions.js';
import { ACTIONS, KEY_ACTIONS } from '../character/states.js';
import { MESSAGES } from '../character/messages.js';
import { PoseTracker } from '../vision/PoseTracker.js';
import { enterProjectorFullscreen } from '../projection/fullscreen.js';
import { resetSettings } from '../core/Settings.js';

export class DebugPanel {
  constructor({ stage, robot, character, director, speech, calibration, settings, save }) {
    Object.assign(this, { stage, robot, character, director, speech, calibration, settings, save });
    this.turntable = false;

    this.stats = new Stats();
    this.stats.dom.classList.add('stats');
    document.body.appendChild(this.stats.dom);

    this.gui = new GUI({ title: 'Wall-Bot  ·  H hide  ·  F fullscreen' });
    this.gui.onFinishChange(() => save());
    this.gui.add(settings, 'glow', 0, 1.5).name('glow  (lower for projector)');
    this.#behaviourFolder();
    this.#speechFolder();
    this.#faceFolder();
    this.#projectionFolder();
    this.#trackingFolder();
    this.#lookFolder();
    this.#viewFolder();
  }

  #behaviourFolder() {
    const { character, settings } = this;
    const f = this.gui.addFolder('Behaviour');
    this.info = { state: '', energy: 1 };
    f.add(this.info, 'state').listen().disable();
    f.add(this.info, 'energy', 0, 1).listen().disable();

    const t = f.addFolder('Trigger  (keys 0–9 · 9 = walk)');
    const actions = {};
    const label = (name) => {
      const key = KEY_ACTIONS.indexOf(name);
      return key < 0 ? name : `${key} · ${name}`;
    };
    for (const name of ACTIONS) {
      actions[name] = () => character.trigger(name, {}, true);
      t.add(actions, name).name(label(name));
    }
    actions['walk ←'] = () => character.trigger('walk', { x: character.loco.minX }, true);
    actions['walk →'] = () => character.trigger('walk', { x: character.loco.maxX }, true);
    t.add(actions, 'walk ←');
    t.add(actions, 'walk →');

    f.add(settings, 'autoWalk').name('wander on its own');
    f.add(settings, 'walkSpeed', 0.3, 2).name('walk speed');
    f.add(settings, 'startAsleep').name('start asleep (for filming)');
  }

  #speechFolder() {
    const { settings, speech } = this;
    const f = this.gui.addFolder('Speech bubbles').close();
    f.add(settings, 'speechEnabled').name('talk on its own');
    f.add(settings, 'chatInterval', 20, 900, 10).name('chatter every (s)');
    f.add(settings, 'waterEvery', 0, 120, 5).name('water reminder (min)');
    f.add(settings, 'breakEvery', 0, 120, 5).name('break reminder (min)');
    f.add(settings, 'bubbleSize', 0.6, 1.8).name('bubble size');
    const say = { 'say something  (S)': () => speech.sayNow() };
    for (const cat of Object.keys(MESSAGES)) say[cat] = () => speech.sayNow(cat);
    for (const key of Object.keys(say)) f.add(say, key);
  }

  #faceFolder() {
    const face = this.robot.face;
    const f = this.gui.addFolder('Face').close();
    const presets = {};
    for (const name of EXPRESSION_NAMES) {
      presets[name] = () => face.setExpression(name);
      f.add(presets, name);
    }
    f.add(face.uniforms.uEyeSize, 'value', 0.8, 1.5).name('eye size');
    const t = face.target;
    const tune = f.addFolder('Fine tune').close();
    tune.add(t.eyeOpen, '0', 0, 1).name('eye open L').listen();
    tune.add(t.eyeOpen, '1', 0, 1).name('eye open R').listen();
    tune.add(t.eyeScale, '0', 0.5, 1.6).name('eye scale L').listen();
    tune.add(t.eyeScale, '1', 0.5, 1.6).name('eye scale R').listen();
    for (const [key, min, max] of [['happy', 0, 1], ['brow', -1, 1], ['mouthCurve', -1, 1], ['mouthOpen', 0, 1], ['mouthWidth', 0.02, 0.2], ['mouthAlpha', 0, 1], ['blush', 0, 1], ['squeeze', 0, 1], ['heart', 0, 1], ['cat', 0, 1], ['mouthTilt', -1, 1], ['tears', 0, 1], ['sweat', 0, 1]]) {
      tune.add(t, key, min, max).listen();
    }
    tune.add(face, 'transitionRate', 1, 30).name('blend speed');
  }

  #projectionFolder() {
    const { settings, stage, calibration } = this;
    const f = this.gui.addFolder('Projection').close();
    f.add(settings, 'robotScale', 0.2, 1.5).name('robot size');
    f.add(settings, 'floorY', 0, 0.8).name('floor height');
    f.add(settings, 'boundsLeft', 0, 0.5).name('left bound');
    f.add(settings, 'boundsRight', 0.5, 1).name('right bound');
    f.add(settings, 'blackPoint', 0, 0.15).name('black point').onChange((v) => (stage.projection.uniforms.uBlackPoint.value = v));
    f.add({ calibrate: () => calibration.toggle() }, 'calibrate').name('calibrate corners  (C)');
    f.add({ reset: () => calibration.resetCorners() }, 'reset').name('reset corners');
    f.add({ fs: () => enterProjectorFullscreen() }, 'fs').name('fullscreen on projector');
    f.add({
      reset: () => {
        resetSettings(settings, ['robotScale', 'floorY', 'boundsLeft', 'boundsRight', 'blackPoint']);
        stage.projection.uniforms.uBlackPoint.value = settings.blackPoint;
        f.controllersRecursive().forEach((c) => c.updateDisplay());
        this.save();
      },
    }, 'reset').name('reset placement');
  }

  #trackingFolder() {
    const { settings, director } = this;
    const f = this.gui.addFolder('Camera tracking').close();
    this.trackInfo = { status: 'off', person: '—', gesture: '—' };
    const ui = {
      get enabled() {
        return director.active;
      },
      set enabled(v) {
        director.setEnabled(v).catch(() => {}).finally(() => refreshCameras());
      },
    };
    f.add(ui, 'enabled').name('enable camera  (T)').listen();
    f.add(this.trackInfo, 'status').listen().disable();
    f.add(this.trackInfo, 'person').listen().disable();
    f.add(this.trackInfo, 'gesture').listen().disable();

    let cameraCtrl = null;
    const refreshCameras = async () => {
      const cams = await PoseTracker.listCameras().catch(() => []);
      const options = { default: '' };
      cams.forEach((c, i) => (options[c.label || `camera ${i + 1}`] = c.deviceId));
      cameraCtrl?.destroy();
      cameraCtrl = f.add(settings, 'cameraDeviceId', options).name('camera').onChange(() => {
        this.save();
        if (director.active) director.setEnabled(true).catch(() => {});
      });
    };
    refreshCameras();

    f.add(settings, 'camMirror').name('mirror (camera faces you)');
    f.add(settings, 'camXMin', 0, 0.5).name('camera left edge');
    f.add(settings, 'camXMax', 0.5, 1).name('camera right edge');
    f.add(settings, 'followDeadzone', 0.02, 0.5).name('follow deadzone');
    f.add(settings, 'absenceTimeout', 5, 120, 1).name('sleep after (s)');
    f.add(settings, 'waveSensitivity', 0.5, 2).name('wave sensitivity');
    f.add(settings, 'raisedHandGreets').name('hand held up = wave');
    f.add(settings, 'lowLightBoost').name('low-light boost');
    f.add(settings, 'poseModel', ['full', 'lite']).name('pose model').onChange(() => {
      this.save();
      if (director.active) director.setEnabled(true).catch(() => {});
    });
    f.add(settings, 'showPreview').name('camera preview');
  }

  #lookFolder() {
    const { stage, robot } = this;
    const m = robot.materials;
    const f = this.gui.addFolder('Look & lighting').close();

    const colors = { face: '#4de6ff', shell: '#' + m.shell.color.getHexString() };
    f.addColor(colors, 'face').name('LED / eye colour').onChange((v) => robot.setFaceColor(m.led.color.clone().set(v)));
    f.add(robot, 'faceIntensity', 0.5, 8).name('eye brightness');
    f.add(robot, 'ledIntensity', 0, 10).name('LED brightness');
    f.add(robot.face.uniforms.uScanlines, 'value', 0, 0.4).name('scanlines');
    f.addColor(colors, 'shell').name('shell colour').onChange((v) => m.shell.color.set(v));
    f.add(m.shell, 'roughness', 0, 1).name('shell roughness');
    f.add(m.shell, 'clearcoat', 0, 1).name('shell clearcoat');
    f.add(m.visor, 'envMapIntensity', 0, 1).name('visor reflections');
    f.add(robot.parts.antenna, 'visible').name('antenna');
    f.add(robot.parts.ears, 'visible').name('ear pods');

    f.add(stage.renderer, 'toneMappingExposure', 0.3, 2).name('exposure');
    f.add(stage.scene, 'environmentIntensity', 0, 2).name('reflections');
    f.add(stage.lights.key, 'intensity', 0, 6).name('key light');
    f.add(stage.lights.rimL, 'intensity', 0, 6).name('rim light L');
    f.add(stage.lights.rimR, 'intensity', 0, 6).name('rim light R');
    f.add(stage.bloom, 'enabled').name('bloom');
    f.add(stage.bloom, 'radius', 0, 1).name('bloom radius');
    f.add(stage.bloom, 'threshold', 0, 5).name('bloom threshold');
  }

  #viewFolder() {
    const { stage } = this;
    const f = this.gui.addFolder('View').close();
    f.add(this, 'turntable').name('turntable spin');
    f.add(stage.controls, 'enabled').name('orbit camera  (O)').listen();
    f.add(stage, 'autoQuality').name('auto quality');
    f.add({ reset: () => stage.resetCamera() }, 'reset').name('reset view');
  }

  update(dt) {
    const { character, director } = this;
    this.info.state = character.stateName;
    this.info.energy = character.brain.energy;

    const g = director.gestures;
    this.trackInfo.status = director.tracker.statusText;
    this.trackInfo.person = g.state.present ? `here (u=${g.state.bodyU.toFixed(2)})${g.state.hand ? ' · hand up' : ''}` : 'nobody';
    this.trackInfo.gesture = g.lastEvent || '—';

    this.spin = this.turntable ? (this.spin ?? 0) + dt * 0.6 : 0;
    character.robot.root.rotation.y += this.spin;
    this.stats.update();
  }
}
