// Step 10: prove the STL parser works, automatically, every time you run `npm test`.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseStl } from '../parseStl.js';

// Read a test file from the fixtures folder and hand its bytes to the parser.
function load(name) {
  const bytes = readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)));
  return parseStl(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

describe('parseStl', () => {
  it('reads a binary cube: 12 triangles', () => {
    expect(load('cube20_binary.stl').length / 9).toBe(12);
  });

  it('reads an ASCII cube (numbers like 2.000000e+01): 12 triangles', () => {
    expect(load('cube20_ascii.stl').length / 9).toBe(12);
  });

  it('binary and ASCII give exactly the same numbers', () => {
    expect(Array.from(load('cube20_ascii.stl'))).toEqual(Array.from(load('cube20_binary.stl')));
  });

  it('every corner of the cube is 0 or 20 mm', () => {
    for (const v of load('cube20_binary.stl')) expect([0, 20]).toContain(v);
  });

  it('reads a bigger binary file: sphere with 2208 triangles', () => {
    expect(load('sphere_r10.stl').length / 9).toBe(2208);
  });
});
