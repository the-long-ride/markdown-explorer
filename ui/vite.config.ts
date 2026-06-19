import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isElectron = process.env.BUILD_TARGET === 'electron' || mode === 'electron';

  // Chunks that must not be modulepreloaded — they load on-demand via dynamic import()
  const LAZY_CHUNKS = ['vendor-mermaid', 'vendor-hljs', 'katex', 'vendor-chart'];

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
      },
      // Strip modulepreload links for lazy-loaded vendor chunks.
      // Vite auto-generates <link rel="modulepreload"> for ALL dynamic import chunks,
      // which forces the browser to fetch + parse mermaid (6.2MB), hljs, katex, and chart
      // on cold start even though they are only needed after content rendering.
      {
        name: 'strip-lazy-modulepreload',
        enforce: 'post',
        transformIndexHtml(html) {
          return html.replace(
            /<link\s+rel="modulepreload"[^>]*href="[^"]*\/([^/"]+)"[^>]*>/gi,
            (match, filename) => {
              const base = filename.replace(/\.js$/, '');
              if (LAZY_CHUNKS.includes(base)) return '';
              return match;
            },
          );
        },
      },
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
