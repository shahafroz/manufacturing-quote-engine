import { describe, it, expect } from 'vitest';
import { load } from './load.js';
import { validateMesh } from '../validate.js';

describe('validateMesh', () => {
  it('closed cube is watertight: 8 corners, 18 edges', () => {
    const v = validateMesh(load('cube20_binary.stl'));
    expect(v.watertight).toBe(true);
    expect(v.vertexCount).toBe(8);
    expect(v.edgeCount).toBe(18);
    expect(v.flippedEdges).toBe(0);
  });

  it('hollow cube is watertight too (two separate closed shells)', () => {
    expect(validateMesh(load('hollow_cube.stl')).watertight).toBe(true);
  });

  it('removing one triangle leaves a hole of 3 edges', () => {
    const v = validateMesh(load('cube20_binary.stl').slice(9));
    expect(v.watertight).toBe(false);
    expect(v.boundaryEdges).toBe(3);
    expect(v.badEdgePositions.length).toBe(3 * 2 * 3); // 3 edges × 2 ends × xyz
  });

  it('a flipped triangle is detected', () => {
    const p = load('cube20_binary.stl');
    const q = Float32Array.from(p);
    q.set(p.slice(3, 6), 6);
    q.set(p.slice(6, 9), 3); // swap two corners of triangle 0
    expect(validateMesh(q).flippedEdges).toBe(3);
  });

  it('a zero-area triangle is detected', () => {
    const p = new Float32Array([...load('cube20_binary.stl'), 0, 0, 0, 1, 1, 1, 2, 2, 2]);
    expect(validateMesh(p).degenerateTriangles).toBe(1);
  });
});
