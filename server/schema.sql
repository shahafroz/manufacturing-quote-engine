-- Materials and shop rates (the server creates and seeds this automatically on first start).
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  process TEXT NOT NULL CHECK (process IN ('fdm', 'cnc')),
  density NUMERIC NOT NULL,          -- g/cm³
  price_per_kg NUMERIC NOT NULL,     -- USD
  machine_rate_hr NUMERIC NOT NULL,  -- USD per machine hour
  setup_cost NUMERIC NOT NULL DEFAULT 0, -- USD per setup (CNC)
  cnc_key TEXT                       -- links to the CNC removal-rate table in the engine
);

-- Example: a shop changes its PLA price
-- UPDATE materials SET price_per_kg = 19.5 WHERE id = 'pla';
