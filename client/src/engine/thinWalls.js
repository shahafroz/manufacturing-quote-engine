// Thin-wall detection. From the middle of each face, shoot a ray straight into the part (along
// the inward normal) and measure how far it travels before leaving through the other side.
// That distance is the local wall thickness. Walls thinner than about two nozzle widths
// (0.8 mm for a 0.4 mm nozzle) print badly or not at all.
//
// Speed: we only care about hits closer than the limit, so triangles are put in a grid of
// small cells and each ray only tests the triangles in the few cells it passes through.

export const DEFAULT_MIN_WALL = 0.8; // mm
const MIN_HIT = 0.02; // mm

export function detectThinWalls(p, minWall = DEFAULT_MIN_WALL) {
  const triCount = p.length / 9;
  const mask = new Uint8Array(triCount);
  if (triCount === 0) return { mask, thinArea: 0, minThickness: null, checked: 0 };

  // grid with cells about the size of the search distance
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3)
    for (let d = 0; d < 3; d++) {
      if (p[i + d] < min[d]) min[d] = p[i + d];
      if (p[i + d] > max[d]) max[d] = p[i + d];
    }
  const size = [0, 1, 2].map((d) => max[d] - min[d]);
  // Cell size: at least the search distance (so a ray touches ≤ 2 cells per axis), and at
  // least the typical triangle size (so big triangles don't get copied into thousands of cells).
  let extent = 0;
  for (let t = 0; t < triCount; t++) {
    const i = t * 9;
    extent += Math.max(
      Math.max(p[i], p[i + 3], p[i + 6]) - Math.min(p[i], p[i + 3], p[i + 6]),
      Math.max(p[i + 1], p[i + 4], p[i + 7]) - Math.min(p[i + 1], p[i + 4], p[i + 7]),
      Math.max(p[i + 2], p[i + 5], p[i + 8]) - Math.min(p[i + 2], p[i + 5], p[i + 8]),
    );
  }
  const cell = Math.max(minWall, extent / triCount, Math.max(...size) / 200);
  const dims = size.map((s) => Math.max(1, Math.ceil(s / cell) + 1));
  const [mx, my, mz] = min, [dx0, dy0, dz0] = dims;
  const cellOf = (v, d) => {
    const c = Math.floor((v - (d === 0 ? mx : d === 1 ? my : mz)) / cell);
    const top = (d === 0 ? dx0 : d === 1 ? dy0 : dz0) - 1;
    return c < 0 ? 0 : c > top ? top : c;
  };
  const grid = new Map();
  for (let t = 0; t < triCount; t++) {
    const i = t * 9;
    const x0 = cellOf(Math.min(p[i], p[i + 3], p[i + 6]), 0), x1 = cellOf(Math.max(p[i], p[i + 3], p[i + 6]), 0);
    const y0 = cellOf(Math.min(p[i + 1], p[i + 4], p[i + 7]), 1), y1 = cellOf(Math.max(p[i + 1], p[i + 4], p[i + 7]), 1);
    const z0 = cellOf(Math.min(p[i + 2], p[i + 5], p[i + 8]), 2), z1 = cellOf(Math.max(p[i + 2], p[i + 5], p[i + 8]), 2);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const k = (x * dims[1] + y) * dims[2] + z; // unique cell number
          const list = grid.get(k);
          if (list) list.push(t);
          else grid.set(k, [t]);
        }
  }

  // each triangle's plane (unit normal n and offset d, with n·x = d on the plane), so most
  // candidates can be rejected with one dot product before the full triangle test
  const planes = new Float64Array(triCount * 4);
  for (let t = 0; t < triCount; t++) {
    const i = t * 9;
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const wx = p[i + 6] - p[i], wy = p[i + 7] - p[i + 1], wz = p[i + 8] - p[i + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1;
    planes[t * 4] = nx / l; planes[t * 4 + 1] = ny / l; planes[t * 4 + 2] = nz / l;
    planes[t * 4 + 3] = (nx * p[i] + ny * p[i + 1] + nz * p[i + 2]) / l;
  }

  let thinArea = 0, minThickness = Infinity;
  const seen = new Int32Array(triCount).fill(-1);
  for (let t = 0; t < triCount; t++) {
    const i = t * 9;
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const wx = p[i + 6] - p[i], wy = p[i + 7] - p[i + 1], wz = p[i + 8] - p[i + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0) continue;
    nx /= len; ny /= len; nz /= len;
    // ray from the face centre, pointing into the part
    const ox = (p[i] + p[i + 3] + p[i + 6]) / 3, oy = (p[i + 1] + p[i + 4] + p[i + 7]) / 3, oz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
    const dx = -nx, dy = -ny, dz = -nz;
    const ex = ox + dx * minWall, ey = oy + dy * minWall, ez = oz + dz * minWall;

    let best = Infinity;
    const x0 = cellOf(Math.min(ox, ex), 0), x1 = cellOf(Math.max(ox, ex), 0);
    const y0 = cellOf(Math.min(oy, ey), 1), y1 = cellOf(Math.max(oy, ey), 1);
    const z0 = cellOf(Math.min(oz, ez), 2), z1 = cellOf(Math.max(oz, ez), 2);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const list = grid.get((x * dims[1] + y) * dims[2] + z);
          if (!list) continue;
          for (const s of list) {
            if (s === t || seen[s] === t) continue;
            seen[s] = t;
            // distance along the ray to this triangle's plane; skip if it can't beat `best`
            const q = s * 4;
            const denom = planes[q] * dx + planes[q + 1] * dy + planes[q + 2] * dz;
            if (Math.abs(denom) < 1e-9) continue;
            const tp = (planes[q + 3] - (planes[q] * ox + planes[q + 1] * oy + planes[q + 2] * oz)) / denom;
            if (tp <= MIN_HIT || tp >= best || tp >= minWall) continue;
            const h = rayTriangle(ox, oy, oz, dx, dy, dz, p, s * 9);
            // ignore hits right at the start: neighbouring or overlapping faces, not a real wall
            if (h > MIN_HIT && h < best) best = h;
          }
        }
    if (best < minWall) {
      mask[t] = 1;
      thinArea += len / 2;
      if (best < minThickness) minThickness = best;
    }
  }
  return { mask, thinArea, minThickness: Number.isFinite(minThickness) ? minThickness : null, minWall, checked: triCount };
}

// Möller–Trumbore ray/triangle intersection. Returns the distance along the ray, or Infinity.
function rayTriangle(ox, oy, oz, dx, dy, dz, p, i) {
  const e1x = p[i + 3] - p[i], e1y = p[i + 4] - p[i + 1], e1z = p[i + 5] - p[i + 2];
  const e2x = p[i + 6] - p[i], e2y = p[i + 7] - p[i + 1], e2z = p[i + 8] - p[i + 2];
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det;
  const tx = ox - p[i], ty = oy - p[i + 1], tz = oz - p[i + 2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return Infinity;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return Infinity;
  return (e2x * qx + e2y * qy + e2z * qz) * inv;
}
