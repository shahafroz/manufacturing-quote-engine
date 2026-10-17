import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other server or set PORT in server/.env.`);
    process.exit(1);
  }
  throw err;
});
