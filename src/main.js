import { Stage } from './core/Stage.js';
import { Loop } from './core/Loop.js';
import { loadSettings, saveSettings } from './core/Settings.js';
import { Robot } from './robot/Robot.js';
import { Character } from './character/Character.js';
import { ACTIONS, KEY_ACTIONS } from './character/states.js';
import { Speech } from './character/Speech.js';
import { WallSpace } from './projection/WallSpace.js';
import { CalibrationOverlay } from './projection/CalibrationOverlay.js';
import { toggleFullscreen } from './projection/fullscreen.js';
import { PoseTracker } from './vision/PoseTracker.js';
import { GestureRecognizer } from './vision/GestureRecognizer.js';
import { CameraPreview } from './vision/CameraPreview.js';
import { InteractionDirector } from './interaction/InteractionDirector.js';
import { DebugPanel } from './debug/DebugPanel.js';
import { toast } from './debug/toast.js';

const params = new URLSearchParams(location.search);
const settings = loadSettings();
const save = () => saveSettings(settings);
if (params.has('present')) document.body.classList.add('presenting');

const stage = new Stage(document.getElementById('app'));
stage.projection.uniforms.uBlackPoint.value = settings.blackPoint;
const wall = new WallSpace(stage.camera, settings);

const robot = new Robot();
stage.scene.add(robot.root);
const character = new Character({ robot, scene: stage.scene, settings });

const tracker = new PoseTracker();
const gestures = new GestureRecognizer(settings);
const director = new InteractionDirector({ character, tracker, gestures, settings, wall });
const preview = new CameraPreview({ tracker, gestures, settings });
const speech = new Speech({ character, settings, director });

const calibration = new CalibrationOverlay({ settings, pass: stage.projection, onChange: save });
const debug = new DebugPanel({ stage, robot, character, director, speech, calibration, settings, save });

if (settings.trackingEnabled) director.setEnabled(true).catch(() => {});
else toast('Camera is off · press T to turn it on', 5000);

function updatePlacement() {
  const scale = settings.robotScale;
  const [minX, maxX] = wall.movementRange(scale);
  const floorY = wall.floorWorldY;
  character.setPlacement({ scale, floorY, minX, maxX, halfWidth: wall.halfWidth, halfHeight: wall.halfHeight });
  stage.setFocus(character.loco.x, floorY, scale);
  stage.bloom.strength = 0.5 * settings.glow;
  const u = stage.projection.uniforms;
  u.uFloor.value = settings.floorY;
  u.uBounds.value.set(settings.boundsLeft, settings.boundsRight);
}

const loop = new Loop((dt, t) => {
  updatePlacement();
  director.update(dt);
  speech.update(dt);
  character.update(dt, t);
  preview.update();
  debug.update(dt);
  stage.render();
});
loop.start();

const setPresenting = (on) => document.body.classList.toggle('presenting', on);
document.addEventListener('fullscreenchange', () => setPresenting(!!document.fullscreenElement));
window.addEventListener('dblclick', (e) => {
  if (!e.target.closest('.lil-gui, .calib-handle')) toggleFullscreen();
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
  const key = e.key.toLowerCase();
  if (/^[0-9]$/.test(key)) {
    const name = KEY_ACTIONS[Number(key)];
    if (name === 'walk') {
      const { minX, maxX, x } = character.loco;
      character.trigger('walk', { x: x < (minX + maxX) / 2 ? maxX : minX }, true);
    } else if (ACTIONS.includes(name)) {
      character.trigger(name, {}, true);
    }
    return;
  }
  switch (key) {
    case 'h':
      setPresenting(!document.body.classList.contains('presenting'));
      break;
    case 'f':
      toggleFullscreen();
      break;
    case 'c':
      calibration.toggle();
      break;
    case 'o':
      stage.controls.enabled = !stage.controls.enabled;
      if (!stage.controls.enabled) stage.resetCamera();
      break;
    case 't':
      director.setEnabled(!director.active).catch(() => {});
      save();
      break;
    case 'b':
      robot.face.blink();
      break;
    case 's':
      speech.sayNow();
      break;
  }
});

window.wallbot = { stage, robot, character, director, speech, gestures, tracker, settings, wall, loop, calibration };
