import { describe, it, expect } from 'vitest';
import { load } from './load.js';
import { sliceMesh } from '../slice.js';
import { computeGeometry } from '../geometry.js';

describe('sliceMesh', () => {
  it('cube: 100 layers, each one square loop of 400 mm² and 80 mm perimeter', () => {
    const s = sliceMesh(load('cube20_binary.stl'), 0.2);
    expect(s.layers.length).toBe(100);
    for (const L of s.layers) {
      expect(L.loops.length).toBe(1);
      expect(L.area).toBeCloseTo(400, 3);
      expect(L.perimeter).toBeCloseTo(80, 3);
    }
  });

  it('hollow cube: middle layers have an outer loop and a hole (400 − 100 = 300 mm²)', () => {
    const mid = sliceMesh(load('hollow_cube.stl'), 0.2).layers[50];
    expect(mid.loops.length).toBe(2);
    expect(mid.area).toBeCloseTo(300, 3);
    expect(mid.perimeter).toBeCloseTo(120, 3);
  });

  it('sphere: adding up layer areas × layer height gives the volume within 1 %', () => {
    const p = load('sphere_r10.stl');
    const s = sliceMesh(p, 0.1);
    const vol = s.layers.reduce((a, L) => a + L.area * 0.1, 0);
    const exact = computeGeometry(p).volume;
    expect(Math.abs(vol - exact) / exact).toBeLessThan(0.01);
  });
});
