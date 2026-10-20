import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceAll, validatePart } from '../src/pricing.js';
import { DEFAULT_MATERIALS } from '../src/materials.js';

const part = {
  print: { extrudedVolume: 10000, timeS: 3600 }, // 10 cm³ plastic, 1 hour
  cnc: { stockVolume: 20000, setups: 2, machiningMin: { aluminum_6061: 30, steel_1018: 90 } },
};

test('PLA: 12.4 g plastic, 1 h machine time', () => {
  const pla = priceAll(DEFAULT_MATERIALS, part, 1).find((r) => r.id === 'pla');
  assert.equal(pla.weightG, 12.4);
  assert.equal(pla.materialCost, 0.27); // 12.4 g × $22/kg
  assert.equal(pla.machineCost, 3); // 1 h × $3/h
  assert.equal(pla.total, 3.27);
});

test('CNC setup cost is paid once per order, not per part', () => {
  const one = priceAll(DEFAULT_MATERIALS, part, 1).find((r) => r.id === 'al6061');
  const ten = priceAll(DEFAULT_MATERIALS, part, 10).find((r) => r.id === 'al6061');
  assert.equal(one.setupCost, 50);
  assert.ok(Math.abs(ten.total - ((one.total - 50) * 10 + 50)) < 0.05);
  assert.ok(ten.perPart < one.perPart);
});

test('rows come back sorted cheapest first', () => {
  const rows = priceAll(DEFAULT_MATERIALS, part, 1);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].total >= rows[i - 1].total);
});

test('bad input is rejected', () => {
  assert.ok(validatePart({}));
  assert.ok(validatePart({ print: { extrudedVolume: -1, timeS: 1 }, cnc: { stockVolume: 1, setups: 1 } }));
  assert.equal(validatePart(part), null);
});
