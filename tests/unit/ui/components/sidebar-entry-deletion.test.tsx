import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslations } from '../../../../ui/src/contexts/translations';

const closeContentTab = vi.fn();
const discardDocumentChanges = vi.fn();
const dispatchActionNotice = vi.fn();
const file = (relativePath: string) => ({
  fsPath: `C:\\ws\\${relativePath.replace(/\//g, '\\')}`, relativePath: relativePath.replace(/\//g, '\\'),
  parts: relativePath.split('/'), fileName: relativePath.split('/').pop()!, title: relativePath, extension: '.md', modifiedAt: 0,
});
const docA = file('docs/a.md');
const docB = file('docs/sub/b.md');
const other = file('keep.md');
const appState: any = {
  state: { fileList: [docA, docB, other], documentSessions: {} },
  closeContentTab, discardDocumentChanges,
};
vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({ useAppState: () => appState }));
vi.mock('../../../../ui/src/utils/actionNotice', () => ({ dispatchActionNotice: (...args: unknown[]) => dispatchActionNotice(...args) }));
const { useSidebarEntryDeletion } = await import('../../../../ui/src/components/Sidebar/useSidebarEntryDeletion');

function fakeBridge(reply: (message: any) => any) {
  const listeners = new Set<(m: any) => void>();
  const posted: any[] = [];
  return {
    posted,
    postMessage: (m: any) => { posted.push(m); queueMicrotask(() => { const r = reply(m); for (const l of [...listeners]) l(r); }); },
    onMessage: (l: (m: any) => void) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

const t = getTranslations('en');
const session = (f: { fsPath: string }, dirty: boolean) => ({ filePath: f.fsPath, source: dirty ? 'x' : 'y', persistedSource: 'y', lineEnding: '\n', revision: null, mode: 'rendered', saveState: 'idle', pendingSaveSource: null, conflict: null });

beforeEach(() => {
  closeContentTab.mockClear();
  discardDocumentChanges.mockClear();
  dispatchActionNotice.mockClear();
  appState.state = { fileList: [docA, docB, other], documentSessions: {} };
});

const setup = (bridge: ReturnType<typeof fakeBridge>, deleteMode: 'trash' | 'permanent' | null = 'trash') =>
  renderHook(() => useSidebarEntryDeletion({ bridge, t, deleteMode })).result;

describe('useSidebarEntryDeletion', () => {
  it('closes tabs and discards sessions only for removed files', async () => {
    const bridge = fakeBridge((m) => ({ command: 'deleteWorkspaceEntriesResult', requestId: m.requestId, mode: 'trash', deleted: ['docs'], failed: [] }));
    const result = setup(bridge);
    const outcome = await result.current.deleteEntries(['docs', 'keep.md']);
    expect(bridge.posted[0]).toMatchObject({ command: 'deleteWorkspaceEntries', paths: ['docs', 'keep.md'] });
    expect(outcome.removedFsPaths).toEqual(new Set([docA.fsPath, docB.fsPath]));
    expect(discardDocumentChanges.mock.calls.map((c) => c[0]).sort()).toEqual([docA.fsPath, docB.fsPath].sort());
    expect(closeContentTab.mock.calls.map((c) => c[0]).sort()).toEqual([docA.fsPath, docB.fsPath].sort());
    expect(dispatchActionNotice).not.toHaveBeenCalled();
  });
  it('uses the snapshot taken before the request, not the refreshed list', async () => {
    const bridge = fakeBridge((m) => {
      appState.state = { ...appState.state, fileList: [other] };
      return { command: 'deleteWorkspaceEntriesResult', requestId: m.requestId, mode: 'trash', deleted: ['docs/a.md'], failed: [] };
    });
    const result = setup(bridge);
    const outcome = await result.current.deleteEntries(['docs/a.md']);
    expect([...outcome.removedFsPaths]).toEqual([docA.fsPath]);
    expect(closeContentTab).toHaveBeenCalledWith(docA.fsPath);
  });
  it('notifies about failed entries and leaves their tabs alone', async () => {
    const bridge = fakeBridge((m) => ({
      command: 'deleteWorkspaceEntriesResult', requestId: m.requestId, mode: 'permanent',
      deleted: ['docs/a.md'], failed: [{ path: 'docs/sub/b.md', reason: 'permission-denied' }, { path: 'keep.md', reason: 'failed' }],
    }));
    const result = setup(bridge, 'permanent');
    const outcome = await result.current.deleteEntries(['docs/a.md', 'docs/sub/b.md', 'keep.md']);
    expect(bridge.posted[0].paths).toEqual(['docs/a.md', 'docs/sub/b.md', 'keep.md']);
    expect(closeContentTab).toHaveBeenCalledTimes(1);
    expect(closeContentTab).toHaveBeenCalledWith(docA.fsPath);
    expect(outcome.removedFsPaths).toEqual(new Set([docA.fsPath]));
    expect(dispatchActionNotice).toHaveBeenCalledOnce();
    const [message, tone] = dispatchActionNotice.mock.calls[0];
    expect(tone).toBe('error');
    expect(message).toContain('b.md');
    expect(message).toContain('keep.md');
    expect(message).not.toContain('{names}');
  });
  it('isGone treats descendants of deleted folders as gone', async () => {
    const bridge = fakeBridge((m) => ({ command: 'deleteWorkspaceEntriesResult', requestId: m.requestId, mode: 'trash', deleted: ['docs'], failed: [] }));
    const result = setup(bridge);
    const { isGone } = await result.current.deleteEntries(['docs']);
    expect(isGone('docs')).toBe(true);
    expect(isGone('docs/sub/b.md')).toBe(true);
    expect(isGone('docs2')).toBe(false);
    expect(isGone('keep.md')).toBe(false);
  });
  it('removes nothing when the host reports every entry failed (null delete mode)', async () => {
    const bridge = fakeBridge((m) => ({ command: 'deleteWorkspaceEntriesResult', requestId: m.requestId, mode: 'trash', deleted: [], failed: [{ path: 'keep.md', reason: 'failed' }] }));
    const result = setup(bridge, null);
    const outcome = await result.current.deleteEntries(['keep.md']);
    expect(bridge.posted[0]).toMatchObject({ command: 'deleteWorkspaceEntries' });
    expect(outcome.removedFsPaths.size).toBe(0);
    expect(closeContentTab).not.toHaveBeenCalled();
    expect(discardDocumentChanges).not.toHaveBeenCalled();
  });
  it('countUnsaved counts dirty documents under the given paths only', () => {
    appState.state.documentSessions = {
      [docA.fsPath.toLowerCase()]: session(docA, true),
      [docB.fsPath.toLowerCase()]: session(docB, false),
      [other.fsPath.toLowerCase()]: session(other, true),
    };
    const result = setup(fakeBridge(() => ({})));
    expect(result.current.countUnsaved(['docs'])).toBe(1);
    expect(result.current.countUnsaved(['docs/sub'])).toBe(0);
    expect(result.current.countUnsaved(['docs', 'keep.md'])).toBe(2);
    expect(result.current.countUnsaved([])).toBe(0);
  });
  it('countUnsaved matches session paths regardless of case or separators and tolerates no sessions', () => {
    appState.state.documentSessions = { x: { ...session(docA, true), filePath: docA.fsPath.replace(/\\/g, '/').toUpperCase() } };
    const result = setup(fakeBridge(() => ({})));
    expect(result.current.countUnsaved(['docs/a.md'])).toBe(1);
    appState.state.documentSessions = undefined;
    const empty = setup(fakeBridge(() => ({})));
    expect(empty.current.countUnsaved(['docs'])).toBe(0);
  });
});
