// Accuracy + speed evaluation against PrusaSlicer.
//
// 1. Put your test STLs in one folder, e.g. eval/models/
// 2. Slice them with PrusaSlicer using scripts/slice-with-prusa.ps1 (same settings as our engine)
//    → eval/models/<name>.gcode next to each STL
// 3. node scripts/evaluate.mjs eval/models
//
// Writes eval/results.csv, eval/results.md (table for the README) and eval/*.svg plots.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { parseStl } from '../src/engine/parseStl.js';
import { computeGeometry } from '../src/engine/geometry.js';
import { validateMesh } from '../src/engine/validate.js';
import { sliceMesh } from '../src/engine/slice.js';
import { estimatePrint } from '../src/engine/estimate.js';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/evaluate.mjs <folder with .stl and PrusaSlicer .gcode files>');
  process.exit(1);
}
const outDir = join(dirname(dir), '.');
const PLA_DENSITY = 1.24;

// "; estimated printing time (normal mode) = 1d 2h 3m 4s"
function prusaTime(gcode) {
  const m = gcode.match(/estimated printing time \(normal mode\) = ([^\n\r]+)/);
  if (!m) return null;
  let s = 0;
  for (const [, n, u] of m[1].matchAll(/(\d+)\s*([dhms])/g)) s += +n * { d: 86400, h: 3600, m: 60, s: 1 }[u];
  return s;
}
const prusaGrams = (g) => {
  const m = g.match(/filament used \[g\] = ([\d.]+)/);
  return m ? +m[1] : null;
};

const rows = [];
for (const f of readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.stl')).sort()) {
  const path = join(dir, f);
  const buf = readFileSync(path);
  const t0 = performance.now();
  const p = parseStl(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const g = computeGeometry(p);
  const v = validateMesh(p);
  const t1 = performance.now();
  const s = sliceMesh(p, 0.2);
  const e = estimatePrint(s, 0); // supports off on both sides, to compare like with like
  const t2 = performance.now();

  const gcodePath = join(dir, f.replace(/\.stl$/i, '.gcode'));
  const gcode = existsSync(gcodePath) ? readFileSync(gcodePath, 'utf8') : '';
  const refTime = gcode ? prusaTime(gcode) : null;
  const refGrams = gcode ? prusaGrams(gcode) : null;
  const ourGrams = (e.extrudedVolume / 1000) * PLA_DENSITY;

  rows.push({
    model: basename(f, '.stl'),
    triangles: g.triangleCount,
    mb: +(statSync(path).size / 1048576).toFixed(2),
    watertight: v.watertight,
    volumeCm3: +(g.volume / 1000).toFixed(2),
    analyzeMs: Math.round(t1 - t0),
    sliceMs: Math.round(t2 - t1),
    ourMin: +(e.timeS / 60).toFixed(1),
    prusaMin: refTime ? +(refTime / 60).toFixed(1) : null,
    timeErrPct: refTime ? +((100 * (e.timeS - refTime)) / refTime).toFixed(1) : null,
    ourG: +ourGrams.toFixed(1),
    prusaG: refGrams,
    gramsErrPct: refGrams ? +((100 * (ourGrams - refGrams)) / refGrams).toFixed(1) : null,
  });
  console.log(`${f}: ${g.triangleCount} tris, ${Math.round(t2 - t0)} ms`);
}

const withRef = rows.filter((r) => r.prusaMin != null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const mape = (key) => mean(withRef.map((r) => Math.abs(r[key])));
const bias = (key) => mean(withRef.map((r) => r[key]));

mkdirSync(outDir, { recursive: true });
const cols = Object.keys(rows[0] || {});
writeFileSync(join(outDir, 'results.csv'), [cols.join(','), ...rows.map((r) => cols.map((c) => r[c]).join(','))].join('\n'));

const md = [
  `| Model | Triangles | Watertight | Ours (min) | PrusaSlicer (min) | Time error | Ours (g) | PrusaSlicer (g) | Filament error | Analyze + slice |`,
  `|---|---:|:---:|---:|---:|---:|---:|---:|---:|---:|`,
  ...rows.map((r) =>
    `| ${r.model} | ${r.triangles.toLocaleString()} | ${r.watertight ? '✓' : '✗'} | ${r.ourMin} | ${r.prusaMin ?? '–'} | ${r.timeErrPct ?? '–'}% | ${r.ourG} | ${r.prusaG ?? '–'} | ${r.gramsErrPct ?? '–'}% | ${r.analyzeMs + r.sliceMs} ms |`),
  '',
  withRef.length
    ? `**${withRef.length} models.** Mean absolute error: print time **${mape('timeErrPct').toFixed(1)}%** (bias ${bias('timeErrPct').toFixed(1)}%), filament **${mape('gramsErrPct').toFixed(1)}%** (bias ${bias('gramsErrPct').toFixed(1)}%).`
    : '_No PrusaSlicer .gcode files found next to the STLs, so only speed was measured._',
].join('\n');
writeFileSync(join(outDir, 'results.md'), md + '\n');

// --- tiny SVG scatter plots (no dependencies) ---
function scatter(file, title, points, xLabel, yLabel, diagonal) {
  const W = 520, H = 380, P = 56;
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const max = Math.max(...xs, ...(diagonal ? ys : []), 1) * 1.08;
  const maxY = diagonal ? max : Math.max(...ys, 1) * 1.08;
  const X = (v) => P + (v / max) * (W - P - 20), Y = (v) => H - P - (v / maxY) * (H - P - 30);
  const ticks = (m) => [0, 0.25, 0.5, 0.75, 1].map((f) => +(m * f).toPrecision(2));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif" font-size="12">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="${W / 2}" y="20" text-anchor="middle" font-size="14" font-weight="600" fill="#111">${title}</text>
${ticks(max).map((t) => `<line x1="${X(t)}" y1="${Y(0)}" x2="${X(t)}" y2="${Y(maxY)}" stroke="#eee"/><text x="${X(t)}" y="${H - P + 16}" text-anchor="middle" fill="#666">${t}</text>`).join('')}
${ticks(maxY).map((t) => `<line x1="${X(0)}" y1="${Y(t)}" x2="${X(max)}" y2="${Y(t)}" stroke="#eee"/><text x="${P - 8}" y="${Y(t) + 4}" text-anchor="end" fill="#666">${t}</text>`).join('')}
${diagonal ? `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(max)}" y2="${Y(max)}" stroke="#999" stroke-dasharray="4 4"/>` : ''}
${points.map((p) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4.5" fill="#d9731c" fill-opacity="0.85"/>`).join('')}
<text x="${W / 2}" y="${H - 12}" text-anchor="middle" fill="#333">${xLabel}</text>
<text transform="translate(16 ${H / 2}) rotate(-90)" text-anchor="middle" fill="#333">${yLabel}</text>
</svg>`;
  writeFileSync(join(outDir, file), svg);
}
if (withRef.length) {
  scatter('accuracy-time.svg', 'Print time: ours vs PrusaSlicer', withRef.map((r) => [r.prusaMin, r.ourMin]), 'PrusaSlicer (min)', 'Our estimate (min)', true);
  scatter('accuracy-filament.svg', 'Filament: ours vs PrusaSlicer', withRef.map((r) => [r.prusaG, r.ourG]), 'PrusaSlicer (g)', 'Our estimate (g)', true);
}
if (rows.length) scatter('speed.svg', 'Processing time vs mesh size', rows.map((r) => [r.triangles / 1000, r.analyzeMs + r.sliceMs]), 'Triangles (thousands)', 'Analyze + slice (ms)', false);

console.log('\n' + md);
console.log(`\nWrote ${join(outDir, 'results.md')}, results.csv and SVG plots.`);
