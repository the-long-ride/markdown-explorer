import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(path.join(repoRoot, relativePath), 'utf8');

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
