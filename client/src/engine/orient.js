// Auto-orientation: try many "which way is up" directions and keep the one that needs the
// least support material while not making the print too tall.
//
// Rotating the whole mesh for every candidate would be slow, so we precompute each face's
// unit normal, area and centroid once. For a candidate "up" direction u, a point's new height
// is simply dot(point, u) and a face's new normal.z is dot(normal, u).

import { detectOverhangs } from './overhang.js';

const HEIGHT_WEIGHT = 20; // mm² — how much 1 mm of extra height "costs" compared with 1 mm³ of support

export function candidateDirections() {
  // the 26 directions to the faces, edges and corners of a cube
  const dirs = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue;
        const l = Math.hypot(x, y, z);
        dirs.push([x / l, y / l, z / l]);
      }
  return dirs;
}

export function scoreDirections(p, angleDeg = 45) {
  const triCount = p.length / 9;
  const normals = new Float32Array(triCount * 3);
  const areas = new Float32Array(triCount);
  const centroids = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const i = t * 9;
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const wx = p[i + 6] - p[i], wy = p[i + 7] - p[i + 1], wz = p[i + 8] - p[i + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    normals.set([nx / len, ny / len, nz / len], t * 3);
    areas[t] = len / 2;
    centroids.set([(p[i] + p[i + 3] + p[i + 6]) / 3, (p[i + 1] + p[i + 4] + p[i + 7]) / 3, (p[i + 2] + p[i + 5] + p[i + 8]) / 3], t * 3);
  }

  const limit = -Math.sin((angleDeg * Math.PI) / 180) - 1e-4; // same rule as overhang.js
  return candidateDirections().map((u) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      const h = p[i] * u[0] + p[i + 1] * u[1] + p[i + 2] * u[2];
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
    let support = 0;
    for (let t = 0; t < triCount; t++) {
      const nz = normals[t * 3] * u[0] + normals[t * 3 + 1] * u[1] + normals[t * 3 + 2] * u[2];
      if (nz >= limit) continue;
      const h = centroids[t * 3] * u[0] + centroids[t * 3 + 1] * u[1] + centroids[t * 3 + 2] * u[2] - lo;
      if (h < 0.05) continue;
      support += areas[t] * -nz * h;
    }
    const height = hi - lo;
    return { up: u, supportVolume: support, height, score: support + HEIGHT_WEIGHT * height };
  });
}

// Rotation matrix (row-major 3×3) that turns direction u into +Z (Rodrigues' formula).
export function rotationToZ(u) {
  const [x, y, z] = u;
  if (z > 0.999999) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (z < -0.999999) return [1, 0, 0, 0, -1, 0, 0, 0, -1]; // 180° about X
  // axis k = u × Z, angle θ with cos θ = z
  const kx = y, ky = -x; // (kz = 0)
  const s = Math.hypot(kx, ky);
  const ax = kx / s, ay = ky / s;
  const c = z, v = 1 - c;
  return [
    c + ax * ax * v, ax * ay * v, ay * s,
    ax * ay * v, c + ay * ay * v, -ax * s,
    -ay * s, ax * s, c,
  ];
}

export function rotatePositions(p, R) {
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    out[i] = R[0] * x + R[1] * y + R[2] * z;
    out[i + 1] = R[3] * x + R[4] * y + R[5] * z;
    out[i + 2] = R[6] * x + R[7] * y + R[8] * z;
  }
  return out;
}

export function autoOrient(p, angleDeg = 45) {
  const scores = scoreDirections(p, angleDeg);
  const current = scores.find((s) => s.up[2] > 0.999); // the orientation the file came in
  const best = scores.reduce((a, b) => (b.score < a.score ? b : a));
  const rotated = rotatePositions(p, rotationToZ(best.up));
  const check = detectOverhangs(rotated, angleDeg); // recompute exactly on the rotated mesh
  return {
    positions: rotated,
    up: best.up,
    before: { supportVolume: current.supportVolume, height: current.height },
    after: { supportVolume: check.supportVolume, height: best.height },
    reduction: current.supportVolume > 0 ? 1 - check.supportVolume / current.supportVolume : 0,
  };
}
