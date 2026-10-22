// Printer profiles. Build volume, nozzle and enclosure come from the makers' published specs;
// speeds are typical slicer profile values: edit them to match your own printer.
// The "generic" profile matches PrusaSlicer's default settings and is what the accuracy
// benchmark in the README uses.

const GENERIC_SPEEDS = {
  perimeterSpeed: 60, externalPerimeterSpeed: 30, infillSpeed: 80, solidSpeed: 20,
  topSolidSpeed: 15, firstLayerSpeed: 30, travelSpeed: 130, acceleration: 1500,
};

export const PRESET_PRINTERS = [
  {
    id: 'generic', name: 'Generic (PrusaSlicer defaults)', x: 250, y: 210, z: 220,
    nozzle: 0.4, enclosed: false, hourlyRate: 3, speeds: GENERIC_SPEEDS,
  },
  {
    id: 'prusa-mk4', name: 'Prusa MK4', x: 250, y: 210, z: 220, nozzle: 0.4, enclosed: false, hourlyRate: 3,
    speeds: { perimeterSpeed: 120, externalPerimeterSpeed: 70, infillSpeed: 200, solidSpeed: 150, topSolidSpeed: 80, firstLayerSpeed: 30, travelSpeed: 300, acceleration: 2500 },
  },
  {
    id: 'prusa-core-one', name: 'Prusa Core One', x: 250, y: 220, z: 270, nozzle: 0.4, enclosed: true, hourlyRate: 3.5,
    speeds: { perimeterSpeed: 140, externalPerimeterSpeed: 80, infillSpeed: 220, solidSpeed: 160, topSolidSpeed: 90, firstLayerSpeed: 35, travelSpeed: 350, acceleration: 4000 },
  },
  {
    id: 'bambu-p1s', name: 'Bambu Lab P1S', x: 256, y: 256, z: 256, nozzle: 0.4, enclosed: true, hourlyRate: 3,
    speeds: { perimeterSpeed: 200, externalPerimeterSpeed: 150, infillSpeed: 250, solidSpeed: 200, topSolidSpeed: 150, firstLayerSpeed: 50, travelSpeed: 500, acceleration: 10000 },
  },
  {
    id: 'bambu-a1-mini', name: 'Bambu Lab A1 mini', x: 180, y: 180, z: 180, nozzle: 0.4, enclosed: false, hourlyRate: 2,
    speeds: { perimeterSpeed: 200, externalPerimeterSpeed: 150, infillSpeed: 250, solidSpeed: 200, topSolidSpeed: 150, firstLayerSpeed: 50, travelSpeed: 500, acceleration: 10000 },
  },
  {
    id: 'ender3-v3-se', name: 'Creality Ender 3 V3 SE', x: 220, y: 220, z: 250, nozzle: 0.4, enclosed: false, hourlyRate: 2,
    speeds: { perimeterSpeed: 100, externalPerimeterSpeed: 60, infillSpeed: 150, solidSpeed: 100, topSolidSpeed: 60, firstLayerSpeed: 30, travelSpeed: 200, acceleration: 2500 },
  },
];

// Limits for user-entered values: anything outside is clamped (used by both page and server)
const LIMITS = {
  x: [20, 2000], y: [20, 2000], z: [20, 2000], nozzle: [0.1, 2], hourlyRate: [0, 500],
  speed: [5, 1000], acceleration: [100, 50000],
};
const clamp = (v, [lo, hi], fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

export function sanitizePrinter(input) {
  const base = PRESET_PRINTERS[0];
  if (!input || typeof input !== 'object') return base;
  const preset = PRESET_PRINTERS.find((p) => p.id === input.id);
  const src = { ...(preset || base), ...input };
  const speeds = {};
  for (const [k, def] of Object.entries(base.speeds)) {
    speeds[k] = clamp(src.speeds?.[k], k === 'acceleration' ? LIMITS.acceleration : LIMITS.speed, (preset || base).speeds[k] ?? def);
  }
  return {
    id: String(src.id || 'custom').slice(0, 40),
    name: String(src.name || 'Custom printer').slice(0, 60),
    x: clamp(src.x, LIMITS.x, base.x),
    y: clamp(src.y, LIMITS.y, base.y),
    z: clamp(src.z, LIMITS.z, base.z),
    nozzle: clamp(src.nozzle, LIMITS.nozzle, 0.4),
    enclosed: Boolean(src.enclosed),
    hourlyRate: clamp(src.hourlyRate, LIMITS.hourlyRate, base.hourlyRate),
    speeds,
    custom: Boolean(src.custom),
  };
}

// Settings for estimatePrint: the printer's speeds, and line width from the nozzle
export function printSettingsFor(printer) {
  return { ...printer.speeds, lineWidth: +(printer.nozzle * 1.125).toFixed(3) };
}

// Thinnest wall a nozzle can print reliably: two lines side by side
export const minWallFor = (printer) => +(printer.nozzle * 2).toFixed(2);

// Materials that need a heated, closed chamber to print without warping or cracking
export const NEEDS_ENCLOSURE = new Set(['abs']);

// Compatibility summary shown on the page
export function checkCompatibility(printer, { buildVolume, thin }) {
  const items = [];
  if (buildVolume.fits) items.push({ status: 'ok', text: `Fits the ${printer.x} × ${printer.y} × ${printer.z} mm build volume` });
  else if (buildVolume.canFit) items.push({ status: 'warn', text: 'Only fits when turned on its side' });
  else items.push({ status: 'bad', text: 'Too big for this printer' });

  const minWall = minWallFor(printer);
  if (!thin) items.push({ status: 'pending', text: `Checking walls against the ${printer.nozzle} mm nozzle…` });
  else if (thin.thinArea > 0) items.push({ status: 'warn', text: `Some walls are thinner than ${minWall} mm (2 × the ${printer.nozzle} mm nozzle)` });
  else items.push({ status: 'ok', text: `All walls at least ${minWall} mm (OK for a ${printer.nozzle} mm nozzle)` });

  items.push(
    printer.enclosed
      ? { status: 'ok', text: 'Enclosed: can print PLA, PETG and ABS' }
      : { status: 'warn', text: 'Open frame: ABS is likely to warp. Use PLA or PETG' },
  );
  return items;
}
