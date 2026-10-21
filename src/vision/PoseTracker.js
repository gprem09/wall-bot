import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const BASE = import.meta.env.BASE_URL;
const WASM_PATH = `${BASE}mediapipe/wasm`;
const MODEL_PATH = (name) => `${BASE}mediapipe/models/pose_landmarker_${name}.task`;

const METER_EVERY = 400;
const TARGET_LUMA = 0.36;
const MAX_GAIN = 3.5;
const DARK_LUMA = 0.03;
const STALE_MS = 1500;

export class PoseTracker {
  constructor() {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.boosted = document.createElement('canvas');
    this.boostCtx = this.boosted.getContext('2d');
    this.meter = document.createElement('canvas');
    this.meter.width = 32;
    this.meter.height = 24;
    this.meterCtx = this.meter.getContext('2d', { willReadFrequently: true });

    this.landmarker = null;
    this.modelName = '';
    this.stream = null;
    this.running = false;
    this.status = 'off';
    this.fps = 0;
    this.listeners = new Set();
    this.lastTs = 0;
    this.frames = 0;
    this.fpsStart = 0;

    this.lowLightBoost = true;
    this.brightness = 0.5;
    this.gain = 1;
    this.lastMeter = 0;
    this.lastFrameAt = 0;
    this.startedAt = 0;
  }

  onResult(fn) {
    this.listeners.add(fn);
  }

  get aspect() {
    return this.video.videoWidth / (this.video.videoHeight || 1) || 4 / 3;
  }

  get source() {
    return this.gain > 1.05 ? this.boosted : this.video;
  }

  get quality() {
    if (!this.running) return 'off';
    const now = performance.now();
    if (now - this.startedAt > 2500 && now - this.lastFrameAt > STALE_MS) return 'stalled';
    if (this.brightness < DARK_LUMA) return 'dark';
    if (this.gain > 1.6) return 'dim';
    return 'good';
  }

  get blind() {
    const q = this.quality;
    return q === 'dark' || q === 'stalled';
  }

  get statusText() {
    if (!this.running) return this.status;
    const q = this.quality;
    const fps = `${this.fps.toFixed(0)} fps`;
    if (q === 'stalled') return 'camera stalled';
    if (q === 'dark') return `too dark · ${fps}`;
    if (q === 'dim') return `low light (boost ${this.gain.toFixed(1)}×) · ${fps}`;
    return `tracking · ${this.modelName} · ${fps}`;
  }

  static explain(err) {
    switch (err?.name) {
      case 'NotAllowedError':
        return 'Camera blocked. Allow it via the camera icon in the address bar, and in macOS System Settings → Privacy & Security → Camera for your browser.';
      case 'NotReadableError':
        return 'Camera is busy. Close other apps or tabs using it (FaceTime, Zoom, Photo Booth) and try again.';
      case 'NotFoundError':
        return 'No camera found.';
      default:
        return err?.message ?? String(err);
    }
  }

  static async listCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  }

  async #createLandmarker(model) {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = (name, delegate) => ({
      baseOptions: { modelAssetPath: MODEL_PATH(name), delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
    const attempts = [[model, 'GPU'], [model, 'CPU']];
    if (model !== 'lite') attempts.push(['lite', 'GPU'], ['lite', 'CPU']);
    let lastErr;
    for (const [name, delegate] of attempts) {
      try {
        const lm = await PoseLandmarker.createFromOptions(fileset, options(name, delegate));
        this.modelName = name;
        return lm;
      } catch (err) {
        console.warn(`[tracker] ${name}/${delegate} failed`, err);
        lastErr = err;
      }
    }
    throw lastErr;
  }

  async start(deviceId = '', model = 'full') {
    if (this.running) this.stop();
    try {
      if (this.landmarker && this.requestedModel !== model) {
        this.landmarker.close();
        this.landmarker = null;
      }
      this.status = 'loading model…';
      this.requestedModel = model;
      this.landmarker ??= await this.#createLandmarker(model);
      this.status = 'starting camera…';
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(`Camera needs a secure page. Open http://localhost:${location.port || 5173} instead of ${location.host}.`);
      }
      const constraints = (id) => ({
        audio: false,
        video: { deviceId: id ? { exact: id } : undefined, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      });
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints(deviceId));
      } catch (err) {
        if (!deviceId || !['OverconstrainedError', 'NotFoundError'].includes(err.name)) throw err;
        this.stream = await navigator.mediaDevices.getUserMedia(constraints(''));
      }
      this.video.srcObject = this.stream;
      await this.video.play();
      this.running = true;
      this.status = 'tracking';
      this.startedAt = this.fpsStart = this.lastFrameAt = performance.now();
      this.gain = 1;
      this.brightness = 0.5;
      this.#schedule();
    } catch (err) {
      console.error('[tracker]', err);
      this.status = `error: ${PoseTracker.explain(err)}`;
      this.stop(false);
      throw err;
    }
  }

  stop(resetStatus = true) {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    if (resetStatus) this.status = 'off';
    for (const fn of this.listeners) fn(null, performance.now());
  }

  #schedule() {
    if (!this.running) return;
    const token = (this.token = (this.token ?? 0) + 1);
    const run = () => {
      if (token !== this.token) return;
      this.token++;
      this.#process();
    };
    if ('requestVideoFrameCallback' in this.video) this.video.requestVideoFrameCallback(run);
    else requestAnimationFrame(run);
    setTimeout(run, 60);
  }

  #measure(now) {
    if (now - this.lastMeter < METER_EVERY) return;
    this.lastMeter = now;
    const { meterCtx: ctx, meter } = this;
    ctx.drawImage(this.video, 0, 0, meter.width, meter.height);
    const px = ctx.getImageData(0, 0, meter.width, meter.height).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    this.brightness = sum / (px.length / 4) / 255;
    const want = this.lowLightBoost ? Math.min(MAX_GAIN, Math.max(1, TARGET_LUMA / Math.max(this.brightness, 0.01))) : 1;
    this.gain += (want - this.gain) * 0.5;
  }

  #frame() {
    if (this.gain <= 1.05) return this.video;
    const { boosted: c, boostCtx: ctx, video: v } = this;
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    }
    ctx.filter = `brightness(${this.gain.toFixed(2)}) contrast(1.12)`;
    ctx.drawImage(v, 0, 0);
    return c;
  }

  #process() {
    if (!this.running) return;
    const now = performance.now();
    const fresh = this.video.currentTime !== this.lastVideoTime;
    if (this.video.readyState >= 2 && now > this.lastTs && fresh) {
      this.lastTs = now;
      this.lastVideoTime = this.video.currentTime;
      this.lastFrameAt = now;
      try {
        this.#measure(now);
        const result = this.landmarker.detectForVideo(this.#frame(), now);
        const landmarks = result.landmarks?.[0] ?? null;
        for (const fn of this.listeners) fn(landmarks, now);
      } catch (err) {
        console.warn('[tracker] frame failed', err);
      }

      this.frames++;
      const elapsed = (now - this.fpsStart) / 1000;
      if (elapsed > 1) {
        this.fps = this.frames / elapsed;
        this.frames = 0;
        this.fpsStart = now;
      }
    }
    this.#schedule();
  }
}
