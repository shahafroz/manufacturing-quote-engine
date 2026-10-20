import { describe, it, expect } from 'vitest';
import { load } from './load.js';
import { autoOrient, rotationToZ, rotatePositions, candidateDirections } from '../orient.js';
import { computeGeometry } from '../geometry.js';
import { detectOverhangs } from '../overhang.js';

describe('auto-orientation', () => {
  it('rotationToZ turns every candidate direction to straight up', () => {
    for (const u of candidateDirections()) {
      const r = rotatePositions(new Float32Array(u), rotationToZ(u));
      expect(r[0]).toBeCloseTo(0, 5);
      expect(r[1]).toBeCloseTo(0, 5);
      expect(r[2]).toBeCloseTo(1, 5);
    }
  });

  it('flips an upside-down hollow cube so the cavity ceiling is lower', () => {
    const p = load('hollow_cube.stl');
    const upsideDown = rotatePositions(p, [1, 0, 0, 0, -1, 0, 0, 0, -1]);
    const o = autoOrient(upsideDown);
    expect(o.after.supportVolume).toBeLessThanOrEqual(o.before.supportVolume * 1.0001 + 1e-6);
  });

  it('rotating keeps the volume', () => {
    const p = load('sphere_r10.stl');
    const o = autoOrient(p);
    expect(computeGeometry(o.positions).volume).toBeCloseTo(computeGeometry(p).volume, 0);
    expect(detectOverhangs(o.positions).supportVolume).toBeCloseTo(o.after.supportVolume, 3);
  });
});
