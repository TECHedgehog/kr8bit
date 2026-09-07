import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// KR8BIT_BACKEND_URL overrides the dev/preview proxy target
// (default: http://127.0.0.1:8080)
const apiProxy = {
  '/api': {
    target: process.env.KR8BIT_BACKEND_URL ?? 'http://127.0.0.1:8080',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
