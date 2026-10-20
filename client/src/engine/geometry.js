// Geometry of a triangle mesh. Input: Float32Array of positions, 9 numbers per triangle
// (x1 y1 z1 x2 y2 z2 x3 y3 z3). Units are whatever the STL used (almost always mm).

// Volume uses the signed tetrahedron sum: every triangle forms a tetrahedron with the origin,
// volume = a · (b × c) / 6. Faces pointing away from the origin add, faces pointing toward it
// subtract, so the sum is the enclosed volume for ANY closed mesh, convex or not.
export function computeGeometry(p) {
  const n = p.length / 9;
  let volume = 0;
  let area = 0;
  let cx = 0, cy = 0, cz = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i], ay = p[i + 1], az = p[i + 2];
    const bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
    const qx = p[i + 6], qy = p[i + 7], qz = p[i + 8];

    // signed volume of the tetrahedron (origin, a, b, c)
    const v = (ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx)) / 6;
    volume += v;
    // its centroid is (0 + a + b + c) / 4; weight by its signed volume for the center of mass
    cx += v * (ax + bx + qx) / 4;
    cy += v * (ay + by + qy) / 4;
    cz += v * (az + bz + qz) / 4;

    // triangle area = |(b - a) × (c - a)| / 2
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const wx = qx - ax, wy = qy - ay, wz = qz - az;
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;

    for (let k = 0; k < 9; k += 3) {
      for (let d = 0; d < 3; d++) {
        const val = p[i + k + d];
        if (val < min[d]) min[d] = val;
        if (val > max[d]) max[d] = val;
      }
    }
  }

  const absVol = Math.abs(volume);
  return {
    triangleCount: n,
    volume: absVol, // mm³
    inverted: volume < 0, // negative signed volume = normals point inward
    surfaceArea: area, // mm²
    bbox: { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] },
    centerOfMass: volume !== 0 ? [cx / volume, cy / volume, cz / volume] : [0, 0, 0],
  };
}
