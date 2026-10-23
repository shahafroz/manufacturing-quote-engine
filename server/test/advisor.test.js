import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateWithRetry } from '../src/advisor.js';

const busy = () => Object.assign(new Error('overloaded'), { status: 503 });
const opts = { sleep: async () => {} };

test('retries the main model, then answers', async () => {
  const seen = [];
  const out = await generateWithRetry(async (m) => {
    seen.push(m);
    if (seen.length === 1) throw busy();
    return 'ok';
  }, ['main', 'lite'], opts);
  assert.equal(out, 'ok');
  assert.deepEqual(seen, ['main', 'main']);
});

test('falls back to the lighter model when the main one stays busy', async () => {
  const seen = [];
  const out = await generateWithRetry(async (m) => {
    seen.push(m);
    if (m === 'main') throw busy();
    return 'lite answer';
  }, ['main', 'lite'], opts);
  assert.equal(out, 'lite answer');
  assert.deepEqual(seen, ['main', 'main', 'lite']);
});

test('gives a clean 503 when every model is busy', async () => {
  await assert.rejects(generateWithRetry(async () => { throw busy(); }, ['main', 'lite'], opts), {
    status: 503,
    message: 'The AI advisor is busy right now. Please try again in a minute.',
  });
});

test('skips a model that hangs and answers with the fallback', async () => {
  const seen = [];
  const out = await generateWithRetry((m, signal) => {
    seen.push(m);
    if (m === 'main') return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    return Promise.resolve('lite answer');
  }, ['main', 'lite'], { ...opts, timeoutMs: 20 });
  assert.equal(out, 'lite answer');
  assert.deepEqual(seen, ['main', 'lite']);
});

test('does not retry other errors such as a bad key', async () => {
  let calls = 0;
  const bad = Object.assign(new Error('API key not valid'), { status: 400 });
  await assert.rejects(generateWithRetry(async () => { calls++; throw bad; }, ['main', 'lite'], opts), bad);
  assert.equal(calls, 1);
});
