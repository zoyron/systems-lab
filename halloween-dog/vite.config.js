import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5175,
    open: false,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
  },
});
