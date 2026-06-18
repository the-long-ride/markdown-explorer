import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isElectron = process.env.BUILD_TARGET === 'electron' || mode === 'electron';

  return {
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
          manualChunks: (id) => {
            if (id.includes('mermaid')) return 'vendor-mermaid';
            if (id.includes('chart.js')) return 'vendor-chart';
            if (id.includes('highlight.js')) return 'vendor-hljs';
            if (id.includes('/katex/') || id.includes('\\katex\\')) return 'katex';
          },
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
  };
});
