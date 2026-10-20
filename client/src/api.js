import axios from 'axios';

// All calls to our Express server go through here.
// Development: same origin, Vite forwards /api to localhost:5000 (see vite.config.js).
// Production: VITE_API_URL points at the deployed server (set it in Vercel).
export const api = axios.create({
  baseURL: import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL,
  timeout: 60000,
});

// Turn an axios error into a short message for the UI
export const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';
