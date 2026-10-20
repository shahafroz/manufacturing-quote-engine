// Automatic mesh repair, in four passes:
//  1. drop zero-area triangles
//  2. make every face point the same way as its neighbours (walk across shared edges and flip
//     any neighbour that walks the shared edge in the same direction)
//  3. fix inside-out parts: if a connected piece encloses negative volume, flip all its faces
//  4. close holes: follow the open edges around each hole and fill it with a fan of triangles
//     to its centre point
// Returns new positions plus a report and a mask of the triangles we added (to show in blue).

import { weldVertices } from './validate.js';

const MAX_HOLE_EDGES = 2000;

export function repairMesh(p) {
  const report = { degenerateRemoved: 0, facesFlipped: 0, partsTurnedRightSideOut: 0, holesFilled: 0, trianglesAdded: 0, holesSkipped: 0 };

  // ---- 1. degenerate triangles ----
  let { indices, vertexCount } = weldVertices(p);
  const coords = new Float64Array(vertexCount * 3);
  for (let v = 0; v < indices.length; v++) coords.set([p[v * 3], p[v * 3 + 1], p[v * 3 + 2]], indices[v] * 3);
  let tris = [];
  for (let t = 0; t < p.length / 9; t++) {
    const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
    if (a === b || b === c || a === c || triArea2(coords, a, b, c) < 1e-20) {
      report.degenerateRemoved++;
      continue;
    }
    tris.push([a, b, c]);
  }

  // ---- 2. consistent orientation ----
  const edgeKey = (a, b) => (a < b ? a * vertexCount + b : b * vertexCount + a);
  const edgeTris = new Map();
  tris.forEach((tri, t) => {
    for (let k = 0; k < 3; k++) {
      const key = edgeKey(tri[k], tri[(k + 1) % 3]);
      const list = edgeTris.get(key);
      if (list) list.push(t);
      else edgeTris.set(key, [t]);
    }
  });
  const walksForward = (tri, a, b) => {
    for (let k = 0; k < 3; k++) if (tri[k] === a && tri[(k + 1) % 3] === b) return true;
    return false;
  };
  const component = new Int32Array(tris.length).fill(-1);
  const flipped = new Uint8Array(tris.length); // net flips per face, for the report
  let components = 0;
  for (let start = 0; start < tris.length; start++) {
    if (component[start] !== -1) continue;
    const id = components++;
    component[start] = id;
    const queue = [start];
    while (queue.length) {
      const t = queue.pop();
      const tri = tris[t];
      for (let k = 0; k < 3; k++) {
        const a = tri[k], b = tri[(k + 1) % 3];
        const list = edgeTris.get(edgeKey(a, b));
        if (!list || list.length !== 2) continue; // only walk across clean edges
        const n = list[0] === t ? list[1] : list[0];
        if (component[n] !== -1) continue;
        // a good neighbour walks the shared edge the other way (b → a)
        if (walksForward(tris[n], a, b)) {
          tris[n] = [tris[n][0], tris[n][2], tris[n][1]];
          flipped[n] ^= 1;
        }
        component[n] = id;
        queue.push(n);
      }
    }
  }

  // ---- 3. inside-out pieces ----
  const volume = new Float64Array(components);
  tris.forEach((tri, t) => (volume[component[t]] += signedVolume(coords, tri)));
  tris = tris.map((tri, t) => {
    if (volume[component[t]] >= 0) return tri;
    flipped[t] ^= 1;
    return [tri[0], tri[2], tri[1]];
  });
  // Report what actually changed compared with the file: if most of a piece was flipped, the
  // piece was inside out; otherwise only the minority of faces were wrong.
  const size = new Int32Array(components), net = new Int32Array(components);
  tris.forEach((_, t) => { size[component[t]]++; net[component[t]] += flipped[t]; });
  for (let c = 0; c < components; c++) {
    if (net[c] * 2 > size[c]) { report.partsTurnedRightSideOut++; report.facesFlipped += size[c] - net[c]; }
    else report.facesFlipped += net[c];
  }

  // ---- 4. fill holes ----
  // open edges, kept with the direction their triangle walks them
  const count = new Map();
  for (const tri of tris) for (let k = 0; k < 3; k++) {
    const key = edgeKey(tri[k], tri[(k + 1) % 3]);
    count.set(key, (count.get(key) || 0) + 1);
  }
  const nextOf = new Map(); // a hole is walked opposite to its open edges: b → a
  for (const tri of tris) for (let k = 0; k < 3; k++) {
    const a = tri[k], b = tri[(k + 1) % 3];
    if (count.get(edgeKey(a, b)) === 1) {
      if (nextOf.has(b)) nextOf.get(b).push(a);
      else nextOf.set(b, [a]);
    }
  }
  const added = [];
  let extra = [];
  const used = new Set();
  for (const [startV, outs] of nextOf) {
    for (const first of outs) {
      const k0 = startV + '>' + first;
      if (used.has(k0)) continue;
      const loop = [startV];
      let cur = startV, nxt = first, ok = false;
      used.add(k0);
      for (let guard = 0; guard < MAX_HOLE_EDGES; guard++) {
        loop.push(nxt);
        if (nxt === startV) { ok = true; break; }
        const options = (nextOf.get(nxt) || []).filter((o) => !used.has(nxt + '>' + o));
        if (!options.length) break;
        cur = nxt;
        nxt = options[0];
        used.add(cur + '>' + nxt);
      }
      loop.pop(); // last entry repeats the start
      if (!ok || loop.length < 3) {
        report.holesSkipped++;
        continue;
      }
      // fan from the loop's centre point
      let cx = 0, cy = 0, cz = 0;
      for (const v of loop) { cx += coords[v * 3]; cy += coords[v * 3 + 1]; cz += coords[v * 3 + 2]; }
      const centre = [cx / loop.length, cy / loop.length, cz / loop.length];
      const ci = vertexCount + extra.length / 3;
      extra.push(...centre);
      for (let i = 0; i < loop.length; i++) {
        added.push([loop[i], loop[(i + 1) % loop.length], ci]);
      }
      report.holesFilled++;
    }
  }
  report.trianglesAdded = added.length;

  // ---- back to a flat positions array ----
  const all = tris.concat(added);
  const allCoords = new Float64Array(coords.length + extra.length);
  allCoords.set(coords);
  allCoords.set(extra, coords.length);
  const out = new Float32Array(all.length * 9);
  const addedMask = new Uint8Array(all.length);
  all.forEach((tri, t) => {
    for (let k = 0; k < 3; k++) for (let d = 0; d < 3; d++) out[t * 9 + k * 3 + d] = allCoords[tri[k] * 3 + d];
    if (t >= tris.length) addedMask[t] = 1;
  });
  report.changed = report.degenerateRemoved + report.facesFlipped + report.partsTurnedRightSideOut + report.holesFilled > 0;
  return { positions: out, report, addedMask };
}

function triArea2(c, a, b, d) {
  const ux = c[b * 3] - c[a * 3], uy = c[b * 3 + 1] - c[a * 3 + 1], uz = c[b * 3 + 2] - c[a * 3 + 2];
  const wx = c[d * 3] - c[a * 3], wy = c[d * 3 + 1] - c[a * 3 + 1], wz = c[d * 3 + 2] - c[a * 3 + 2];
  const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
  return nx * nx + ny * ny + nz * nz;
}

function signedVolume(c, [a, b, d]) {
  const ax = c[a * 3], ay = c[a * 3 + 1], az = c[a * 3 + 2];
  const bx = c[b * 3], by = c[b * 3 + 1], bz = c[b * 3 + 2];
  const dx = c[d * 3], dy = c[d * 3 + 1], dz = c[d * 3 + 2];
  return (ax * (by * dz - bz * dy) - ay * (bx * dz - bz * dx) + az * (bx * dy - by * dx)) / 6;
}
