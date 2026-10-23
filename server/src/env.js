// Load server/.env no matter which folder the server is started from.
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

// On some Windows setups Node can't read the system DNS settings and falls back to 127.0.0.1,
// where nothing answers. The mongodb+srv:// lookup then fails, so use public DNS instead.
if (dns.getServers().every((s) => s === '127.0.0.1' || s === '::1')) {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
}
