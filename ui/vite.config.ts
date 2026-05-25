import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isElectron = process.env.BUILD_TARGET === 'electron';

export default defineConfig({
  plugins: [
    react(),
    // Strip @font-face from CSS when building for VS Code
    !isElectron && {
      name: 'strip-font-face',
      enforce: 'pre',
      transform(code, id) {
        if (id.split('?')[0].endsWith('.css')) {
          return code.replace(/@font-face\s*\{[^}]*\}/g, '');
        }
      }
    }
  ].filter(Boolean),
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-mermaid': ['mermaid'],
          'vendor-chart': ['chart.js'],
          'vendor-hljs': ['highlight.js'],
        },
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
