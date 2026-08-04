import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProjectSource } from './read-refactored-source.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = readProjectSource;

test('VS Code adapters accept native Thenable results without requiring Promise methods', async () => {
  const [previewServer, panelWatch] = await Promise.all([
    read('vscode/src/core/htmlPreviewServer.ts'),
    read('vscode/src/core/panelWatch.ts'),
  ]);

  assert.match(
    previewServer,
    /openExternal:\s*\(url:\s*string\)\s*=>\s*PromiseLike<unknown>/,
    'HtmlPreviewServer should accept VS Code Thenable values through PromiseLike',
  );
  assert.match(
    panelWatch,
    /postMessage:\s*\(msg:\s*unknown\)\s*=>\s*PromiseLike<unknown>\s*\|\s*void/,
    'panel watch host should accept VS Code Webview.postMessage Thenable values',
  );
  assert.doesNotMatch(panelWatch, /WorkspaceScanner/, 'panelWatch must not keep an unused scanner type import');
});

test('Tauri opener receives owned strings instead of Path references', async () => {
  const commands = await read('tauri/src/dispatcher/commands.rs');
  const shellBlock = commands.match(/"openShellLocation"\s*=>\s*\{([\s\S]*?)\r?\n\s*\}\r?\n\s*"copyCode"/)?.[1] ?? '';

  assert.match(shellBlock, /path_to_opener_string|to_string_lossy\(\)\.into_owned\(\)/);
  assert.doesNotMatch(shellBlock, /open_path\(source\s*,/);
  assert.doesNotMatch(shellBlock, /open_path\(parent\s*,/);
});

test('View Preferences tooltip portals into body with high z-index stacking context', async () => {
  const [tooltip, css] = await Promise.all([
    read('ui/src/components/Settings/PreferenceDescriptionTooltip.tsx'),
    read('ui/src/styles/global/global-settings-layout.css'),
  ]);

  assert.match(tooltip, /createPortal\([\s\S]*portalTarget/);
  assert.match(css, /\.settings-preference-description-panel\s*\{[\s\S]*z-index:\s*\d+/);
});

test('Mermaid vendor chunk only captures third-party modules', async () => {
  const config = await read('ui/vite.config.ts');

  assert.match(config, /const normalizedId = id\.replace/);
  assert.match(config, /isNodeModule\s*&&\s*normalizedId\.includes\('mermaid'\)/);
  assert.doesNotMatch(config, /if \(id\.includes\('mermaid'\)\)/);
});

test('UI build contracts avoid unused hooks, unstable optional narrowing, and Node timer handles', async () => {
  const [app, tableEnhancement, scheduler] = await Promise.all([
    read('ui/src/App.tsx'),
    read('ui/src/components/Content/enhancements/tableEnhancement.ts'),
    read('ui/src/components/Content/contentEnhancementScheduler.ts'),
  ]);

  const reactImport = app.match(/import \{([^}]+)\} from 'react';/)?.[1] ?? '';
  assert.doesNotMatch(reactImport, /\buseEffect\b/, 'App must not import an unused React hook');

  assert.match(
    tableEnhancement,
    /const detectChartable = tableGlobals\?\.detectChartable;/,
    'capture the optional callback once so TypeScript preserves its narrowing inside table iteration',
  );
  assert.match(tableEnhancement, /detectChartable\(table\.id\);/);

  assert.doesNotMatch(
    scheduler,
    /ReturnType<typeof setTimeout>/,
    'browser enhancement scheduling must not inherit NodeJS.Timeout from desktop ambient types',
  );
  assert.match(scheduler, /setDelay: \(callback: \(\) => void, delayMs: number\) => number;/);
  assert.match(scheduler, /clearDelay: \(handle: number\) => void;/);
});

test('sidebar search tree imports every referenced workspace search type', async () => {
  const source = await read('ui/src/components/Sidebar/sidebarSearchTree.tsx');

  assert.match(
    source,
    /import type \{ WorkspaceSearchResult \} from '\.\.\/\.\.\/types';/,
    'sidebarSearchTree must import WorkspaceSearchResult before using it in handler annotations',
  );
});

test('sidebar search narrows its nullable result tree before JSX dereferences', async () => {
  const source = await read('ui/src/components/Sidebar/SidebarSearch.tsx');

  assert.match(
    source,
    /const visibleSearchResultTree = searchResultTree &&[\s\S]*?\? searchResultTree[\s\S]*?: null;/,
    'capture the non-null search tree so TypeScript preserves narrowing in JSX',
  );
  assert.match(
    source,
    /visibleSearchResultTree && \([\s\S]*visibleSearchResultTree\.files\.map[\s\S]*visibleSearchResultTree\.children\.map/,
    'render through the narrowed tree reference instead of the nullable memo result',
  );
});
