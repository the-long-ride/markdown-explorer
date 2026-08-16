import { beforeEach, describe, expect, test } from 'vitest';
import {
  createEmptyTab,
  readPersistedDesktopTabs,
  writePersistedDesktopTabs,
} from '../../../ui/src/desktop/desktopTabs';
import { createPlaceholderContentTab } from '../../../ui/src/contexts/contentTabState';
import { DESKTOP_TABS_STORAGE_KEY } from '../../../ui/src/constants/storage';
import { reducer as appStateReducer } from '../../../ui/src/contexts/appStateReducer';
import { createInitialState } from '../../../ui/src/contexts/appStateModel';
import type { MdFile } from '../../../ui/src/types';

const mdFile = (fsPath: string): MdFile => ({
  fsPath,
  fileName: fsPath.split('/').pop()!,
  title: fsPath.split('/').pop()!,
  relativePath: fsPath,
  parts: fsPath.split('/'),
});

describe('content tab restore', () => {
  beforeEach(() => localStorage.clear());

  test('writePersistedDesktopTabs persists content tab paths and active path', () => {
    const tab = createEmptyTab('tab-1', 'workspace');
    tab.workspacePath = '/tmp/ws';
    tab.currentFile = '/tmp/ws/active.md';
    tab.contentTabs = [
      createPlaceholderContentTab(mdFile('/tmp/ws/a.md')),
      createPlaceholderContentTab(mdFile('/tmp/ws/active.md')),
    ];
    tab.activeContentTabPath = '/tmp/ws/active.md';
    writePersistedDesktopTabs([tab], 'tab-1');
    const restored = readPersistedDesktopTabs({});
    const workspaceTab = restored.tabs.find((item) => item.id === 'tab-1')!;
    expect(workspaceTab.restoredContentTabPaths).toEqual(['/tmp/ws/a.md', '/tmp/ws/active.md']);
    expect(workspaceTab.currentFile).toBe('/tmp/ws/active.md');
  });

  test('RESTORE_CONTENT_TABS filters missing files and keeps active tab', () => {
    const state = {
      ...createInitialState(undefined, false),
      fileList: [mdFile('/tmp/ws/a.md'), mdFile('/tmp/ws/gone.md')],
      currentFile: '/tmp/ws/a.md',
    };
    const next = appStateReducer(state, {
      type: 'RESTORE_CONTENT_TABS',
      filePaths: ['/tmp/ws/a.md', '/tmp/ws/deleted.md'],
    });
    expect(next.contentTabs.map((tab) => tab.filePath)).toEqual(['/tmp/ws/a.md']);
    expect(next.activeContentTabPath).toBe('/tmp/ws/a.md');
  });

  test('RESTORE_CONTENT_TABS appends the active file when it is not among restored paths', () => {
    const state = {
      ...createInitialState(undefined, false),
      fileList: [mdFile('/tmp/ws/a.md'), mdFile('/tmp/ws/b.md')],
      currentFile: '/tmp/ws/b.md',
    };
    const next = appStateReducer(state, {
      type: 'RESTORE_CONTENT_TABS',
      filePaths: ['/tmp/ws/a.md'],
    });
    expect(next.contentTabs.map((tab) => tab.filePath)).toEqual(['/tmp/ws/a.md', '/tmp/ws/b.md']);
    expect(next.activeContentTabPath).toBe('/tmp/ws/b.md');
  });

  test('RESTORE_CONTENT_TABS is a no-op with an empty file list', () => {
    const state = {
      ...createInitialState(undefined, false),
      fileList: [],
      currentFile: null,
    };
    const next = appStateReducer(state, {
      type: 'RESTORE_CONTENT_TABS',
      filePaths: ['/tmp/ws/a.md'],
    });
    expect(next).toBe(state);
  });
});
