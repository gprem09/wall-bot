import * as THREE from 'three';

export function superellipsoidGeometry(rx, ry, rz, n = 3, widthSegments = 64, heightSegments = 48) {
  const geo = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const v = new THREE.Vector3();
  const g = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const f = (Math.abs(v.x) ** n + Math.abs(v.y) ** n + Math.abs(v.z) ** n) ** (1 / n);
    v.divideScalar(f);

    g.set(
      (Math.sign(v.x) * Math.abs(v.x) ** (n - 1)) / rx,
      (Math.sign(v.y) * Math.abs(v.y) ** (n - 1)) / ry,
      (Math.sign(v.z) * Math.abs(v.z) ** (n - 1)) / rz,
    );
    if (g.lengthSq() < 1e-12) g.set(0, 1, 0);
    g.normalize();

    pos.setXYZ(i, v.x * rx, v.y * ry, v.z * rz);
    nor.setXYZ(i, g.x, g.y, g.z);
  }

  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function latheGeometry(controlPoints, radialSegments = 96, samples = 80) {
  const curve = new THREE.SplineCurve(controlPoints.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getSpacedPoints(samples).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const geometry = new THREE.LatheGeometry(pts, radialSegments);

  const radiusAt = (y) => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if ((y - a.y) * (y - b.y) <= 0) {
        const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
        return a.x + (b.x - a.x) * t;
      }
    }
    return 0;
  };

  return { geometry, radiusAt };
}

export function limbGeometry(radius, length, radialSegments = 32) {
  const geo = new THREE.CapsuleGeometry(radius, length, 12, radialSegments);
  geo.translate(0, -length / 2, 0);
  return geo;
}
