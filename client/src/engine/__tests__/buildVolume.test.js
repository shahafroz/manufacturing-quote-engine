import { describe, it, expect } from 'vitest';
import { load } from './load.js';
import { fitsVolume, checkBuildVolume, rotateToFit } from '../buildVolume.js';
import { scalePositions } from '../units.js';
import { computeGeometry } from '../geometry.js';

const printer = { x: 250, y: 210, z: 220 };

describe('build volume', () => {
  it('a 20 mm cube fits', () => {
    expect(fitsVolume([20, 20, 20], printer)).toBe(true);
  });
  it('a footprint can be turned 90° to fit', () => {
    expect(fitsVolume([200, 240, 10], printer)).toBe(true);
  });
  it('a tall thin part that is too tall fits when laid down', () => {
    // 20 mm cube stretched to 20 × 20 × 240 (too tall for 220)
    const p = load('cube20_binary.stl').map((v, i) => (i % 3 === 2 ? v * 12 : v));
    const r = checkBuildVolume(p, computeGeometry(p).bbox.size, printer);
    expect(r.fits).toBe(false);
    expect(r.canFit).toBe(true);
    const size = computeGeometry(rotateToFit(p, r.up)).bbox.size;
    expect(fitsVolume(size, printer)).toBe(true);
    expect(size[2]).toBeCloseTo(20, 3); // laid flat, not stood on a corner
  });
  it('a part bigger than the printer every way cannot fit', () => {
    const p = scalePositions(load('cube20_binary.stl'), 15); // 300 mm cube
    const r = checkBuildVolume(p, computeGeometry(p).bbox.size, printer);
    expect(r.fits).toBe(false);
    expect(r.canFit).toBe(false);
  });
});
