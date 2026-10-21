import * as THREE from 'three';

const ROBOT_HALF_WIDTH = 0.72;

export class WallSpace {
  constructor(camera, settings) {
    this.camera = camera;
    this.settings = settings;
    this.distance = camera.position.z;
  }

  get halfHeight() {
    return this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
  }

  get halfWidth() {
    return this.halfHeight * this.camera.aspect;
  }

  toWorldX(u) {
    return (u - 0.5) * 2 * this.halfWidth;
  }

  toWorldY(v) {
    return (v - 0.5) * 2 * this.halfHeight;
  }

  get floorWorldY() {
    return this.toWorldY(this.settings.floorY);
  }

  movementRange(scale) {
    const s = this.settings;
    const pad = ROBOT_HALF_WIDTH * scale;
    let min = this.toWorldX(s.boundsLeft) + pad;
    let max = this.toWorldX(s.boundsRight) - pad;
    if (min > max) min = max = (min + max) / 2;
    return [min, max];
  }

  boundsToWorldX(u) {
    const s = this.settings;
    return this.toWorldX(s.boundsLeft + u * (s.boundsRight - s.boundsLeft));
  }
}
