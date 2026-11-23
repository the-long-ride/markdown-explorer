import { describe, expect, it } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { snapshotDesktopTab } from '../../../../ui/src/desktop/desktopTabSnapshot';

const tab: any = { id: 't', kind: 'home', workspacePath: '/w', workspaceName: 'W', alias: 'old', currentFile: '/w/r.md', contentTabs: [{ filePath: '/w/r.md' }], activeContentTabPath: '/w/r.md', workspaceLoadState: 'loading', fileList: [], tree: null };

describe('snapshotDesktopTab', () => {
  it('preserves restored selection while the same workspace is loading', () => {
    const state: any = { ...initialState, workspacePath: '', workspaceName: '', isLoading: true, currentFile: null, contentTabs: [] };
    const snap = snapshotDesktopTab(state, tab, 't', {});
    expect(snap).toMatchObject({ kind: 'home', alias: 'old', workspaceName: 'W', currentFile: '/w/r.md', activeContentTabPath: '/w/r.md', workspaceLoadState: 'loading' });
    expect(snap.contentTabs).toBe(tab.contentTabs);
  });

  it('takes the live workspace, saved aliases and ready state for a different workspace', () => {
    const state: any = { ...initialState, workspacePath: '/x', workspaceName: 'X', isLoading: false, isWorkspaceScanning: false, currentFile: '/x/a.md', contentTabs: [], activeContentTabPath: null };
    const snap = snapshotDesktopTab(state, tab, 't', { '/x': 'Alias' });
    expect(snap).toMatchObject({ kind: 'workspace', alias: 'Alias', workspaceName: 'X', currentFile: '/x/a.md', workspaceLoadState: 'ready' });
    const noAlias = snapshotDesktopTab(state, tab, 't', {});
    expect(noAlias.alias).toBeUndefined();
  });
});
