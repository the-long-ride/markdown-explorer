// =============================================================================
// website-app/vite.config.ts — Vite config for the demo React app
// =============================================================================
// Builds to website-app/dist/ which GHA copies into website/app/.
// Base path matches the GitHub Pages sub-path: /markdown-explorer/app/
// =============================================================================

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';
import { copyFileSync, mkdirSync, existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, resolve, sep } from 'path';

const PAGES_BASE = '/markdown-explorer';
const APP_BASE = `${PAGES_BASE}/app`;
const WEBSITE_DIR = resolve(__dirname, '../website');

const STATIC_MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function createWebsiteLandingMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.url) return next();

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(req.url, 'http://localhost');
    } catch {
      return next();
    }

    const { pathname, search } = parsedUrl;
    if (pathname === '/' || pathname === PAGES_BASE) {
      res.statusCode = 302;
      res.setHeader('Location', `${PAGES_BASE}/${search}`);
      res.end();
      return;
    }
    if (pathname === APP_BASE) {
      res.statusCode = 302;
      res.setHeader('Location', `${APP_BASE}/${search}`);
      res.end();
      return;
    }
    if (pathname.startsWith(`${APP_BASE}/`) || !pathname.startsWith(`${PAGES_BASE}/`)) {
      return next();
    }

    let decodedRel: string;
    try {
      decodedRel = decodeURIComponent(pathname.slice(PAGES_BASE.length + 1));
    } catch {
      return next();
    }

    const targetPath = decodedRel === '' || decodedRel.endsWith('/')
      ? join(WEBSITE_DIR, decodedRel, 'index.html')
      : resolve(WEBSITE_DIR, decodedRel);
    if (targetPath !== WEBSITE_DIR && !targetPath.startsWith(`${WEBSITE_DIR}${sep}`)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    try {
      const stats = statSync(targetPath);
      if (stats.isDirectory()) {
        res.statusCode = 302;
        res.setHeader('Location', `${pathname}/${search}`);
        res.end();
        return;
      }
      if (!stats.isFile()) return next();

      const mimeType = STATIC_MIME_TYPES[extname(targetPath).toLowerCase()] ?? 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(readFileSync(targetPath));
    } catch {
      next();
    }
  };
}

function logWiredWebsiteUrls(port: number) {
  const origin = `http://localhost:${port}`;
  console.log(`\n  [web] GitHub Pages mirror ready:`);
  console.log(`  ➜  Entry (redirects to mode=web): ${origin}${PAGES_BASE}/`);
  console.log(`  ➜  Landing page:                  ${origin}${PAGES_BASE}/landing.html`);
  console.log(`  ➜  Web App (mode=web):            ${origin}${APP_BASE}/?mode=web`);
  console.log(`  ➜  Demo (mode=test):              ${origin}${APP_BASE}/?mode=test\n`);
}

function serveWebsiteLandingPlugin(): Plugin {
  const attach = (middlewares: { use: (fn: ReturnType<typeof createWebsiteLandingMiddleware>) => void }, httpServer: { once?: (ev: string, cb: () => void) => void; address?: () => unknown } | null) => {
    middlewares.use(createWebsiteLandingMiddleware());
    httpServer?.once?.('listening', () => {
      const addr = httpServer.address?.();
      const port = typeof addr === 'object' && addr && 'port' in addr ? Number(addr.port) : 5173;
      logWiredWebsiteUrls(port);
    });
  };
  return {
    name: 'serve-website-landing',
    configureServer(server) {
      attach(server.middlewares, server.httpServer);
    },
    configurePreviewServer(server) {
      attach(server.middlewares, server.httpServer);
    },
  };
}

// Chunks that must not be modulepreloaded — loaded on demand via dynamic import()
const LAZY_CHUNKS = ['vendor-mermaid', 'vendor-hljs', 'katex', 'vendor-chart', 'vendor-react', 'translationsData'];

export default defineConfig({
  root: __dirname,
  plugins: [
    serveWebsiteLandingPlugin(),
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

  server: {
    host: 'localhost',
    port: 5173,
  },

  preview: {
    host: 'localhost',
    port: 5173,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        features: resolve(__dirname, 'features/index.html'),
      },
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
