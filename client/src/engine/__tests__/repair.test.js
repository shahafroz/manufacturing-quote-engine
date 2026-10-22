import { describe, it, expect } from 'vitest';
import { load } from './load.js';
import { repairMesh } from '../repair.js';
import { validateMesh } from '../validate.js';
import { computeGeometry } from '../geometry.js';

describe('repairMesh', () => {
  it('leaves a good mesh unchanged', () => {
    const r = repairMesh(load('cube20_binary.stl'));
    expect(r.report.changed).toBe(false);
    expect(computeGeometry(r.positions).volume).toBeCloseTo(8000, 3);
  });

  it('closes a missing triangle and restores the volume', () => {
    const r = repairMesh(load('cube20_binary.stl').slice(9));
    expect(r.report.holesFilled).toBe(1);
    expect(validateMesh(r.positions).watertight).toBe(true);
    expect(computeGeometry(r.positions).volume).toBeCloseTo(8000, 3);
    expect(r.addedMask.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('flips a single inside-out triangle back', () => {
    const p = load('cube20_binary.stl');
    const q = Float32Array.from(p);
    q.set(p.slice(3, 6), 6);
    q.set(p.slice(6, 9), 3);
    const r = repairMesh(q);
    expect(r.report.facesFlipped).toBe(1);
    expect(validateMesh(r.positions).flippedEdges).toBe(0);
    expect(computeGeometry(r.positions).volume).toBeCloseTo(8000, 3);
  });

  it('turns a completely inside-out part right side out', () => {
    const p = load('cube20_binary.stl');
    const q = Float32Array.from(p);
    for (let t = 0; t < 12; t++) { q.set(p.slice(t * 9 + 3, t * 9 + 6), t * 9 + 6); q.set(p.slice(t * 9 + 6, t * 9 + 9), t * 9 + 3); }
    expect(computeGeometry(q).inverted).toBe(true);
    const r = repairMesh(q);
    expect(r.report.partsTurnedRightSideOut).toBe(1);
    expect(computeGeometry(r.positions).inverted).toBe(false);
  });

  it('removes zero-area triangles', () => {
    const p = new Float32Array([...load('cube20_binary.stl'), 0, 0, 0, 1, 1, 1, 2, 2, 2]);
    const r = repairMesh(p);
    expect(r.report.degenerateRemoved).toBe(1);
    expect(r.positions.length / 9).toBe(12);
  });

  it('removes duplicate triangles, even with the opposite winding', () => {
    const p = load('sphere_r10.stl');
    const dup = Float32Array.from(p.slice(0, 9));
    dup.set(p.slice(6, 9), 3);
    dup.set(p.slice(3, 6), 6);
    const r = repairMesh(new Float32Array([...p, ...p.slice(9, 18), ...dup]));
    expect(r.report.duplicatesRemoved).toBe(2);
    const v = validateMesh(r.positions);
    expect(v.nonManifoldEdges).toBe(0);
    expect(v.flippedEdges).toBe(0);
    expect(computeGeometry(r.positions).volume).toBeCloseTo(computeGeometry(p).volume, 3);
  });

  it('closes holes that touch at a corner without making non-manifold edges', () => {
    const p = load('sphere_r10.stl');
    const n = p.length / 9;
    const gone = new Set(Array.from({ length: 40 }, (_, i) => (i * 37) % n));
    const out = [];
    for (let t = 0; t < n; t++) if (!gone.has(t)) out.push(...p.slice(t * 9, t * 9 + 9));
    const r = repairMesh(new Float32Array(out));
    const v = validateMesh(r.positions);
    expect(v.watertight).toBe(true);
    expect(v.flippedEdges).toBe(0);
    expect(computeGeometry(r.positions).volume).toBeCloseTo(computeGeometry(p).volume, 0);
  });
});
