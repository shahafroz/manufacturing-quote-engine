// Default materials and shop rates. Used to seed PostgreSQL, and as a fallback when no
// DATABASE_URL is configured so the app still works locally.
// Prices are typical 2026 small-shop figures; each shop would set its own in the database.
export const DEFAULT_MATERIALS = [
  { id: 'pla', name: 'PLA', process: 'fdm', density: 1.24, price_per_kg: 22, machine_rate_hr: 3, setup_cost: 0, cnc_key: null },
  { id: 'petg', name: 'PETG', process: 'fdm', density: 1.27, price_per_kg: 25, machine_rate_hr: 3, setup_cost: 0, cnc_key: null },
  { id: 'abs', name: 'ABS', process: 'fdm', density: 1.04, price_per_kg: 22, machine_rate_hr: 3.5, setup_cost: 0, cnc_key: null },
  { id: 'al6061', name: 'Aluminum 6061', process: 'cnc', density: 2.7, price_per_kg: 8, machine_rate_hr: 75, setup_cost: 25, cnc_key: 'aluminum_6061' },
  { id: 'steel1018', name: 'Steel 1018', process: 'cnc', density: 7.87, price_per_kg: 3, machine_rate_hr: 85, setup_cost: 30, cnc_key: 'steel_1018' },
];
