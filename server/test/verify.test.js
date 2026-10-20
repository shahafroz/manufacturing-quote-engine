import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeAndPrice, newQuoteId, isValid } from '../src/verify.js';
import { DEFAULT_MATERIALS } from '../src/materials.js';

const cube = readFileSync(new URL('../../client/src/engine/__tests__/fixtures/cube20_binary.stl', import.meta.url));

test('the server re-analyzes the mesh and prices it itself', () => {
  const r = analyzeAndPrice(cube, { layerHeight: 0.2, infill: 0.2, quantity: 1 }, DEFAULT_MATERIALS);
  assert.ok(Math.abs(r.geometry.volume - 8000) < 1e-6);
  assert.equal(r.validation.watertight, true);
  assert.equal(r.rows.length, 5);
  assert.equal(r.meshSha256.length, 64);
});

test('bad settings are clamped, not trusted', () => {
  const r = analyzeAndPrice(cube, { layerHeight: 7, infill: 9, quantity: -3 }, DEFAULT_MATERIALS);
  assert.deepEqual(r.settings, { layerHeight: 0.2, infill: 1, quantity: 1 });
});

test('same mesh + settings always gives the same price', () => {
  const a = analyzeAndPrice(cube, { quantity: 3 }, DEFAULT_MATERIALS);
  const b = analyzeAndPrice(cube, { quantity: 3 }, DEFAULT_MATERIALS);
  assert.deepEqual(a.rows, b.rows);
});

test('quote ids look like Q-XXXXXX and expire', () => {
  assert.match(newQuoteId(), /^Q-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(isValid({ expiresAt: new Date(Date.now() + 1000).toISOString() }), true);
  assert.equal(isValid({ expiresAt: new Date(Date.now() - 1000).toISOString() }), false);
});
