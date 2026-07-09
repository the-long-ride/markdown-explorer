import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const dispatcherPath = path.join(repoRoot, 'tauri/src/dispatcher.rs');
const dispatcherSrc = fs.readFileSync(dispatcherPath, 'utf8');

const REQUIRED_DESKTOP_WEBVIEW_COMMANDS = [
  'ready', 'navigate', 'openFolder', 'openFile', 'openPath',
  'activateWorkspace', 'searchAcrossWorkspaces', 'searchWorkspace',
  'indexWorkspaceSearchItems', 'loadWorkspaceSearchIndexes', 'confirmOpenPath',
  'openRecentWorkspace', 'deleteRecentWorkspace', 'replaceRecentWorkspaces',
  'closeWorkspace', 'zoom-in', 'zoom-out', 'openInEditor', 'copyCode',
  'openExternal', 'refresh', 'setDocumentConversion', 'downloadUpdate',
  'scheduleDownloadedUpdate', 'restartAndApplyUpdate', 'window-minimize',
  'window-maximize', 'window-close', 'updateAppearance',
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('tauri dispatcher parity', () => {
  for (const cmd of REQUIRED_DESKTOP_WEBVIEW_COMMANDS) {
    test(`${cmd} is handled by tauri dispatcher`, () => {
      const pattern = new RegExp(`"${escapeRegex(cmd)}"\\s*=>`);
      expect(dispatcherSrc).toMatch(pattern);
    });
  }

  test('no Part A stub comments remain for implemented commands', () => {
    const stubPatterns = [
      /\/\/\s*TODO/i,
      /\/\/\s*stub/i,
      /\/\/\s*placeholder/i,
      /\/\/\s*not yet implemented/i,
      /unimplemented!\(/,
      /todo!\(/,
    ];
    for (const pattern of stubPatterns) {
      const matches = dispatcherSrc.match(new RegExp(pattern.source, 'gi'));
      expect(matches).toBeNull();
    }
  });

  test('navigate reads "path" key (not "filePath") — matches Electron IPC contract', () => {
    const electronHandlersPath = path.join(repoRoot, 'electron/core/ipc-handlers.js');
    const electronSrc = fs.readFileSync(electronHandlersPath, 'utf8');

    const electronNavigateMatch = electronSrc.match(/case\s+["']navigate["'].*?msg\.(\w+)/s);
    expect(electronNavigateMatch).not.toBeNull();
    const electronField = electronNavigateMatch![1];

    const tauriNavigateMatch = dispatcherSrc.match(/"navigate"\s*=>\s*\{[^}]*msg\.get\("(\w+)"\)/s);
    expect(tauriNavigateMatch).not.toBeNull();
    const tauriField = tauriNavigateMatch![1];

    expect(tauriField).toBe(electronField);
    expect(tauriField).toBe('path');
  });

  test('activateWorkspace reads openFirstFile from message', () => {
    const match = dispatcherSrc.match(/"activateWorkspace"\s*=>\s*\{[\s\S]*?openFirstFile[\s\S]*?msg\s*\.\s*get\("openFirstFile"\)/);
    expect(match).not.toBeNull();
  });

  test('activateWorkspace passes openFirstFile to send_initial_content (not hardcoded false)', () => {
    const match = dispatcherSrc.match(/"activateWorkspace"\s*=>\s*\{[\s\S]*?send_initial_content\(open_first_file\)/);
    expect(match).not.toBeNull();

    const hardcodedFalse = dispatcherSrc.match(/"activateWorkspace"\s*=>\s*\{[\s\S]*?send_initial_content\(false\)/);
    expect(hardcodedFalse).toBeNull();
  });

  test('navigate does not read "filePath" key', () => {
    const navigateBlock = dispatcherSrc.match(/"navigate"\s*=>\s*\{[\s\S]*?\}/);
    expect(navigateBlock).not.toBeNull();
    expect(navigateBlock![0]).not.toContain('filePath');
  });
});
