// Overhang detection (Z is up, as in the STL file and on the printer).
// A face needs support when it faces downward more steeply than the overhang angle (45° by
// default) and isn't resting on the build plate. Its normal's z component tells us how much it
// faces down: z = -1 is a flat ceiling, z = 0 is a vertical wall.

const DEFAULT_ANGLE = 45;

export function detectOverhangs(p, angleDeg = DEFAULT_ANGLE) {
  const triCount = p.length / 9;
  // normal.z below this → needs support. The tiny 1e-4 margin makes faces at exactly the
  // limit angle count as printable, so rounding can't flip them back and forth.
  const limit = -Math.sin((angleDeg * Math.PI) / 180) - 1e-4;
  let minZ = Infinity;
  for (let i = 2; i < p.length; i += 3) if (p[i] < minZ) minZ = p[i];
  const plateTol = 0.05; // mm

  const mask = new Uint8Array(triCount); // 1 = overhang face
  let overhangArea = 0;
  let supportVolume = 0;

  for (let t = 0; t < triCount; t++) {
    const i = t * 9;
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const wx = p[i + 6] - p[i], wy = p[i + 7] - p[i + 1], wz = p[i + 8] - p[i + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len === 0) continue;
    const zUnit = nz / len;
    if (zUnit >= limit) continue;

    const cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
    if (cz - minZ < plateTol) continue; // sitting on the bed, no support needed

    const area = len / 2;
    mask[t] = 1;
    overhangArea += area;
    // support = a column from the build plate up to the face: footprint × height
    supportVolume += area * -zUnit * (cz - minZ);
  }

  return { mask, overhangArea, supportVolume, angle: angleDeg };
}
