import { describe, it, expect } from 'vitest';
import { load } from './load.js';
import { detectOverhangs } from '../overhang.js';

describe('detectOverhangs', () => {
  it('a cube sitting on the plate needs no support', () => {
    const o = detectOverhangs(load('cube20_binary.stl'));
    expect(o.supportVolume).toBe(0);
    expect(o.mask.every((m) => m === 0)).toBe(true);
  });

  it('the ceiling inside the hollow cube needs support', () => {
    const o = detectOverhangs(load('hollow_cube.stl'));
    expect(o.overhangArea).toBeCloseTo(100, 3); // 10 × 10 mm ceiling
    expect(o.supportVolume).toBeCloseTo(1500, 1); // 15 mm above the plate
  });

  it('the bottom half of a floating sphere overhangs', () => {
    const o = detectOverhangs(load('sphere_r10.stl'));
    expect(o.supportVolume).toBeGreaterThan(0);
  });
});
