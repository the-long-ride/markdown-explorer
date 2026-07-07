// =============================================================================
// website-app/vite.config.ts — Vite config for the demo React app
// =============================================================================
// Builds to website-app/dist/ which GHA copies into website/app/.
// Base path matches the GitHub Pages sub-path: /markdown-explorer/app/
// =============================================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

// Chunks that must not be modulepreloaded — loaded on demand via dynamic import()
const LAZY_CHUNKS = ['vendor-mermaid', 'vendor-hljs', 'katex', 'vendor-chart', 'vendor-react', 'translationsData'];

export default defineConfig({
  plugins: [
    react(),

    // Copy bundled fonts to dist so @font-face in index.html can find them.
    {
      name: 'copy-fonts',
      enforce: 'post',
      writeBundle() {
        const srcRoot = resolve(__dirname, '../ui/assets/fonts');
        const destRoot = resolve(__dirname, 'dist/assets/fonts');
        if (!existsSync(srcRoot)) return;
        function copyDir(src: string, dest: string) {
          mkdirSync(dest, { recursive: true });
          for (const entry of readdirSync(src, { withFileTypes: true })) {
            const srcPath = resolve(src, entry.name);
            const destPath = resolve(dest, entry.name);
            if (entry.isDirectory()) copyDir(srcPath, destPath);
            else copyFileSync(srcPath, destPath);
          }
        }
        copyDir(srcRoot, destRoot);
      },
    },

    // Non-blocking CSS + strip lazy modulepreload links.
    {
      name: 'html-optimizations',
      enforce: 'post',
      transformIndexHtml(html) {
        html = html.replace(
          /<link\s+rel="stylesheet"([^>]*)href="([^"]+)"([^>]*)>/gi,
          (_match, before, href, after) => {
            if (/media=/i.test(_match)) return _match;
            return `<link rel="preload" as="style" href="${href}">\n    <link rel="stylesheet"${before}href="${href}"${after} media="print" onload="this.media='all'">\n    <noscript><link rel="stylesheet"${before}href="${href}"${after}></noscript>`;
          }
        );
        return html.replace(
          /<link\s+rel="modulepreload"[^>]*href="[^"]*\/([^/"]+)"[^>]*>/gi,
          (match, filename) => {
            const base = filename.replace(/\.js$/, '');
            return LAZY_CHUNKS.includes(base) ? '' : match;
          },
        );
      },
    },
  ],

  // GitHub Pages base path — the React app lives at /markdown-explorer/app/
  base: '/markdown-explorer/app/',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
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

  resolve: {
    alias: {
      // Allow website-app/src to import from ui/src directly
      '@ui': resolve(__dirname, '../ui/src'),
    },
  },
});
