// =============================================================================
// chrome/vite.config.ts — Vite configuration for Chromium Extension
// =============================================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-assets',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist');
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true });
        }
        
        // Copy manifest.json
        const manifestSrc = resolve(__dirname, 'manifest.json');
        const manifestDist = resolve(distDir, 'manifest.json');
        if (fs.existsSync(manifestSrc)) {
          fs.copyFileSync(manifestSrc, manifestDist);
        }

        // Copy icons directory
        const iconsSrc = resolve(__dirname, 'icons');
        const iconsDist = resolve(distDir, 'icons');
        if (fs.existsSync(iconsSrc)) {
          if (!fs.existsSync(iconsDist)) {
            fs.mkdirSync(iconsDist, { recursive: true });
          }
          const files = fs.readdirSync(iconsSrc);
          for (const file of files) {
            fs.copyFileSync(resolve(iconsSrc, file), resolve(iconsDist, file));
          }
        }
      }
    }
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'popup.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
