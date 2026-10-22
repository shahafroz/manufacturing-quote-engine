// Does the part fit on the printer? A part can be turned around Z for free (swap X and Y), so it
// fits if its footprint fits either way round and it is not too tall. If it doesn't fit as it
// is, we try the same 26 "which way is up" directions as auto-orientation.

import { candidateDirections, rotationToZ, rotatePositions } from './orient.js';
import { computeGeometry } from './geometry.js';
import { PRESET_PRINTERS } from './printers.js';

// Default build volume when no printer is chosen
export const DEFAULT_PRINTER = PRESET_PRINTERS[0];

export function fitsVolume(size, printer = DEFAULT_PRINTER) {
  const [x, y, z] = size;
  if (z > printer.z) return false;
  return (x <= printer.x && y <= printer.y) || (y <= printer.x && x <= printer.y);
}

export function checkBuildVolume(p, size, printer = DEFAULT_PRINTER) {
  if (fitsVolume(size, printer)) return { fits: true, printer };
  // try the other orientations and keep the lowest one that fits (lying flat beats standing
  // on a corner: shorter prints are faster and more stable)
  let best = null;
  for (const up of candidateDirections()) {
    if (up[2] > 0.999) continue;
    const s = computeGeometry(rotatePositions(p, rotationToZ(up))).bbox.size;
    if (fitsVolume(s, printer) && (!best || s[2] < best.rotatedSize[2] - 1e-6)) best = { up, rotatedSize: s };
  }
  return best ? { fits: false, canFit: true, ...best, printer } : { fits: false, canFit: false, printer };
}

export function rotateToFit(p, up) {
  return rotatePositions(p, rotationToZ(up));
}
