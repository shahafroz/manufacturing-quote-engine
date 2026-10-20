// Mini slicer. Cut the mesh with a horizontal plane at every layer height, turn each cut into
// closed outlines ("contours"), and measure them. This is the same first stage a real slicer
// like PrusaSlicer runs before planning toolpaths.
//
// 1. A triangle that crosses the plane z = h is cut along a line segment (two of its edges
//    cross the plane; interpolate where).
// 2. Each segment is pointed so that the solid is on its left (using the face normal). Then
//    outer walls run counter-clockwise and holes run clockwise.
// 3. Segments from neighbouring triangles share end points. Hashing each start point lets us
//    walk from segment to segment until we're back where we started: a closed loop.
// 4. Signed area (shoelace formula) of the loops gives the cross-section area; holes come out
//    negative, so they subtract automatically.

const KEY = 1e4;
const key2 = (x, y) => Math.round(x * KEY) + ',' + Math.round(y * KEY);

export function sliceMesh(p, layerHeight = 0.2) {
  const triCount = p.length / 9;
  let minZ = Infinity, maxZ = -Infinity;
  const tMin = new Float32Array(triCount), tMax = new Float32Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const i = t * 9;
    tMin[t] = Math.min(p[i + 2], p[i + 5], p[i + 8]);
    tMax[t] = Math.max(p[i + 2], p[i + 5], p[i + 8]);
    if (tMin[t] < minZ) minZ = tMin[t];
    if (tMax[t] > maxZ) maxZ = tMax[t];
  }

  // Sort triangles by their lowest point so each layer only looks at nearby triangles.
  const order = Array.from({ length: triCount }, (_, t) => t).sort((a, b) => tMin[a] - tMin[b]);
  let next = 0;
  let active = [];

  const layerCount = Math.max(1, Math.floor((maxZ - minZ) / layerHeight));
  const layers = [];

  for (let L = 0; L < layerCount; L++) {
    const z = minZ + (L + 0.5) * layerHeight; // cut through the middle of the layer
    while (next < triCount && tMin[order[next]] <= z) active.push(order[next++]);
    active = active.filter((t) => tMax[t] >= z);

    const segs = [];
    for (const t of active) {
      const seg = cutTriangle(p, t * 9, z);
      if (seg) segs.push(seg);
    }
    const loops = stitch(segs);

    let area = 0, perimeter = 0;
    for (const loop of loops) {
      area += signedArea(loop);
      perimeter += loopLength(loop);
    }
    layers.push({ z, loops, area, perimeter });
  }

  return { layerHeight, minZ, maxZ, layers };
}

// Returns [x1, y1, x2, y2] for the segment where triangle crosses plane z, or null.
function cutTriangle(p, i, z) {
  const pts = [];
  for (let e = 0; e < 3; e++) {
    const a = i + e * 3, b = i + ((e + 1) % 3) * 3;
    const za = p[a + 2] - z, zb = p[b + 2] - z;
    if ((za < 0 && zb >= 0) || (za >= 0 && zb < 0)) {
      const s = za / (za - zb);
      pts.push(p[a] + s * (p[b] - p[a]), p[a + 1] + s * (p[b + 1] - p[a + 1]));
    }
  }
  if (pts.length !== 4) return null;

  // face normal (x, y) decides direction: solid on the left means direction = (-ny, nx)
  const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
  const wx = p[i + 6] - p[i], wy = p[i + 7] - p[i + 1], wz = p[i + 8] - p[i + 2];
  const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz;
  const dx = pts[2] - pts[0], dy = pts[3] - pts[1];
  if (dx * -ny + dy * nx < 0) return [pts[2], pts[3], pts[0], pts[1]];
  return pts;
}

function stitch(segs) {
  const byStart = new Map();
  segs.forEach((s, idx) => {
    const k = key2(s[0], s[1]);
    const list = byStart.get(k);
    if (list) list.push(idx);
    else byStart.set(k, [idx]);
  });

  const used = new Uint8Array(segs.length);
  const loops = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    const loop = [segs[s][0], segs[s][1]];
    const startKey = key2(segs[s][0], segs[s][1]);
    let cur = s;
    used[cur] = 1;
    for (let guard = 0; guard < segs.length; guard++) {
      const endKey = key2(segs[cur][2], segs[cur][3]);
      if (endKey === startKey) break; // closed
      const candidates = byStart.get(endKey);
      const nextSeg = candidates && candidates.find((c) => !used[c]);
      if (nextSeg === undefined) break; // open loop (mesh has a hole here)
      loop.push(segs[nextSeg][0], segs[nextSeg][1]);
      used[nextSeg] = 1;
      cur = nextSeg;
    }
    if (loop.length >= 6) loops.push(Float32Array.from(loop));
  }
  return loops;
}

export function signedArea(loop) {
  let a = 0;
  const n = loop.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += loop[i * 2] * loop[j * 2 + 1] - loop[j * 2] * loop[i * 2 + 1];
  }
  return a / 2;
}

export function loopLength(loop) {
  let l = 0;
  const n = loop.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    l += Math.hypot(loop[j * 2] - loop[i * 2], loop[j * 2 + 1] - loop[i * 2 + 1]);
  }
  return l;
}
