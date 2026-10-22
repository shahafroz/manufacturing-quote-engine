// Simple per-IP rate limiter (fixed one-minute window, kept in memory).
// Enough for one server instance; several instances would need a shared store like Redis.
export function rateLimit({ max, windowMs = 60_000 }) {
  const hits = new Map(); // ip → { count, resetAt }
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + windowMs };
      hits.set(req.ip, h);
    }
    h.count++;
    res.set('RateLimit-Remaining', String(Math.max(0, max - h.count)));
    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests, please wait a minute' });
    }
    next();
  };
}
