import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Build the public demo site as a separate output so it can ship alongside
// the npm library without overwriting package entry points or declarations.
export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist/site',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        playground: resolve(process.cwd(), 'playground.html'),
      },
    },
  },
});
