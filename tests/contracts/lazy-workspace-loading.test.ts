import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('lazy workspace loading parity', () => {
  test('keeps every native and browser host on the 2.5-second reveal budget', () => {
    for (const source of [
      read('electron/core/runtime-workspace-handlers.js'),
      read('vscode/src/core/panel.ts'),
      read('chromium-xtension/src/chrome-host.ts'),
      read('website-app/src/web-file-mode.ts'),
    ]) {
      expect(source).toContain('2500');
      expect(source).toContain('workspaceFilesChanged');
    }
  });

  test('reports scan progress in every scanner implementation', () => {
    for (const source of [
      read('electron/workspace/scanner.js'),
      read('tauri/src/workspace/scanner.rs'),
      read('vscode/src/core/scanner.ts'),
      read('chromium-xtension/src/scanner.ts'),
    ]) {
      expect(source).toMatch(/progress|report_progress|reportProgress|onProgress/);
      expect(source).toContain('100');
    }
  });

  test('uses the shared nonblocking progress protocol from host through UI', () => {
    expect(read('ui/src/types.ts')).toContain("command: 'workspaceScanProgress'");
    expect(read('ui/src/contexts/useAppStateEffects.ts')).toContain("case 'workspaceScanProgress'");
    expect(read('ui/src/AppView.tsx')).toContain('Scanning {state.scannedFiles.toLocaleString()} files');
  });
});
