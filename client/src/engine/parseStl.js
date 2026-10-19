export function parseStl(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const n = view.getUint32(80, true);
  const isBinary = arrayBuffer.byteLength === 84 + 50 * n;

  return isBinary ? parseBinary(view, n) : parseAscii(arrayBuffer);
}

function parseBinary(view, n) {
  const positions = new Float32Array(n * 9);

  for (let i = 0; i < n; i++) {
    const start = 84 + i * 50 + 12; // start of triangle i, after its normal
    for (let k = 0; k < 9; k++) {
      positions[i * 9 + k] = view.getFloat32(start + k * 4, true);
    }
  }
  return positions;
}

function parseAscii(arrayBuffer) {
  const text = new TextDecoder().decode(arrayBuffer);
  const nums = [];
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    nums.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
  }
  return new Float32Array(nums);
}