import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const TAURI_HOST_SRC = [
  'tauri/src/host_message.rs',
  'tauri/src/update/manager.rs',
  'tauri/src/core/bootstrap.rs',
].map(readSrc).join('\n\n');

const REQUIRED_HOST_COMMANDS = [
  'renderContent',
  'readyAck',
  'workspaceFilesChanged',
  'currentFileChanged',
  'recentWorkspacesChanged',
  'navNotFound',
  'workspaceUnavailable',
  'setLoading',
  'workspaceScanProgress',
  'updateStateChanged',
  'window-state-changed',
  'crossTabSearchResults',
  'workspaceSearchResults',
  'workspaceSearchIndexLoaded',
  'fullscreenChanged',
];

describe('tauri host-message parity', () => {
  for (const cmd of REQUIRED_HOST_COMMANDS) {
    test(`${cmd} is emitted by tauri host code`, () => {
      expect(TAURI_HOST_SRC).toContain(cmd);
    });
  }

  describe('required fields appear near emit helpers', () => {
    test('readyAck has fileList, tree, theme, defaultExpanded, workspaceName', () => {
      const src = readSrc('tauri/src/host_message.rs');
      expect(src).toContain('fileList');
      expect(src).toContain('tree');
      expect(src).toContain('theme');
      expect(src).toContain('defaultExpanded');
      expect(src).toContain('workspaceName');
    });

    test('renderContent has html, frontmatter, toc, filePath, title', () => {
      const src = readSrc('tauri/src/host_message.rs');
      expect(src).toContain('"html"');
      expect(src).toContain('"frontmatter"');
      expect(src).toContain('"toc"');
      expect(src).toContain('"filePath"');
      expect(src).toContain('"title"');
    });

    test('workspaceUnavailable has workspacePath, workspaceName, reason', () => {
      const src = readSrc('tauri/src/host_message.rs');
      expect(src).toContain('"workspacePath"');
      expect(src).toContain('"workspaceName"');
      expect(src).toContain('"reason"');
    });


    test('workspace-scoped messages include operation and tab identifiers', () => {
      const src = readSrc('tauri/src/host_message.rs');
      expect(src).toContain('workspaceOperationId');
      expect(src).toContain('workspaceTabId');
      expect(src).toContain('workspace_operation_id');
      expect(src).toContain('workspace_tab_id');
    });

    test('workspaceSearchResults has requestId, results', () => {
      const src = readSrc('tauri/src/host_message.rs');
      expect(src).toContain('"requestId"');
      expect(src).toContain('"results"');
    });
  });
});
