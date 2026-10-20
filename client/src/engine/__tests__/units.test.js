import { describe, it, expect } from 'vitest';
import { suggestUnits, scalePositions } from '../units.js';

describe('unit check', () => {
  it('a 20 mm part looks fine', () => {
    expect(suggestUnits([20, 20, 20])).toBe(null);
  });
  it('a part 2 units across is probably inches or cm', () => {
    expect(suggestUnits([2, 1.5, 1]).options).toEqual(['inches', 'cm']);
  });
  it('a part 0.05 units across is probably metres', () => {
    expect(suggestUnits([0.05, 0.03, 0.02]).options[0]).toBe('meters');
  });
  it('scaling multiplies every coordinate', () => {
    expect(Array.from(scalePositions(new Float32Array([1, 2, 3]), 25.4))).toEqual([25.4, 50.8, 76.19999694824219].map((v) => Math.fround(v)));
  });
});
