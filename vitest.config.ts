import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const runtimeInclude = [
  'desktop/**/*.js',
  'vscode/src/**/*.ts',
  'vscode/scripts/**/*.js',
  'ui/src/**/*.{ts,tsx,js}',
  'ui/vite.config.ts',
  'chromium-xtension/src/**/*.{ts,tsx}',
  'chromium-xtension/popup.js',
  'chromium-xtension/vite.config.ts',
];

const runtimeExclude = [
  '**/*.d.ts',
  '**/vite-env.d.ts',
  'ui/src/types.ts',
  'ui/src/desktop/types.ts',
  'ui/src/markdown/types.ts',
  'ui/src/platform/bridge.ts',
  'vscode/src/types.ts',
  '**/node_modules/**',
  '**/dist/**',
  '**/out/**',
  'vscode/ui/**',
  'desktop/ui/**',
  'desktop/vscode/**',
];

export default defineConfig({
  plugins: [react()],
  test: {
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    projects: [
      { extends: true, test: { name: 'desktop', environment: 'node', include: ['tests/unit/desktop/**/*.test.ts'], setupFiles: ['tests/setup/node.ts'] } },
      { extends: true, test: { name: 'vscode', environment: 'node', include: ['tests/unit/vscode/**/*.test.ts'], setupFiles: ['tests/setup/node.ts'] } },
      { extends: true, test: { name: 'ui', environment: 'jsdom', include: ['tests/unit/ui/**/*.test.{ts,tsx}'], setupFiles: ['tests/setup/dom.ts'] } },
      { extends: true, test: { name: 'chromium', environment: 'jsdom', include: ['tests/unit/chromium/**/*.test.{ts,tsx}'], setupFiles: ['tests/setup/chromium.ts'] } },
      { extends: true, test: { name: 'contracts', environment: 'node', include: ['tests/contracts/**/*.test.ts'], setupFiles: ['tests/setup/node.ts'] } },
      { extends: true, test: { name: 'manifest', environment: 'node', include: ['tests/manifest/**/*.test.ts'], setupFiles: ['tests/setup/node.ts'] } },
      { extends: true, test: { name: 'build', environment: 'node', include: ['tests/unit/build/**/*.test.ts'], setupFiles: ['tests/setup/node.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: runtimeInclude,
      exclude: runtimeExclude,
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: { 100: true },
    },
  },
});
