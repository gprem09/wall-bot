import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

function squareToQuad(corners) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }
  return new THREE.Matrix3().set(
    x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
    y1 - y0 + g * y1, y3 - y0 + h * y3, y0,
    g, h, 1,
  );
}

export class ProjectionPass extends ShaderPass {
  constructor() {
    super({
      name: 'ProjectionPass',
      uniforms: {
        tDiffuse: { value: null },
        uInvH: { value: new THREE.Matrix3() },
        uBlackPoint: { value: 0.025 },
        uCalib: { value: 0 },
        uFloor: { value: 0.1 },
        uBounds: { value: new THREE.Vector2(0.05, 0.95) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform mat3 uInvH;
        uniform float uBlackPoint;
        uniform float uCalib;
        uniform float uFloor;
        uniform vec2 uBounds;
        varying vec2 vUv;

        float line(float d, float px, float width) {
          return 1.0 - smoothstep(px * width * 0.5, px * (width * 0.5 + 1.0), d);
        }

        void main() {
          vec3 h = uInvH * vec3(vUv, 1.0);
          vec2 uv = h.xy / h.z;
          if (h.z <= 0.0 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }

          vec3 c = texture2D(tDiffuse, uv).rgb;
          float peak = max(max(c.r, c.g), c.b);
          c *= max(peak - uBlackPoint, 0.0) / max(peak, 1e-5) / (1.0 - uBlackPoint);

          if (uCalib > 0.5) {
            vec2 px = fwidth(uv);
            vec2 g = abs(fract(uv * 10.0 + 0.5) - 0.5) / 10.0;
            float grid = max(line(g.x, px.x, 1.0), line(g.y, px.y, 1.0));
            vec2 m = abs(uv - 0.5);
            float mid = max(line(m.x, px.x, 2.0), line(m.y, px.y, 2.0));
            vec2 e = min(uv, 1.0 - uv);
            float edge = max(line(e.x, px.x, 6.0), line(e.y, px.y, 6.0));
            float floorLine = line(abs(uv.y - uFloor), px.y, 3.0);
            float bounds = max(line(abs(uv.x - uBounds.x), px.x, 3.0), line(abs(uv.x - uBounds.y), px.x, 3.0));
            c = max(c, vec3(0.18) * grid);
            c = max(c, vec3(0.35) * mid);
            c = mix(c, vec3(0.2, 0.9, 1.0), edge);
            c = mix(c, vec3(1.0, 0.6, 0.15), floorLine);
            c = mix(c, vec3(1.0, 0.25, 0.8), bounds);
          }
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
  }

  setCorners(corners) {
    this.uniforms.uInvH.value.copy(squareToQuad(corners)).invert();
  }
}
