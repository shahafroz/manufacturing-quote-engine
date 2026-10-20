// Mesh validation. A printable mesh is "watertight": every edge is shared by exactly two
// triangles, and those two triangles walk the edge in opposite directions (consistent winding).
//
// STL stores every triangle separately, so the same corner appears many times. We first
// "weld" identical corners into one shared vertex index, then count how often each edge is used.

const WELD = 1e4; // coordinates rounded to 0.0001 mm before comparing

export function weldVertices(p) {
  const map = new Map();
  const indices = new Uint32Array(p.length / 3);
  let next = 0;
  for (let v = 0; v < indices.length; v++) {
    const key =
      Math.round(p[v * 3] * WELD) + ',' + Math.round(p[v * 3 + 1] * WELD) + ',' + Math.round(p[v * 3 + 2] * WELD);
    let id = map.get(key);
    if (id === undefined) {
      id = next++;
      map.set(key, id);
    }
    indices[v] = id;
  }
  return { indices, vertexCount: next };
}

export function validateMesh(p) {
  const triCount = p.length / 9;
  const { indices, vertexCount } = weldVertices(p);

  // edge key = smaller index * vertexCount + larger index (fits safely in a JS number)
  // value: [use count, direction balance]. Each use adds +1 if walked small→large, −1 otherwise.
  // A healthy edge ends with count 2 and balance 0.
  const edges = new Map();
  let degenerate = 0;

  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];

    // zero-area triangle: two corners welded together, or all three in a line
    const i = t * 9;
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const wx = p[i + 6] - p[i], wy = p[i + 7] - p[i + 1], wz = p[i + 8] - p[i + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    if (a === b || b === c || a === c || nx * nx + ny * ny + nz * nz < 1e-20) {
      degenerate++;
      continue;
    }

    addEdge(edges, vertexCount, a, b);
    addEdge(edges, vertexCount, b, c);
    addEdge(edges, vertexCount, c, a);
  }

  let boundary = 0, nonManifold = 0, flipped = 0;
  const badEdges = []; // vertex index pairs, for drawing in the viewer
  for (const [key, e] of edges) {
    const count = e[0];
    if (count === 1) boundary++;
    else if (count > 2) nonManifold++;
    else if (e[1] !== 0) flipped++; // used twice but walked the same way both times
    if ((count !== 2 || e[1] !== 0) && badEdges.length < 50000) {
      badEdges.push(Math.floor(key / vertexCount), key % vertexCount);
    }
  }

  return {
    vertexCount,
    edgeCount: edges.size,
    boundaryEdges: boundary, // holes
    nonManifoldEdges: nonManifold,
    flippedEdges: flipped, // neighbouring faces with inconsistent normals
    degenerateTriangles: degenerate,
    watertight: boundary === 0 && nonManifold === 0,
    badEdgePositions: edgePositions(p, indices, badEdges),
  };
}

function addEdge(edges, n, a, b) {
  const key = a < b ? a * n + b : b * n + a;
  const dir = a < b ? 1 : -1;
  const e = edges.get(key);
  if (e) {
    e[0]++;
    e[1] += dir;
  } else {
    edges.set(key, [1, dir]);
  }
}

// Turn welded vertex index pairs back into coordinates (6 numbers per edge) for drawing.
function edgePositions(p, indices, pairs) {
  if (pairs.length === 0) return new Float32Array(0);
  const first = new Int32Array(indices.reduce((m, v) => Math.max(m, v), 0) + 1).fill(-1);
  for (let v = 0; v < indices.length; v++) if (first[indices[v]] === -1) first[indices[v]] = v;
  const out = new Float32Array(pairs.length * 3);
  for (let i = 0; i < pairs.length; i++) {
    const v = first[pairs[i]];
    out[i * 3] = p[v * 3];
    out[i * 3 + 1] = p[v * 3 + 1];
    out[i * 3 + 2] = p[v * 3 + 2];
  }
  return out;
}
