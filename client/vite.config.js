import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A Vercel build without VITE_API_URL would deploy a site that can't reach the API
  if (command === 'build' && process.env.VERCEL && !loadEnv(mode, process.cwd()).VITE_API_URL) {
    throw new Error('Set VITE_API_URL in Vercel (Settings → Environment Variables) to your Render API URL.')
  }
  return {
    plugins: [react()],
    server: {
      // In development, forward /api calls to the Express server, so the browser only ever
      // talks to one origin (no CORS setup needed locally).
      proxy: { '/api': 'http://localhost:5000' },
    },
  }
})
