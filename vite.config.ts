import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    // Demo build: fonts embedded in the CSS so the page works on hosts that only allow inline fonts
    assetsInlineLimit: mode === 'demo' ? (file: string) => (/\.woff2?$/.test(file) ? true : undefined) : 4096,
    rollupOptions: {
      output: {
        // the demo database file is served under a generic binary extension
        assetFileNames: (a: { name?: string }) => (a.name?.endsWith('.data') ? 'assets/[name]-data-[hash].wasm' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
}));
