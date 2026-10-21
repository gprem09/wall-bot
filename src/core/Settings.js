const STORAGE_KEY = 'wallbot.settings.v1';

export const DEFAULTS = {
  robotScale: 0.55,
  floorY: 0.1,
  boundsLeft: 0.05,
  boundsRight: 0.95,
  corners: [[0, 0], [1, 0], [1, 1], [0, 1]],
  blackPoint: 0.025,
  glow: 0.6,

  speechEnabled: true,
  chatInterval: 300,
  waterEvery: 30,
  breakEvery: 50,
  bubbleSize: 1,

  autoWalk: true,
  walkSpeed: 1,
  startAsleep: false,

  trackingEnabled: false,
  cameraDeviceId: '',
  camMirror: true,
  camXMin: 0.1,
  camXMax: 0.9,
  followDeadzone: 0.12,
  absenceTimeout: 25,
  waveSensitivity: 1,
  raisedHandGreets: true,
  poseModel: 'full',
  lowLightBoost: true,
  showPreview: true,
};

export function loadSettings() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    stored = {};
  }
  const settings = structuredClone(DEFAULTS);
  for (const key of Object.keys(DEFAULTS)) {
    if (key in stored) settings[key] = stored[key];
  }
  return settings;
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetSettings(settings, keys = Object.keys(DEFAULTS)) {
  for (const key of keys) settings[key] = structuredClone(DEFAULTS[key]);
}
