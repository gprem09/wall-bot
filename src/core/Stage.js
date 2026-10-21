import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ProjectionPass } from '../projection/ProjectionPass.js';

const CAMERA_DISTANCE = 8.5;

export class Stage {
  constructor(container, { maxPixelRatio = 1.5 } = {}) {
    this.container = container;
    this.maxPixelRatio = maxPixelRatio;
    this.autoQuality = true;
    this.fps = 60;
    this.qFrames = 0;
    this.qStart = performance.now();

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.resetCamera();
    this.controls.enabled = false;

    this.#createLights();
    this.#createPostProcessing();

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  #createLights() {
    this.lightRig = new THREE.Group();
    this.scene.add(this.lightRig);

    this.focus = new THREE.Object3D();
    this.lightRig.add(this.focus);

    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(-3.5, 6, 6);
    key.target = this.focus;
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    this.lightRig.add(key);

    const fill = new THREE.DirectionalLight(0xdfe9ff, 0.35);
    fill.position.set(5, 2, 4);
    fill.target = this.focus;
    this.lightRig.add(fill);

    const rimL = new THREE.DirectionalLight(0x9fe8ff, 2.2);
    rimL.position.set(-5, 3, -5);
    rimL.target = this.focus;
    const rimR = new THREE.DirectionalLight(0x9fe8ff, 1.8);
    rimR.position.set(5, 4, -5);
    rimR.target = this.focus;
    this.lightRig.add(rimL, rimR);

    this.lights = { key, fill, rimL, rimR };
    this.setFocus(0, 0, 1);
  }

  #createPostProcessing() {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.15, 2.2);
    this.bloom.compositeMaterial.uniforms.bloomFactors.value = [1.0, 0.7, 0.3, 0.06, 0.0];
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.projection = new ProjectionPass();
    this.composer.addPass(this.projection);
  }

  setFocus(x, floorY, scale) {
    this.lightRig.position.set(x, floorY, 0);
    this.focus.position.set(0, 1.2 * scale, 0);
    if (scale !== this.focusScale) {
      this.focusScale = scale;
      const cam = this.lights.key.shadow.camera;
      const r = 1.9 * scale;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.updateProjectionMatrix();
    }
  }

  resetCamera() {
    this.camera.position.set(0, 0, CAMERA_DISTANCE);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, this.maxPixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  #adaptQuality() {
    this.qFrames++;
    const now = performance.now();
    const elapsed = (now - this.qStart) / 1000;
    if (elapsed < 3) return;
    this.fps = this.qFrames / elapsed;
    this.qFrames = 0;
    this.qStart = now;
    if (!this.autoQuality || document.visibilityState !== 'visible') return;
    if (this.fps < 50 && this.maxPixelRatio > 1) {
      this.maxPixelRatio = Math.max(1, this.maxPixelRatio - 0.25);
      this.resize();
    }
  }

  render() {
    this.#adaptQuality();
    if (this.controls.enabled) this.controls.update();
    this.composer.render();
  }
}
