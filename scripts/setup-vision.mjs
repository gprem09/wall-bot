import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const wasmSrc = `${root}node_modules/@mediapipe/tasks-vision/wasm`;
const wasmOut = `${root}public/mediapipe/wasm`;
const modelOut = `${root}public/mediapipe/models`;

const MODELS = {
  'pose_landmarker_lite.task':
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  'pose_landmarker_full.task':
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
};

if (!existsSync(wasmSrc)) {
  console.warn('[setup-vision] @mediapipe/tasks-vision not installed yet, skipping.');
  process.exit(0);
}

mkdirSync(wasmOut, { recursive: true });
mkdirSync(modelOut, { recursive: true });
cpSync(wasmSrc, wasmOut, { recursive: true });
console.log('[setup-vision] copied MediaPipe wasm runtime');

for (const [name, url] of Object.entries(MODELS)) {
  const dest = `${modelOut}/${name}`;
  if (existsSync(dest)) continue;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    console.log(`[setup-vision] downloaded ${name}`);
  } catch (err) {
    console.warn(`[setup-vision] could not download ${name} (${err.message}). Run "npm run setup:vision" when online.`);
  }
}
