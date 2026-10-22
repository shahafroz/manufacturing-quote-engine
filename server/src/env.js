// Load server/.env no matter which folder the server is started from.
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
