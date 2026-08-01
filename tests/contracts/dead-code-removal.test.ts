import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const obsoleteFiles = [
  'ui/src/components/Desktop/FloatingTabToolbar.tsx',
  'ui/src/components/shared/ShellLocationContextMenu.tsx',
  'ui/src/hooks/useIsDark.ts',
  'ui/src/hooks/usePlatform.ts',
  'ui/src/lib/petImages.ts',
  'electron/preload/preload-api.js',
  'electron/render/markdown-renderer.js',
  'scripts/validate-website-app.mjs',
];

const toolbarMarkers = [
  'FloatingTabToolbar',
  'floatingToolbarPosition',
  'floatingToolbarCollapsed',
  'FLOATING_TOOLBAR_STORAGE_KEY',
  'FLOATING_TOOLBAR_ACTIONS_STORAGE_KEY',
  'tab-floating-toolbar',
  'showToolbar',
  'minimizeToolbar',
  'moveToolbar',
];

const deadSymbols = [
  'CodeIcon',
  'EyeIcon',
  'DoubleChevronLeftIcon',
  'DoubleChevronRightIcon',
  'NON_MODIFIER',
  'computeVisibleRows',
  'triggerToggleCodeCollapse',
  'getWorkspaceNameFromPath',
  'setActiveWorkspaceOperation',
  'resolveDirectoryHandle',
  'CONVERSION_QUALITY_WARNING',
  'getOpenDialogFilters',
];

const deadRustWrappers = [
  'emit_ready_ack',
  'emit_ready_ack_full',
  'emit_workspace_scan_progress',
  'emit_workspace_unavailable',
  'emit_render_content_empty_welcome',
  'emit_workspace_files_changed',
  'toggle_devtools_if_debug',
  'inject_electron_api_shim',
  'send_current_state',
];

describe('confirmed dead-code removal', () => {
  test('obsolete files are absent', () => {
    for (const path of obsoleteFiles) expect(existsSync(join(root, path)), path).toBe(false);
  });

  test('floating-toolbar markers are absent outside changelog and design history', () => {
    const files = [
      'ui/src/hooks/useDesktopTabs.ts',
      'ui/src/desktop/constants.ts',
      'ui/src/desktop/types.ts',
      'ui/src/desktop/desktopTabs.ts',
      'ui/src/settings/settingsImportExport.ts',
      'ui/src/contexts/translationTypes.ts',
      'ui/src/contexts/translations.ts',
      'ui/src/contexts/translationsData.ts',
      'ui/src/styles/global/global-content-tabs-focus-search.css',
      'ui/src/styles/global/global-dynamic-layout.css',
      'ui/src/styles/global/global-tab-actions-menus.css',
      'tests/manifest/coverage-manifest.ts',
    ];
    const text = files.map(read).join('\n');
    for (const marker of toolbarMarkers) expect(text, marker).not.toContain(marker);
  });

  test('Electron package no longer ships the deleted markdown renderer', () => {
    const packageJson = JSON.parse(read('electron/package.json'));
    expect(packageJson.build.files).not.toContain('render/**/*.js');
  });

  test('test-only production exports are removed', () => {
    const files = [
      'ui/src/components/shared/icons.tsx',
      'ui/src/utils/shortcuts.ts',
      'ui/src/dom/codeLineHandlers.ts',
      'ui/src/dom/globalHandlers.ts',
      'ui/src/desktop/desktopTabs.ts',
      'ui/src/desktop/workspaceOperations.ts',
      'chromium-xtension/src/file-access.ts',
      'electron/render/document-converter.js',
    ];
    const text = files.filter((path) => existsSync(join(root, path))).map(read).join('\n');
    for (const symbol of deadSymbols) expect(text, symbol).not.toMatch(new RegExp(`\\b${symbol}\\b`));
    expect(read('ui/src/components/shared/icons.tsx')).not.toMatch(/export const GlobeIcon\b/);
  });

  test('uncalled Tauri wrappers are absent while scoped emitters remain', () => {
    const host = read('tauri/src/host_message.rs');
    const tauriText = [
      host,
      read('tauri/src/debug_tools.rs'),
      read('tauri/src/preload/mod.rs'),
      read('tauri/src/update/manager.rs'),
    ].join('\n');
    for (const symbol of deadRustWrappers) {
      expect(tauriText, symbol).not.toMatch(new RegExp(`\\b(?:pub\\s+fn|fn)\\s+${symbol}\\b`));
    }
    expect(host).toContain('emit_workspace_scan_progress_scoped');
    expect(host).toContain('emit_workspace_unavailable_scoped');
    expect(host).toContain('emit_render_content_empty_welcome_scoped');
    expect(host).toContain('emit_workspace_files_changed_scoped');
  });

  test('remaining relative production imports resolve', () => {
    const roots = [
      'ui/src',
      'electron',
      'chromium-xtension/src',
      'vscode/src',
      'vscode/scripts',
      'website-app/src',
      'scripts',
    ];
    const ignoredSegments = new Set(['node_modules', 'dist', 'out', 'coverage', 'target', 'ui', 'vscode']);
    const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs']);
    const files: string[] = [];

    const visit = (relativePath: string, isRoot = false) => {
      const absolutePath = join(root, relativePath);
      if (!existsSync(absolutePath)) return;
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        for (const entry of readdirSync(absolutePath)) {
          if (!isRoot && ignoredSegments.has(entry)) continue;
          visit(join(relativePath, entry));
        }
        return;
      }
      if (sourceExtensions.has(extname(relativePath))) files.push(relativePath);
    };
    for (const sourceRoot of roots) visit(sourceRoot, true);

    const importPattern = /(?:from\s*|import\s*\(|require\s*\()\s*['"](\.{1,2}\/[^'"]+)['"]/g;
    const failures: string[] = [];
    for (const file of files) {
      const source = read(file);
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1].split('?')[0];
        const extension = extname(specifier);
        if (extension && !['.ts', '.tsx', '.js', '.mjs', '.json'].includes(extension)) continue;
        const base = resolve(root, dirname(file), specifier);
        const candidates = [
          base,
          `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.json`,
          join(base, 'index.ts'), join(base, 'index.tsx'), join(base, 'index.js'),
        ];
        if (!candidates.some(existsSync)) failures.push(`${file}: ${specifier}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
