import { describe, it, expect } from 'vitest';
import { PRESET_PRINTERS, sanitizePrinter, printSettingsFor, minWallFor, checkCompatibility } from '../printers.js';
import { checkBuildVolume } from '../buildVolume.js';
import { computeGeometry } from '../geometry.js';
import { load } from './load.js';

describe('printers', () => {
  it('every preset survives sanitizing unchanged', () => {
    for (const p of PRESET_PRINTERS) expect(sanitizePrinter(p)).toEqual({ ...p, custom: false });
  });

  it('a preset id fills in the missing values', () => {
    expect(sanitizePrinter({ id: 'bambu-a1-mini' }).x).toBe(180);
    expect(sanitizePrinter(null).id).toBe('generic');
  });

  it('line width and minimum wall follow the nozzle', () => {
    const p = sanitizePrinter({ id: 'custom', nozzle: 0.6 });
    expect(printSettingsFor(p).lineWidth).toBeCloseTo(0.675);
    expect(minWallFor(p)).toBe(1.2);
  });

  it('a part too big for a small printer fits a bigger one', () => {
    const p = load('cube20_binary.stl');
    const scaled = p.map((v) => v * 9.5); // 190 mm cube
    const size = computeGeometry(scaled).bbox.size;
    const mini = PRESET_PRINTERS.find((x) => x.id === 'bambu-a1-mini');
    const p1s = PRESET_PRINTERS.find((x) => x.id === 'bambu-p1s');
    expect(checkBuildVolume(scaled, size, mini).fits).toBe(false);
    expect(checkBuildVolume(scaled, size, p1s).fits).toBe(true);
  });

  it('compatibility flags ABS on an open printer', () => {
    const open = PRESET_PRINTERS.find((x) => x.id === 'prusa-mk4');
    const items = checkCompatibility(open, { buildVolume: { fits: true }, thin: { thinArea: 0 } });
    expect(items.map((i) => i.status)).toEqual(['ok', 'ok', 'warn']);
  });
});
