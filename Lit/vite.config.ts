import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html')
    }
  },
  // publicDir will automatically be 'src/public' when root is 'src'
  server: {
    port: 5173,
    strictPort: true
  },
  css: {
    postcss: resolve(__dirname, 'postcss.config.js')
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  assetsInclude: ['**/*.ico', '**/*.icns', '**/*.png', '**/*.svg'],
});
