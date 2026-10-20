import { describe, it, expect } from 'vitest';
import { load } from './load.js';
import { detectThinWalls } from '../thinWalls.js';
import { scalePositions } from '../units.js';

describe('thin walls', () => {
  it('a solid 20 mm cube has no thin walls', () => {
    expect(detectThinWalls(load('cube20_binary.stl')).thinArea).toBe(0);
  });
  it('the hollow cube has 5 mm walls: fine at 0.8 mm, too thin at 6 mm', () => {
    const p = load('hollow_cube.stl');
    expect(detectThinWalls(p, 0.8).thinArea).toBe(0);
    const strict = detectThinWalls(p, 6);
    expect(strict.thinArea).toBeGreaterThan(0);
    expect(strict.minThickness).toBeCloseTo(5, 3);
  });
  it('a 0.5 mm thick plate is flagged', () => {
    const p = load('cube20_binary.stl').map((v, i) => (i % 3 === 2 ? v * 0.025 : v)); // 20 × 20 × 0.5
    const r = detectThinWalls(p, 0.8);
    expect(r.minThickness).toBeCloseTo(0.5, 3);
    expect(r.thinArea).toBeCloseTo(800, 0); // top + bottom faces
  });
  it('stays fast on a long bar rotated diagonally (big slanted triangles)', async () => {
    const { rotatePositions, rotationToZ } = await import('../orient.js');
    const bar = load('cube20_binary.stl').map((v, i) => (i % 3 === 2 ? v * 12 : v));
    const tilted = rotatePositions(bar, rotationToZ([1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)]));
    const start = performance.now();
    expect(detectThinWalls(tilted).thinArea).toBe(0);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('a scaled-down hollow cube (0.5 mm walls) is flagged', () => {
    const r = detectThinWalls(scalePositions(load('hollow_cube.stl'), 0.1), 0.8);
    expect(r.minThickness).toBeCloseTo(0.5, 3);
  });
});
