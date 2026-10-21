export const faceVertexPars = `
varying vec2 vFacePos;
`;

export const faceVertexMain = `
vFacePos = position.xy;
`;

export const faceFragmentPars = `
varying vec2 vFacePos;
uniform float uTime;
uniform float uFaceScale;
uniform vec3 uFaceColor;
uniform float uFaceIntensity;
uniform vec2 uLook;
uniform vec2 uEyeOpen;
uniform vec2 uEyeScale;
uniform float uHappy;
uniform float uBrow;
uniform float uMouthCurve;
uniform float uMouthOpen;
uniform float uMouthWidth;
uniform float uMouthAlpha;
uniform float uBlush;
uniform float uScanlines;
uniform float uSqueeze;
uniform float uHeart;
uniform float uTears;
uniform float uSweat;
uniform float uCat;
uniform float uMouthTilt;
uniform float uEyeSize;

float faceRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float faceSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float faceHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return length(p - vec2(0.25, 0.75)) - sqrt(2.0) / 4.0;
  vec2 a = p - vec2(0.0, 1.0);
  vec2 b = p - 0.5 * max(p.x + p.y, 0.0);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}

float faceArc(vec2 p, vec2 sc, float ra, float rb) {
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
}

float faceEye(vec2 p, vec2 c, float side, float open, float scale) {
  scale *= uEyeSize;
  vec2 q = (p - c) / scale;
  vec2 b = vec2(0.135, mix(0.022, 0.2, open));
  float d = faceRoundBox(q, b, min(b.x, b.y) * 0.96);

  float slope = -uBrow * 0.85;
  float lidY = b.y - abs(uBrow) * 0.08;
  d = max(d, (q.y - lidY - slope * q.x * side) / sqrt(1.0 + slope * slope));

  float dHappy = faceArc(q - vec2(0.0, -0.02), vec2(sin(1.15), cos(1.15)), 0.12, 0.042);
  d = mix(d, dHappy, uHappy);

  vec2 tip = vec2(0.06 * side, 0.0);
  float dSqueeze = min(faceSegment(q, vec2(-0.075 * side, 0.085), tip), faceSegment(q, vec2(-0.075 * side, -0.085), tip)) - 0.036;
  d = mix(d, dSqueeze, uSqueeze);

  float hs = 0.27;
  d = mix(d, faceHeart(q / hs + vec2(0.0, 0.55)) * hs, uHeart);

  return d * scale;
}

vec3 faceEmission() {
  vec2 p = vFacePos / uFaceScale;
  vec2 look = uLook * vec2(0.17, 0.11);
  vec2 cL = vec2(-0.41, 0.1) + look;
  vec2 cR = vec2(0.41, 0.1) + look;

  float aa = length(fwidth(p)) * 0.9;

  float dL = faceEye(p, cL, 1.0, uEyeOpen.x, uEyeScale.x);
  float dR = faceEye(p, cR, -1.0, uEyeOpen.y, uEyeScale.y);
  float dEyes = min(dL, dR);

  vec2 mq = p - vec2(0.0, -0.4) - look * 0.6;
  float w = max(uMouthWidth, 0.001);
  float xc = clamp(mq.x, -w, w);
  float k = uMouthCurve * 0.1;
  float fy = k * (xc * xc / (w * w) - 0.5) + uMouthTilt * 0.035 * xc / w;
  float dArc = length(mq - vec2(xc, fy)) - 0.022;

  float ow = w * 0.85;
  float oh = 0.02 + 0.1 * uMouthOpen;
  vec2 oq = mq - vec2(0.0, -oh * 0.35);
  float dEll = (length(oq / vec2(ow, oh)) - 1.0) * min(ow, oh);
  float dOpen = max(dEll, oq.y - mix(oh, 0.0, clamp(uMouthCurve, 0.0, 1.0)));
  float dMouth = mix(dArc, dOpen, smoothstep(0.02, 0.3, uMouthOpen));

  vec2 cq = vec2(abs(mq.x) - 0.055, -(mq.y - 0.02));
  float dCat = faceArc(cq, vec2(sin(1.35), cos(1.35)), 0.055, 0.02);
  dMouth = mix(dMouth, dCat, uCat);

  float eyeFill = 1.0 - smoothstep(-aa, aa, dEyes);
  float mouthFill = (1.0 - smoothstep(-aa, aa, dMouth)) * uMouthAlpha;
  float core = eyeFill * (0.8 + 0.2 * smoothstep(0.0, -0.09, dEyes));
  float eyeGlow = exp(-max(dEyes, 0.0) * 40.0) * 0.12;
  float mouthGlow = exp(-max(dMouth, 0.0) * 50.0) * 0.1 * uMouthAlpha;

  float scan = 1.0 - uScanlines * (0.5 + 0.5 * sin(vFacePos.y * 900.0 - uTime * 3.0));
  vec3 eyeColor = mix(uFaceColor, vec3(1.0, 0.32, 0.62), uHeart);
  vec3 col = (eyeColor * (core + eyeGlow) + uFaceColor * (mouthFill + mouthGlow)) * scan * uFaceIntensity;

  if (uTears > 0.001) {
    float len = 0.5 * uTears;
    float tears = 0.0;
    for (int i = 0; i < 2; i++) {
      vec2 c = i == 0 ? cL : cR;
      vec2 tq = p - vec2(c.x, c.y - 0.05 - len * 0.5);
      float dT = faceRoundBox(tq, vec2(0.032, len * 0.5), 0.03);
      float flow = 0.6 + 0.4 * sin(tq.y * 38.0 + uTime * 8.0);
      tears += (1.0 - smoothstep(-aa, aa, dT)) * flow;
    }
    col += vec3(0.4, 0.75, 1.0) * tears * uTears * uFaceIntensity * 0.45;
  }

  if (uSweat > 0.001) {
    vec2 sq = p - vec2(0.76, 0.36 + 0.015 * sin(uTime * 2.2));
    float dDrop = min(length(sq) - 0.06, faceSegment(sq, vec2(0.0), vec2(0.0, 0.14)) - 0.06 * (1.0 - clamp(sq.y / 0.14, 0.0, 1.0)));
    float rim = 1.0 - smoothstep(0.0, aa * 1.5, abs(dDrop) - 0.009);
    float fill = (1.0 - smoothstep(-aa, aa, dDrop)) * 0.35;
    col += vec3(0.45, 0.8, 1.0) * (rim + fill) * uSweat * uFaceIntensity * 0.4;
  }

  vec2 sp = vec2(-0.05, 0.075) * uEyeSize;
  float sr = 0.028 * uEyeSize;
  float sparkL = 1.0 - smoothstep(sr - aa, sr + aa, length(p - cL - sp * uEyeScale.x));
  float sparkR = 1.0 - smoothstep(sr - aa, sr + aa, length(p - cR - sp * uEyeScale.y));
  float sparkGate = smoothstep(0.65, 0.95, min(uEyeOpen.x, uEyeOpen.y)) * (1.0 - uHappy) * (1.0 - uSqueeze);
  col += vec3(2.2) * (sparkL + sparkR) * eyeFill * sparkGate;

  vec2 bL = (p - vec2(-0.64, -0.2)) / vec2(0.13, 0.055);
  vec2 bR = (p - vec2(0.64, -0.2)) / vec2(0.13, 0.055);
  float blush = exp(-dot(bL, bL)) + exp(-dot(bR, bR));
  col += vec3(1.0, 0.28, 0.55) * blush * uBlush * 0.9;

  return col;
}
`;

export const faceFragmentMain = `
totalEmissiveRadiance += faceEmission();
`;
