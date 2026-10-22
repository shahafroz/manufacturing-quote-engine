import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../src/rateLimit.js';

function call(mw, ip) {
  let status = 200;
  const res = { set() {}, status(s) { status = s; return { json() {} }; } };
  let passed = false;
  mw({ ip }, res, () => (passed = true));
  return passed ? 200 : status;
}

test('blocks an IP after max requests, others still pass', () => {
  const mw = rateLimit({ max: 3 });
  assert.deepEqual([1, 2, 3, 4].map(() => call(mw, 'a')), [200, 200, 200, 429]);
  assert.equal(call(mw, 'b'), 200);
});
