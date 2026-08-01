import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const runtimeInclude = [
  'electron/**/*.js',
  'vscode/src/**/*.ts',
  'vscode/scripts/**/*.js',
  'ui/src/**/*.{ts,tsx,js}',
  'ui/vite.config.ts',
  'chromium-xtension/src/**/*.{ts,tsx}',
  'chromium-xtension/popup.js',
  'chromium-xtension/vite.config.ts',
];

const runtimeExclude = [
  // ── Type-only ────────────────────────────────────────────────────────────
  '**/*.d.ts',
  '**/vite-env.d.ts',
  'ui/src/types.ts',
  'ui/src/desktop/types.ts',
  'ui/src/markdown/types.ts',
  'ui/src/platform/bridge.ts',
  'vscode/src/types.ts',

  // ── Vendored / build output ─────────────────────────────────────────────
  '**/node_modules/**',
  '**/dist/**',
  '**/out/**',
  'vscode/ui/**',
  'electron/ui/**',
  'electron/vscode/**',

  // ── Entrypoints / bootstrap ─────────────────────────────────────────────
  'electron/main.js',
  'ui/src/main.tsx',
  'ui/src/AppShell.tsx',
  'chromium-xtension/popup.js',
  'chromium-xtension/src/main-chrome.tsx',

  // ── Build glue / one-shot scripts ────────────────────────────────────────
  'vscode/scripts/bundle-markdown-them.js',

  // ── Icon / asset manifests ───────────────────────────────────────────────
  'ui/src/components/shared/icons.tsx',

  // ── Static / generated data ─────────────────────────────────────────────
  'ui/src/contexts/translationsData.ts',

  // ── Canvas / heavy visual effects ───────────────────────────────────────
  'ui/src/components/shared/InteractiveBackground.tsx',

  // ── Heavy DOM-effect React components (untestable in jsdom) ────────────
  'ui/src/components/Content/Content.tsx',
  'ui/src/components/Search/SearchOverlay.tsx',
];

export default defineConfig({
  plugins: [react()],
  test: {
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    testTimeout: 20_000,
    pool: 'forks',
    fileParallelism: true,
    projects: [
      { extends: true, test: { name: 'electron',    environment: 'node',  include: ['tests/unit/electron/**/*.test.ts'],       setupFiles: ['tests/setup/node.ts'] } },
      { extends: true, test: { name: 'vscode',     environment: 'node',  include: ['tests/unit/vscode/**/*.test.ts'],        setupFiles: ['tests/setup/node.ts'] } },
      { extends: true, test: { name: 'ui',         environment: 'jsdom', include: ['tests/unit/ui/**/*.test.{ts,tsx}'],      setupFiles: ['tests/setup/dom.ts'] } },
      { extends: true, test: { name: 'chromium',   environment: 'jsdom', include: ['tests/unit/chromium/**/*.test.{ts,tsx}'], setupFiles: ['tests/setup/chromium.ts'] } },
      { extends: true, test: { name: 'contracts',  environment: 'node',  include: ['tests/contracts/**/*.test.ts'],          setupFiles: ['tests/setup/node.ts'] } },
      { extends: true, test: { name: 'manifest',    environment: 'node',  include: ['tests/manifest/**/*.test.ts'],           setupFiles: ['tests/setup/node.ts'] } },
      { extends: true, test: { name: 'build',       environment: 'node',  include: ['tests/unit/build/**/*.test.ts'],         setupFiles: ['tests/setup/node.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: runtimeInclude,
      exclude: runtimeExclude,
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
