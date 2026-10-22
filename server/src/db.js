// Materials live in PostgreSQL (so a shop can edit its own prices), quotes live in MongoDB.
// Both are optional: without DATABASE_URL / MONGO_URI the server falls back to built-in
// materials and in-memory quotes, so it always runs locally.
import pg from 'pg';
import mongoose from 'mongoose';
import { DEFAULT_MATERIALS } from './materials.js';

let pool = null;

export async function initPostgres() {
  if (!process.env.DATABASE_URL) return 'defaults';
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      process TEXT NOT NULL CHECK (process IN ('fdm', 'cnc')),
      density NUMERIC NOT NULL,
      price_per_kg NUMERIC NOT NULL,
      machine_rate_hr NUMERIC NOT NULL,
      setup_cost NUMERIC NOT NULL DEFAULT 0,
      cnc_key TEXT
    )`);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM materials');
  if (rows[0].n === 0) {
    for (const m of DEFAULT_MATERIALS) {
      await pool.query(
        'INSERT INTO materials (id, name, process, density, price_per_kg, machine_rate_hr, setup_cost, cnc_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [m.id, m.name, m.process, m.density, m.price_per_kg, m.machine_rate_hr, m.setup_cost, m.cnc_key],
      );
    }
  }
  return 'postgres';
}

export async function getMaterials() {
  if (!pool) return DEFAULT_MATERIALS;
  const { rows } = await pool.query('SELECT * FROM materials ORDER BY process, id');
  // NUMERIC columns come back as strings: convert them
  return rows.map((r) => ({
    ...r,
    density: +r.density,
    price_per_kg: +r.price_per_kg,
    machine_rate_hr: +r.machine_rate_hr,
    setup_cost: +r.setup_cost,
  }));
}

// ---- quotes ----
const QuoteSchema = new mongoose.Schema(
  {
    quoteId: { type: String, index: true, unique: true },
    expiresAt: Date,
    meshSha256: String,
    verified: Boolean,
    fileName: String,
    s3Key: String,
    geometry: Object,
    validation: Object,
    settings: Object,
    printer: Object,
    print: Object,
    cnc: Object,
    rows: Array,
    recommendation: Object,
  },
  { timestamps: true },
);
const Quote = mongoose.model('Quote', QuoteSchema);
const memory = [];
let useMongo = false;

export async function initMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) return 'memory';
  // Atlas connection strings often leave out the database name, which would mean "test"
  const hasDb = /^mongodb(\+srv)?:\/\/[^/]+\/[^?]+/.test(uri);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, ...(hasDb ? {} : { dbName: 'quote-engine' }) });
  useMongo = true;
  return 'mongodb';
}

// If MongoDB was down at startup, keep trying in the background instead of staying on memory
export function retryMongo(onConnected, everyMs = 30000) {
  const timer = setInterval(async () => {
    try {
      onConnected(await initMongo());
      clearInterval(timer);
    } catch (e) {
      console.error('MongoDB retry:', e.message);
    }
  }, everyMs);
  timer.unref();
}

export async function closeDatabases() {
  await Promise.allSettled([pool?.end(), useMongo ? mongoose.disconnect() : null]);
}

export async function saveQuote(data) {
  if (useMongo) return { quote: (await Quote.create(data)).toObject(), storage: 'mongodb' };
  const quote = { ...data, createdAt: new Date().toISOString() };
  memory.unshift(quote);
  if (memory.length > 500) memory.pop();
  return { quote, storage: 'memory' };
}

export async function getQuote(quoteId) {
  if (useMongo) return Quote.findOne({ quoteId }).lean();
  return memory.find((q) => q.quoteId === quoteId) || null;
}

// ids = null → every quote (admin); otherwise only these quote IDs
export async function listQuotes(ids = null) {
  if (useMongo) return Quote.find(ids ? { quoteId: { $in: ids } } : {}).sort({ createdAt: -1 }).limit(100).lean();
  return memory.filter((q) => !ids || ids.includes(q.quoteId)).slice(0, 100);
}
