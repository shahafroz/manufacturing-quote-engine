// Locked quotes: the server never trusts a price from the browser. When a quote is saved, the
// browser sends the actual mesh, and the server runs the SAME geometry engine on it (shared
// with the client) and prices it again. The stored quote is what the shop will honour.
import { createHash, randomBytes } from 'node:crypto';
import { parseStl } from '../../client/src/engine/parseStl.js';
import { computeGeometry } from '../../client/src/engine/geometry.js';
import { validateMesh } from '../../client/src/engine/validate.js';
import { detectOverhangs } from '../../client/src/engine/overhang.js';
import { sliceMesh } from '../../client/src/engine/slice.js';
import { estimatePrint, estimateCnc } from '../../client/src/engine/estimate.js';
import { sanitizePrinter, printSettingsFor } from '../../client/src/engine/printers.js';
import { priceAll, DEFAULT_RULES } from './pricing.js';

export const QUOTE_DAYS = 30;

export function newQuoteId() {
  // Q- plus 8 characters without look-alikes (no 0/O, 1/I): 32^8 ≈ 10^12 possible IDs,
  // so quote IDs can't realistically be guessed
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return 'Q-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function analyzeAndPrice(stlBytes, settings, materials, printerInput = null) {
  const printer = sanitizePrinter(printerInput);
  const buf = stlBytes.buffer.slice(stlBytes.byteOffset, stlBytes.byteOffset + stlBytes.byteLength);
  const p = parseStl(buf);
  if (p.length === 0) {
    const err = new Error('No triangles found in the uploaded mesh');
    err.status = 400;
    throw err;
  }
  const layerHeight = [0.1, 0.2, 0.3].includes(settings.layerHeight) ? settings.layerHeight : 0.2;
  const infill = Math.min(1, Math.max(0.05, Number(settings.infill) || 0.2));
  const quantity = Math.max(1, Math.min(1000, Math.round(settings.quantity) || 1));

  const geometry = computeGeometry(p);
  const validation = validateMesh(p);
  const overhang = detectOverhangs(p);
  const sliced = sliceMesh(p, layerHeight);
  const print = estimatePrint(sliced, overhang.supportVolume, { ...printSettingsFor(printer), layerHeight, infill });
  const cnc = estimateCnc(geometry, p);
  const rows = priceAll(
    materials,
    {
      print: { extrudedVolume: print.extrudedVolume, timeS: print.timeS },
      cnc: {
        stockVolume: cnc.stockVolume,
        setups: cnc.setups,
        machiningMin: Object.fromEntries(Object.entries(cnc.perMaterial).map(([k, v]) => [k, v.machiningMin])),
      },
    },
    quantity,
    DEFAULT_RULES,
    printer,
  );

  return {
    meshSha256: createHash('sha256').update(stlBytes).digest('hex'),
    settings: { layerHeight, infill, quantity },
    printer,
    geometry: { volume: geometry.volume, surfaceArea: geometry.surfaceArea, bbox: geometry.bbox, triangleCount: geometry.triangleCount },
    validation: { watertight: validation.watertight, boundaryEdges: validation.boundaryEdges, nonManifoldEdges: validation.nonManifoldEdges },
    print: { timeS: print.timeS, extrudedVolume: print.extrudedVolume, layers: print.layers, supportVolume: overhang.supportVolume },
    cnc: { stockVolume: cnc.stockVolume, setups: cnc.setups },
    rows,
  };
}

export function isValid(quote, now = Date.now()) {
  return new Date(quote.expiresAt).getTime() > now;
}
