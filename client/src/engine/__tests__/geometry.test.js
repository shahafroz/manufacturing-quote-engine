import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseStl } from '../parseStl.js';
import { computeGeometry } from '../geometry.js';

function load(name) {
  const b = readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)));
  return parseStl(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

describe('computeGeometry', () => {
  it('cube: 8000 mm³, 2400 mm², 20×20×20, center (10,10,10)', () => {
    const g = computeGeometry(load('cube20_binary.stl'));
    expect(g.volume).toBeCloseTo(8000, 3);
    expect(g.surfaceArea).toBeCloseTo(2400, 3);
    expect(g.bbox.size).toEqual([20, 20, 20]);
    g.centerOfMass.forEach((v) => expect(v).toBeCloseTo(10, 3));
  });

  it('hollow cube: 7000 mm³ (the cavity subtracts)', () => {
    expect(computeGeometry(load('hollow_cube.stl')).volume).toBeCloseTo(7000, 3);
  });

  it('sphere: within 1% of 4/3·π·r³', () => {
    const exact = (4 / 3) * Math.PI * 1000;
    const g = computeGeometry(load('sphere_r10.stl'));
    expect(Math.abs(g.volume - exact) / exact).toBeLessThan(0.01);
  });
})