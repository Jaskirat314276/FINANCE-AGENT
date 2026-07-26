import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  // @seeker/shared ships as CommonJS from a symlinked workspace — include it
  // in dep optimization + CJS interop so named imports resolve.
  optimizeDeps: {
    include: ['@seeker/shared'],
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    commonjsOptions: {
      include: [/node_modules/, /shared[\\/]dist/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
