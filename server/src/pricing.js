// Pricing model: material + machine time (+ setup for CNC).
// Input `part` comes from the browser's geometry engine:
//   print.extrudedVolume (mm³ of plastic, incl. infill and support), print.timeS
//   cnc.stockVolume (mm³ block), cnc.machiningMin { aluminum_6061, steel_1018 }, cnc.setups
export function priceAll(materials, part, quantity = 1) {
  const qty = Math.max(1, Math.min(1000, Math.round(quantity) || 1));
  const rows = [];

  for (const m of materials) {
    if (m.process === 'fdm') {
      const weightG = (part.print.extrudedVolume / 1000) * m.density;
      const machineMinutes = part.print.timeS / 60;
      const material = (weightG / 1000) * m.price_per_kg;
      const machine = (machineMinutes / 60) * m.machine_rate_hr;
      const perPart = material + machine;
      rows.push(row(m, weightG, machineMinutes, material, machine, 0, perPart, qty, (machineMinutes * qty) / 60 + 4));
    } else if (m.process === 'cnc') {
      const minutes = part.cnc.machiningMin?.[m.cnc_key];
      if (minutes == null) continue;
      const weightG = (part.cnc.stockVolume / 1000) * m.density; // you pay for the whole block
      const material = (weightG / 1000) * m.price_per_kg;
      const machine = (minutes / 60) * m.machine_rate_hr;
      const setup = part.cnc.setups * m.setup_cost; // fixtures/programming, once per order
      const perPart = material + machine;
      rows.push(row(m, weightG, minutes, material, machine, setup, perPart, qty, (minutes * qty) / 60 + part.cnc.setups * 0.5 + 8));
    }
  }
  return rows.sort((a, b) => a.total - b.total);
}

const r2 = (v) => Math.round(v * 100) / 100;

function row(m, weightG, machineMinutes, material, machine, setup, perPart, qty, leadTimeHours) {
  return {
    id: m.id,
    name: m.name,
    process: m.process,
    weightG: r2(weightG),
    machineMinutes: r2(machineMinutes),
    materialCost: r2(material),
    machineCost: r2(machine),
    setupCost: r2(setup),
    perPart: r2(perPart + setup / qty),
    total: r2(perPart * qty + setup),
    leadTimeHours: r2(leadTimeHours),
  };
}

// Basic shape check on the request body so bad input gets a clear 400.
export function validatePart(body) {
  const n = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (!body || !body.print || !body.cnc) return 'print and cnc estimates are required';
  if (!n(body.print.extrudedVolume) || !n(body.print.timeS)) return 'print.extrudedVolume and print.timeS must be numbers';
  if (!n(body.cnc.stockVolume) || !n(body.cnc.setups)) return 'cnc.stockVolume and cnc.setups must be numbers';
  return null;
}
