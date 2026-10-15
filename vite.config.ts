import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('./src/index.ts', import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry,
      name: 'UniversalPlayer',
      formats: ['es'],
      fileName: 'universal-player',
      cssFileName: 'universal-player',
    },
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});