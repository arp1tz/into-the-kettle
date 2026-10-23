import { defineConfig } from 'vite';

// Relative base so the build runs from any sub-path (GitHub Pages serves it at /into-the-kettle/).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
