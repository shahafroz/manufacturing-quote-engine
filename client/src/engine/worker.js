// Web Worker: runs all the heavy geometry work on a background thread so the page never freezes.
// The page sends messages ({ type, ... }) and gets results back with postMessage.

import { parseStl } from './parseStl.js';
import { computeGeometry } from './geometry.js';
import { validateMesh } from './validate.js';
import { detectOverhangs } from './overhang.js';
import { autoOrient } from './orient.js';
import { sliceMesh } from './slice.js';
import { estimatePrint, estimateCnc } from './estimate.js';
import { suggestUnits, scalePositions } from './units.js';
import { checkBuildVolume, rotateToFit } from './buildVolume.js';
import { detectThinWalls } from './thinWalls.js';
import { repairMesh } from './repair.js';
import { toBinaryStl } from './exportStl.js';

let positions = null; // the current mesh lives here, in the worker
let addedMask = null; // triangles added by repair (shown in green)
let job = 0; // so a slow thin-wall check from an old mesh is ignored

function timed(t, name, fn) {
  const s = performance.now();
  const r = fn();
  t[name] = performance.now() - s;
  return r;
}

function analyzeAndPost(extra = {}) {
  const t = {};
  const geometry = timed(t, 'geometry', () => computeGeometry(positions));
  const validation = timed(t, 'validation', () => validateMesh(positions));
  const overhang = timed(t, 'overhangs', () => detectOverhangs(positions));
  const units = suggestUnits(geometry.bbox.size);
  const buildVolume = timed(t, 'buildVolume', () => checkBuildVolume(positions, geometry.bbox.size));
  if (addedMask && addedMask.length !== positions.length / 9) addedMask = null;
  const copy = positions.slice(); // the page gets its own copy for drawing
  self.postMessage(
    { type: 'analyzed', positions: copy, geometry, validation, overhang, units, buildVolume, addedMask, timings: { ...extra.timings, ...t }, ...extra.payload },
    [copy.buffer],
  );

  // thin walls take longer: send them separately when ready
  const mine = ++job;
  setTimeout(() => {
    if (mine !== job) return;
    const s = performance.now();
    const thin = detectThinWalls(positions);
    if (mine !== job) return;
    self.postMessage({ type: 'thin', thin, ms: performance.now() - s });
  }, 0);
}

self.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'analyze') {
      const s = performance.now();
      positions = parseStl(msg.buffer);
      if (positions.length === 0) throw new Error('No triangles found. Is this a valid STL file?');
      addedMask = null;
      analyzeAndPost({ timings: { parse: performance.now() - s } });
    } else if (msg.type === 'scale') {
      positions = scalePositions(positions, msg.factor);
      analyzeAndPost({ payload: { notice: `Scaled ×${msg.factor}` } });
    } else if (msg.type === 'fit') {
      positions = rotateToFit(positions, msg.up);
      analyzeAndPost({ payload: { notice: 'Rotated to fit the printer' } });
    } else if (msg.type === 'repair') {
      const s = performance.now();
      const r = repairMesh(positions);
      positions = r.positions;
      addedMask = r.addedMask;
      analyzeAndPost({ timings: { repair: performance.now() - s }, payload: { repair: r.report } });
    } else if (msg.type === 'orient') {
      const s = performance.now();
      const o = autoOrient(positions);
      positions = o.positions;
      addedMask = addedMask && addedMask.length === positions.length / 9 ? addedMask : null;
      analyzeAndPost({ timings: { orient: performance.now() - s }, payload: { orientation: { before: o.before, after: o.after, reduction: o.reduction } } });
    } else if (msg.type === 'estimate') {
      const s = performance.now();
      const sliced = sliceMesh(positions, msg.settings.layerHeight);
      const sliceMs = performance.now() - s;
      const geometry = computeGeometry(positions);
      const overhang = detectOverhangs(positions);
      const print = estimatePrint(sliced, overhang.supportVolume, msg.settings);
      const cnc = estimateCnc(geometry, positions);
      const layers = sliced.layers.map((L) => ({ z: L.z, area: L.area, perimeter: L.perimeter, loops: L.loops }));
      self.postMessage({ type: 'estimated', layers, minZ: sliced.minZ, print, cnc, timings: { slice: sliceMs } });
    } else if (msg.type === 'export') {
      const buf = toBinaryStl(positions);
      self.postMessage({ type: 'exported', buffer: buf, requestId: msg.requestId }, [buf]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
