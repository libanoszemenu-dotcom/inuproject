import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser talks to http://localhost:5173/api/... and Vite forwards it to the Express API.
// Because the page and the API share one origin, the login cookie works without CORS tricks.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
});
