import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, forward /api calls to the Express server, so the browser only ever
    // talks to one origin (no CORS setup needed locally).
    proxy: { '/api': 'http://localhost:5000' },
  },
})
