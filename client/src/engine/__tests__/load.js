// Shared helper for tests: read a fixture file and run it through the parser.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseStl } from '../parseStl.js';

export function load(name) {
  const b = readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)));
  return parseStl(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
