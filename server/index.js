import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initPostgres, getMaterials, initMongo, saveQuote, listQuotes, getQuote } from './src/db.js';
import { analyzeAndPrice, newQuoteId, isValid, QUOTE_DAYS } from './src/verify.js';
import { priceAll, validatePart } from './src/pricing.js';
import { recommend } from './src/advisor.js';
import { createUploadUrl, s3Enabled } from './src/storage.js';
import { sanitizePrinter } from '../client/src/engine/printers.js';
import { rateLimit } from './src/rateLimit.js';

const app = express();
app.set('trust proxy', 1); // Render sits behind one proxy: use the visitor's real IP for rate limits

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
app.post('/api/quote', rateLimit({ max: 120 }), async (req, res, next) => {
  try {
    const problem = validatePart(req.body);
    if (problem) return res.status(400).json({ error: problem });
    const printer = req.body.printer ? sanitizePrinter(req.body.printer) : null;
    const rows = priceAll(await getMaterials(), req.body, req.body.quantity, undefined, printer);
    res.json({ rows });
  } catch (e) {
    next(e);
  }
});

app.post('/api/recommend', rateLimit({ max: 10 }), async (req, res, next) => {
  try {
    const { useCase, part } = req.body || {};
    if (!useCase || typeof useCase !== 'string') return res.status(400).json({ error: 'useCase is required' });
    res.json(await recommend(useCase, part || {}, await getMaterials()));
  } catch (e) {
    next(e);
  }
});

// Save a LOCKED quote. Body = the mesh as a binary STL; options in the x-quote-options header.
// The server re-runs the geometry engine and prices it itself, so the browser can't change the price.
app.post('/api/quotes', rateLimit({ max: 20 }), express.raw({ type: 'application/octet-stream', limit: '100mb' }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length < 84) return res.status(400).json({ error: 'Send the mesh as a binary STL body' });
    let options;
    try {
      options = JSON.parse(req.get('x-quote-options') || '{}');
    } catch {
      return res.status(400).json({ error: 'x-quote-options must be JSON' });
    }
    const result = analyzeAndPrice(req.body, options.settings || {}, await getMaterials(), options.printer);
    const clientTotal = Number(options.clientCheapestTotal);
    const serverTotal = result.rows[0]?.total;
    const now = new Date();
    const { quote, storage } = await saveQuote({
      quoteId: newQuoteId(),
      expiresAt: new Date(now.getTime() + QUOTE_DAYS * 86400000).toISOString(),
      verified: true,
      fileName: String(options.fileName || 'part.stl').slice(0, 200),
      s3Key: options.s3Key || null,
      recommendation: options.recommendation || null,
      ...result,
    });
    res.status(201).json({
      quoteId: quote.quoteId,
      expiresAt: quote.expiresAt,
      storage,
      rows: result.rows,
      // tell the page if what it showed differs from the locked price (it shouldn't)
      matchesPreview: Number.isFinite(clientTotal) ? Math.abs(clientTotal - serverTotal) < 0.01 : null,
    });
  } catch (e) {
    next(e);
  }
});

// Quote history. Visitors only see the quotes they saved (the page keeps their IDs);
// the full list needs the ADMIN_TOKEN, so nobody can browse other people's quotes.
app.get('/api/quotes', rateLimit({ max: 60 }), async (req, res, next) => {
  try {
    const admin = process.env.ADMIN_TOKEN && req.get('x-admin-token') === process.env.ADMIN_TOKEN;
    const ids = String(req.query.ids || '').split(',').map((s) => s.trim()).filter((s) => /^Q-[A-Z0-9]{6,8}$/.test(s)).slice(0, 100);
    if (!admin && ids.length === 0) return res.json([]);
    const quotes = await listQuotes(admin ? null : ids);
    res.json(quotes.map((q) => ({ ...q, valid: q.expiresAt ? isValid(q) : false })));
  } catch (e) {
    next(e);
  }
});

// What a checkout should call: look the quote up and charge THIS total, never the browser's.
app.get('/api/quotes/:id', rateLimit({ max: 60 }), async (req, res, next) => {
  try {
    const q = await getQuote(req.params.id);
    if (!q) return res.status(404).json({ error: 'Quote not found' });
    res.json({ ...q, valid: isValid(q) });
  } catch (e) {
    next(e);
  }
});

app.post('/api/upload-url', rateLimit({ max: 20 }), async (req, res, next) => {
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
