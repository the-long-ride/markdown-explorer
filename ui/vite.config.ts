import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';

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
      // Copy bundled fonts to dist so critical inline @font-face in index.html can find them.
      // Electron needs the TTF files at dist/assets/fonts/ for fast first-paint font loading.
      {
        name: 'copy-fonts',
        enforce: 'post',
        writeBundle() {
          const srcRoot = resolve(__dirname, 'assets/fonts');
          const destRoot = resolve(__dirname, 'dist/assets/fonts');
          if (!existsSync(srcRoot)) return;
          function copyDir(src, dest) {
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
      // Non-blocking CSS + strip lazy modulepreload.
      // 1) Converts <link rel="stylesheet"> to async load with media="print" trick,
      //    adds a preload hint so the download starts as early as possible,
      //    and a <noscript> fallback for users without JS.
      // 2) Strips modulepreload links for lazy-loaded vendor chunks so the
      //    browser doesn't pre-parse mermaid (6.2MB), hljs, katex, or chart on cold start.
      {
        name: 'html-optimizations',
        enforce: 'post',
        transformIndexHtml(html) {
          // Make CSS non-blocking so the browser can paint before stylesheets arrive.
          // Critical inline styles in index.html provide the initial frame.
          html = html.replace(
            /<link\s+rel="stylesheet"([^>]*)href="([^"]+)"([^>]*)>/gi,
            (match, before, href, after) => {
              // Already has a media attribute — leave it alone
              if (/media=/i.test(match)) return match;
              return `<link rel="preload" as="style" href="${href}">\n    <link rel="stylesheet"${before}href="${href}"${after} media="print" onload="this.media='all'">\n    <noscript><link rel="stylesheet"${before}href="${href}"${after}></noscript>`;
            }
          );
          // Strip modulepreload for lazy chunks
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