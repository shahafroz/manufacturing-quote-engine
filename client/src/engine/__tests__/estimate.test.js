import { describe, it, expect } from 'vitest';
import { load } from './load.js';
import { sliceMesh } from '../slice.js';
import { computeGeometry } from '../geometry.js';
import { estimatePrint, estimateCnc } from '../estimate.js';

describe('estimates', () => {
  it('20 mm cube print: plastic between shell-only and solid, time 10–60 min', () => {
    const e = estimatePrint(sliceMesh(load('cube20_binary.stl'), 0.2));
    expect(e.extrudedVolume).toBeGreaterThan(2000);
    expect(e.extrudedVolume).toBeLessThan(8000);
    expect(e.timeS).toBeGreaterThan(600);
    expect(e.timeS).toBeLessThan(3600);
  });

  it('more infill means more plastic and more time', () => {
    const s = sliceMesh(load('cube20_binary.stl'), 0.2);
    const lo = estimatePrint(s, 0, { infill: 0.1 });
    const hi = estimatePrint(s, 0, { infill: 0.5 });
    expect(hi.extrudedVolume).toBeGreaterThan(lo.extrudedVolume);
    expect(hi.timeS).toBeGreaterThan(lo.timeS);
  });

  it('CNC cube: 6 setups, removes stock (26 mm block) minus the part', () => {
    const p = load('cube20_binary.stl');
    const c = estimateCnc(computeGeometry(p), p, 3);
    expect(c.setups).toBe(6);
    expect(c.removalVolume).toBeCloseTo(26 ** 3 - 8000, 3);
  });
});
