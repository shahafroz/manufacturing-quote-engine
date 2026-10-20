// STL files have no units. Almost everything is millimetres, but parts exported in inches or
// metres come out 25× too small or 1000× too small. We can't know for sure, so we look at the
// size and suggest a fix the user can accept with one click.

export const UNIT_OPTIONS = {
  inches: { label: 'inches', factor: 25.4 },
  cm: { label: 'centimetres', factor: 10 },
  meters: { label: 'metres', factor: 1000 },
};

// size = [x, y, z] in file units, read as mm
export function suggestUnits(size) {
  const largest = Math.max(...size);
  if (!(largest > 0)) return null;
  if (largest < 1) return { reason: `only ${largest.toFixed(3)} mm across`, options: ['meters', 'inches'] };
  if (largest < 15) return { reason: `only ${largest.toFixed(1)} mm across`, options: ['inches', 'cm'] };
  return null; // plausible size in mm
}

export function scalePositions(p, factor) {
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = p[i] * factor;
  return out;
}
