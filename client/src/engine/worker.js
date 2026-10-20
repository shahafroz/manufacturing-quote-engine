// Web Worker: runs all the heavy geometry work on a background thread so the page never freezes.
// The main page sends messages ({ type, ... }) and gets results back with postMessage.

import { parseStl } from './parseStl.js';
import { computeGeometry } from './geometry.js';
import { validateMesh } from './validate.js';
import { detectOverhangs } from './overhang.js';
import { autoOrient } from './orient.js';
import { sliceMesh } from './slice.js';
import { estimatePrint, estimateCnc } from './estimate.js';

let positions = null; // the current mesh lives here, in the worker

function analyze() {
  const t = {};
  const time = (name, fn) => {
    const s = performance.now();
    const r = fn();
    t[name] = performance.now() - s;
    return r;
  };
  const geometry = time('geometry', () => computeGeometry(positions));
  const validation = time('validation', () => validateMesh(positions));
  const overhang = time('overhangs', () => detectOverhangs(positions));
  return { geometry, validation, overhang, timings: t };
}

self.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'analyze') {
      const s = performance.now();
      positions = parseStl(msg.buffer);
      if (positions.length === 0) throw new Error('No triangles found. Is this a valid STL file?');
      const parseMs = performance.now() - s;
      const result = analyze();
      result.timings.parse = parseMs;
      const copy = positions.slice(); // the page gets its own copy for drawing
      self.postMessage({ type: 'analyzed', positions: copy, ...result }, [copy.buffer]);
    } else if (msg.type === 'orient') {
      const s = performance.now();
      const o = autoOrient(positions);
      positions = o.positions;
      const result = analyze();
      result.timings.orient = performance.now() - s;
      const copy = positions.slice();
      self.postMessage(
        { type: 'analyzed', positions: copy, orientation: { before: o.before, after: o.after, reduction: o.reduction }, ...result },
        [copy.buffer],
      );
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
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
