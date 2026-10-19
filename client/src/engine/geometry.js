export function computeGeometry(p) {
  let volume = 0, area = 0, cx = 0, cy = 0, cz = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i],     ay = p[i + 1], az = p[i + 2];
    const bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
    const qx = p[i + 6], qy = p[i + 7], qz = p[i + 8];

    // Volume: a · (b × c) / 6 for each triangle (signed tetrahedron with the origin)
    const v = (ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx)) / 6;
    volume += v;

    // Center of mass: each tetrahedron's center is (a + b + c) / 4, weighted by its volume
    cx += v * (ax + bx + qx) / 4;
    cy += v * (ay + by + qy) / 4;
    cz += v * (az + bz + qz) / 4;

    // Area: |(b − a) × (c − a)| / 2
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const wx = qx - ax, wy = qy - ay, wz = qz - az;
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;

    // Bounding box: smallest and largest x, y, z
    for (let k = 0; k < 9; k++) {
      const d = k % 3;
      if (p[i + k] < min[d]) min[d] = p[i + k];
      if (p[i + k] > max[d]) max[d] = p[i + k];
    }
  }

  return {
    triangleCount: p.length / 9,
    volume: Math.abs(volume),
    surfaceArea: area,
    bbox: { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] },
    centerOfMass: [cx / volume, cy / volume, cz / volume],
  };
}