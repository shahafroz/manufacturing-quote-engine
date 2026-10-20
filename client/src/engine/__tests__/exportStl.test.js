import { describe, it, expect } from 'vitest';
import { load } from './load.js';
import { toBinaryStl } from '../exportStl.js';
import { parseStl } from '../parseStl.js';

describe('toBinaryStl', () => {
  it('round-trips through the parser unchanged', () => {
    const p = load('sphere_r10.stl');
    const buf = toBinaryStl(p);
    expect(buf.byteLength).toBe(84 + 50 * (p.length / 9));
    expect(Array.from(parseStl(buf))).toEqual(Array.from(p));
  });
});
