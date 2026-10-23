import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateWithRetry } from '../src/advisor.js';

const busy = () => Object.assign(new Error('overloaded'), { status: 503 });
const hang = (signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));

test('answers with the main model when it is available', async () => {
  const seen = [];
  const out = await generateWithRetry(async (m) => (seen.push(m), 'ok'), ['main', 'lite']);
  assert.equal(out, 'ok');
  assert.deepEqual(seen, ['main']);
});

test('falls back to the lighter model when the main one is busy', async () => {
  const seen = [];
  const out = await generateWithRetry(async (m) => {
    seen.push(m);
    if (m === 'main') throw busy();
    return 'lite answer';
  }, ['main', 'lite']);
  assert.equal(out, 'lite answer');
  assert.deepEqual(seen, ['main', 'lite']);
});

test('skips a model that hangs and answers with the fallback', async () => {
  const seen = [];
  const out = await generateWithRetry((m, signal) => {
    seen.push(m);
    return m === 'main' ? hang(signal) : Promise.resolve('lite answer');
  }, ['main', 'lite'], { timeoutMs: 20 });
  assert.equal(out, 'lite answer');
  assert.deepEqual(seen, ['main', 'lite']);
});

test('gives a clean 503 when every model is busy or hangs', async () => {
  await assert.rejects(
    generateWithRetry((m, signal) => (m === 'main' ? Promise.reject(busy()) : hang(signal)), ['main', 'lite'], { timeoutMs: 20 }),
    { status: 503, message: 'The AI advisor is busy right now. Please try again in a minute.' },
  );
});

test('does not retry other errors such as a bad key', async () => {
  let calls = 0;
  const bad = Object.assign(new Error('API key not valid'), { status: 400 });
  await assert.rejects(generateWithRetry(async () => { calls++; throw bad; }, ['main', 'lite']), bad);
  assert.equal(calls, 1);
});
