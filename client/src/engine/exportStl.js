// Write positions back out as a binary STL (the same format parseStl reads):
// 80-byte header, triangle count, then 50 bytes per triangle with a computed normal.
export function toBinaryStl(p, header = '3D Manufacturing Quote Engine') {
  const n = p.length / 9;
  const buf = new ArrayBuffer(84 + 50 * n);
  const view = new DataView(buf);
  const text = new TextEncoder().encode(header.slice(0, 80));
  new Uint8Array(buf, 0, text.length).set(text);
  view.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    const i = t * 9, o = 84 + t * 50;
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const wx = p[i + 6] - p[i], wy = p[i + 7] - p[i + 1], wz = p[i + 8] - p[i + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1;
    view.setFloat32(o, nx / l, true);
    view.setFloat32(o + 4, ny / l, true);
    view.setFloat32(o + 8, nz / l, true);
    for (let k = 0; k < 9; k++) view.setFloat32(o + 12 + k * 4, p[i + k], true);
  }
  return buf;
}
