import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initPostgres, getMaterials, initMongo, saveQuote, listQuotes } from './src/db.js';
import { priceAll, validatePart } from './src/pricing.js';
import { recommend } from './src/advisor.js';
import { createUploadUrl, s3Enabled } from './src/storage.js';

const app = express();

// Allow the local Vite dev server, plus your deployed site (CLIENT_URL, comma-separated if several)
const allowed = ['http://localhost:5173', 'http://localhost:5174', ...(process.env.CLIENT_URL || '').split(',')]
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)) }));
app.use(express.json({ limit: '2mb' }));

const status = { materials: 'starting', quotes: 'starting' };

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ...status, ai: Boolean(process.env.GEMINI_API_KEY), s3: s3Enabled() });
});

app.get('/api/materials', async (req, res, next) => {
  try {
    res.json(await getMaterials());
  } catch (e) {
    next(e);
  }
});

// Price every material for the part the browser analyzed
app.post('/api/quote', async (req, res, next) => {
  try {
    const problem = validatePart(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const rows = priceAll(await getMaterials(), req.body, req.body.quantity);
    res.json({ rows });
  } catch (e) {
    next(e);
  }
});

app.post('/api/recommend', async (req, res, next) => {
  try {
    const { useCase, part } = req.body || {};
    if (!useCase || typeof useCase !== 'string') return res.status(400).json({ error: 'useCase is required' });
    res.json(await recommend(useCase, part || {}, await getMaterials()));
  } catch (e) {
    next(e);
  }
});

app.post('/api/quotes', async (req, res, next) => {
  try {
    if (!req.body?.fileName || !Array.isArray(req.body.rows)) return res.status(400).json({ error: 'fileName and rows are required' });
    const { quote, storage } = await saveQuote(req.body);
    res.status(201).json({ id: quote._id || quote.id, storage });
  } catch (e) {
    next(e);
  }
});

app.get('/api/quotes', async (req, res, next) => {
  try {
    res.json(await listQuotes());
  } catch (e) {
    next(e);
  }
});

app.post('/api/upload-url', async (req, res, next) => {
  try {
    res.json(await createUploadUrl(req.body?.fileName, req.body?.size));
  } catch (e) {
    next(e);
  }
});

// One place for errors: log the details, send a short message
app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  status.materials = await initPostgres().catch((e) => (console.error('PostgreSQL:', e.message), 'defaults (db error)'));
  status.quotes = await initMongo().catch((e) => (console.error('MongoDB:', e.message), 'memory (db error)'));
  console.log(`Materials: ${status.materials} · Quotes: ${status.quotes} · AI: ${Boolean(process.env.GEMINI_API_KEY)} · S3: ${s3Enabled()}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other server or set PORT in server/.env.`);
    process.exit(1);
  }
  throw err;
});
