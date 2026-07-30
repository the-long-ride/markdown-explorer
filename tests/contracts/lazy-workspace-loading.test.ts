import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('lazy workspace loading parity', () => {
  test('keeps every native and browser host on the 3-second, 32-file reveal contract', () => {
    for (const source of [
      read('electron/core/runtime-workspace-handlers.js'),
      read('vscode/src/core/incrementalScan.ts'),
      read('chromium-xtension/src/incremental-workspace-scan.ts'),
      read('website-app/src/web-file-mode.ts'),
    ]) {
      expect(source).toContain('3000');
      expect(source).toContain('WORKSPACE_SCAN_BATCH_SIZE');
    }
    const tauri = read('tauri/src/dispatcher/incremental_scan.rs');
    expect(tauri).toContain('Duration::from_secs(3)');
    expect(tauri).toContain('WORKSPACE_SCAN_BATCH_SIZE: usize = 32');
    for (const host of [
      read('electron/core/runtime-workspace-handlers.js'),
      read('vscode/src/core/panel.ts'),
      read('chromium-xtension/src/chrome-host.ts'),
      read('website-app/src/web-file-mode.ts'),
      tauri,
    ]) expect(host).toMatch(/workspaceFilesChanged|emit_workspace_files_changed_scoped/);
  });

  test('reports scan progress in every scanner implementation', () => {
    for (const source of [
      read('electron/workspace/scanner.js'),
      read('tauri/src/workspace/scanner.rs'),
      read('vscode/src/core/scanner.ts'),
      read('chromium-xtension/src/scanner.ts'),
    ]) {
      expect(source).toMatch(/progress|report_progress|reportProgress|onProgress/);
      expect(source).toMatch(/onFile|report_file|reportFile/);
    }
  });

  test('uses the shared nonblocking progress protocol from host through UI', () => {
    expect(read('ui/src/types/hostMessages.ts')).toContain("command: 'workspaceScanProgress'");
    expect(read('ui/src/contexts/useAppStateEffects.ts')).toContain("case 'workspaceScanProgress'");
    expect(read('ui/src/AppView.tsx')).toContain('Scanning {state.scannedFiles.toLocaleString()} files');
  });
});
