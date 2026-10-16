import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import { documentSessionKey } from '../../../../ui/src/editor/documentSession';

const navigate = vi.fn();
const setDocumentEditMode = vi.fn();
const fileA = { fsPath: 'C:\\ws\\docs\\a.md', relativePath: 'docs\\a.md', parts: ['docs', 'a.md'], fileName: 'a.md', title: 'a', extension: '.md', modifiedAt: 0 };
const notes = { fsPath: 'C:\\ws\\notes.md', relativePath: 'notes.md', parts: ['notes.md'], fileName: 'notes.md', title: 'notes', extension: '.md', modifiedAt: 0 };
const appState: any = {
  state: {
    fileList: [fileA], hostPlatform: 'windows', documentSessions: {},
    tree: { name: 'root', path: '', modifiedAt: 0, files: [], children: [{ name: 'docs', path: 'docs', modifiedAt: 0, files: [fileA], children: [] }] },
  },
  navigate, setDocumentEditMode,
};
vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({ useAppState: () => appState }));
const { useSidebarEntryCreation } = await import('../../../../ui/src/components/Sidebar/useSidebarEntryCreation');

function fakeBridge() {
  const listeners = new Set<(m: any) => void>();
  const posted: any[] = [];
  return {
    posted,
    postMessage: (m: any) => { posted.push(m); },
    onMessage: (l: (m: any) => void) => { listeners.add(l); return () => listeners.delete(l); },
    emit: (m: any) => { for (const l of [...listeners]) l(m); },
  };
}

const t = getTranslations('en');
let bridge: ReturnType<typeof fakeBridge>;
beforeEach(() => {
  bridge = fakeBridge();
  navigate.mockClear();
  setDocumentEditMode.mockClear();
  appState.state.fileList = [fileA];
  appState.state.documentSessions = {};
});
const setup = () => renderHook((props: { workspaceKey: string }) => useSidebarEntryCreation({ bridge, t, workspaceKey: props.workspaceKey }), { initialProps: { workspaceKey: 'ws' } });
const ok = (path: string, kind: 'file' | 'folder' = 'file') => ({ command: 'createWorkspaceEntryResult', requestId: bridge.posted[0].requestId, ok: true, path, kind });

async function startCommit(result: ReturnType<typeof setup>['result'], kind: 'file' | 'folder', value: string, parent?: string) {
  act(() => result.current.start(kind, parent));
  act(() => result.current.setValue(value));
  let pending!: Promise<void>;
  act(() => { pending = result.current.commit(); });
  return pending;
}

describe('useSidebarEntryCreation', () => {
  it('targets the root by default, the focused folder, or the parent of a focused file', () => {
    const { result } = setup();
    act(() => result.current.start('file'));
    expect(result.current.draft).toMatchObject({ kind: 'file', parentPath: '', value: '.md' });
    act(() => result.current.rememberFocus('folder', 'docs'));
    act(() => result.current.start('folder'));
    expect(result.current.draft).toMatchObject({ kind: 'folder', parentPath: 'docs', value: '' });
    act(() => result.current.rememberFocus('file', fileA.fsPath));
    act(() => result.current.start('file'));
    expect(result.current.draft?.parentPath).toBe('docs');
    act(() => result.current.clearFocus());
    act(() => result.current.start('file'));
    expect(result.current.draft?.parentPath).toBe('');
  });
  it('validates locally before posting (trim, .md default, case-insensitive duplicate)', async () => {
    const { result } = setup();
    act(() => result.current.start('file', 'docs'));
    act(() => result.current.setValue('  A  '));
    await act(() => result.current.commit());
    expect(result.current.draft?.error).toBe('A.md already exists in this folder.');
    expect(bridge.posted).toHaveLength(0);
  });
  it('posts, closes the input and opens the created markdown file in inline-edit', async () => {
    const { result, rerender } = setup();
    act(() => result.current.start('file'));
    act(() => result.current.setValue('notes'));
    let pending!: Promise<void>;
    act(() => { pending = result.current.commit(); });
    expect(bridge.posted[0]).toMatchObject({ command: 'createWorkspaceEntry', parentPath: '', name: 'notes.md', kind: 'file' });
    appState.state.fileList = [fileA, notes];
    rerender({ workspaceKey: 'ws' });
    await act(async () => {
      bridge.emit({ command: 'createWorkspaceEntryResult', requestId: bridge.posted[0].requestId, ok: true, path: 'notes.md', kind: 'file' });
      await pending;
    });
    expect(result.current.draft).toBeNull();
    expect(navigate).toHaveBeenCalledWith(notes.fsPath);
    expect(setDocumentEditMode).toHaveBeenCalledWith(notes.fsPath, 'inline-edit');
  });
  it('waits for the created file to appear in the file list when the reply arrives first', async () => {
    const { result, rerender } = setup();
    const pending = startCommit(result, 'file', 'notes');
    await act(async () => { bridge.emit(ok('notes.md')); await pending; });
    expect(result.current.draft).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    appState.state.fileList = [fileA, notes];
    rerender({ workspaceKey: 'ws' });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(notes.fsPath);
    expect(setDocumentEditMode).toHaveBeenCalledWith(notes.fsPath, 'inline-edit');
    appState.state.fileList = [fileA, notes, { ...fileA, fsPath: 'C:\\ws\\z.md', relativePath: 'z.md' }];
    rerender({ workspaceKey: 'ws' });
    expect(navigate).toHaveBeenCalledTimes(1);
  });
  it('re-applies inline-edit once the document session exists, only for the created file', async () => {
    const { result, rerender } = setup();
    appState.state.fileList = [fileA, notes];
    const pending = startCommit(result, 'file', 'notes');
    await act(async () => { bridge.emit(ok('notes.md')); await pending; });
    setDocumentEditMode.mockClear();
    appState.state.documentSessions = { [documentSessionKey(notes.fsPath)]: { filePath: notes.fsPath, mode: 'rendered' } };
    rerender({ workspaceKey: 'ws' });
    expect(setDocumentEditMode).toHaveBeenCalledWith(notes.fsPath, 'inline-edit');
    setDocumentEditMode.mockClear();
    appState.state.documentSessions = { ...appState.state.documentSessions };
    rerender({ workspaceKey: 'ws' });
    expect(setDocumentEditMode).not.toHaveBeenCalled();
  });
  it('does not switch non-markdown files into inline-edit', async () => {
    const { result } = setup();
    const txt = { ...notes, fsPath: 'C:\\ws\\todo.txt', relativePath: 'todo.txt', fileName: 'todo.txt', extension: '.txt' };
    appState.state.fileList = [fileA, txt];
    const pending = startCommit(result, 'file', 'todo.txt');
    await act(async () => { bridge.emit(ok('todo.txt')); await pending; });
    expect(navigate).toHaveBeenCalledWith(txt.fsPath);
    expect(setDocumentEditMode).not.toHaveBeenCalled();
  });
  it('never opens an unlisted file type, even if it is listed later', async () => {
    const { result, rerender } = setup();
    const txt = { ...notes, fsPath: 'C:\\ws\\todo.txt', relativePath: 'todo.txt', fileName: 'todo.txt', extension: '.txt' };
    const pending = startCommit(result, 'file', 'todo.txt');
    await act(async () => { bridge.emit(ok('todo.txt')); await pending; });
    expect(result.current.draft).toBeNull();
    appState.state.fileList = [fileA, txt];
    rerender({ workspaceKey: 'ws' });
    expect(navigate).not.toHaveBeenCalled();
    expect(setDocumentEditMode).not.toHaveBeenCalled();
  });
  it('start() drops a pending open of a file that never showed up', async () => {
    const { result, rerender } = setup();
    const pending = startCommit(result, 'file', 'notes');
    await act(async () => { bridge.emit(ok('notes.md')); await pending; });
    act(() => result.current.start('folder'));
    act(() => result.current.cancel());
    appState.state.fileList = [fileA, notes];
    rerender({ workspaceKey: 'ws' });
    expect(navigate).not.toHaveBeenCalled();
  });
  it('cancel() drops a pending open too', async () => {
    const { result, rerender } = setup();
    const pending = startCommit(result, 'file', 'notes');
    await act(async () => { bridge.emit(ok('notes.md')); await pending; });
    act(() => result.current.cancel());
    appState.state.fileList = [fileA, notes];
    rerender({ workspaceKey: 'ws' });
    expect(navigate).not.toHaveBeenCalled();
  });
  it('refuses to create from the untouched .md prefill or an empty name', async () => {
    const { result } = setup();
    act(() => result.current.start('file'));
    await act(() => result.current.commit());
    expect(result.current.draft?.error).toBe('A file or folder name must be provided.');
    expect(result.current.draft?.busy).toBe(false);
    act(() => result.current.setValue('   '));
    await act(() => result.current.commit());
    expect(result.current.draft?.error).toBe('A file or folder name must be provided.');
    act(() => result.current.start('folder'));
    await act(() => result.current.commit());
    expect(result.current.draft?.error).toBe('A file or folder name must be provided.');
    expect(bridge.posted).toHaveLength(0);
  });
  it('keeps the input open with the mapped host failure', async () => {
    const { result } = setup();
    act(() => result.current.start('folder'));
    act(() => result.current.setValue('locked'));
    let pending!: Promise<void>;
    act(() => { pending = result.current.commit(); });
    await act(async () => {
      bridge.emit({ command: 'createWorkspaceEntryResult', requestId: bridge.posted[0].requestId, ok: false, reason: 'permission-denied' });
      await pending;
    });
    expect(result.current.draft).toMatchObject({ busy: false, error: 'Permission denied.' });
  });
  it('ignores commit, blur, cancel and start while a request is in flight', async () => {
    const { result } = setup();
    const pending = startCommit(result, 'folder', 'fresh');
    expect(result.current.draft?.busy).toBe(true);
    await act(async () => { await result.current.commit(); });
    act(() => result.current.blur());
    act(() => result.current.cancel());
    act(() => result.current.start('file', 'docs'));
    expect(bridge.posted).toHaveLength(1);
    expect(result.current.draft).toMatchObject({ kind: 'folder', parentPath: '', value: 'fresh', busy: true });
    await act(async () => {
      bridge.emit({ command: 'createWorkspaceEntryResult', requestId: bridge.posted[0].requestId, ok: false, reason: 'exists' });
      await pending;
    });
    expect(result.current.draft).toMatchObject({ busy: false, kind: 'folder' });
    expect(result.current.draft?.error).toBeTruthy();
    act(() => result.current.cancel());
    expect(result.current.draft).toBeNull();
  });
  it('reveals the created folder and clears the reveal path at the next start', async () => {
    const { result } = setup();
    let pending = startCommit(result, 'folder', 'fresh', 'docs');
    await act(async () => { bridge.emit(ok('docs/fresh', 'folder')); await pending; });
    expect(result.current.draft).toBeNull();
    expect(result.current.revealPath).toBe('docs/fresh');
    act(() => result.current.start('folder', 'docs'));
    expect(result.current.revealPath).toBeNull();
    act(() => result.current.setValue('fresh'));
    bridge.posted.length = 0;
    act(() => { pending = result.current.commit(); });
    await act(async () => { bridge.emit(ok('docs/fresh', 'folder')); await pending; });
    expect(result.current.revealPath).toBe('docs/fresh');
  });
  it('reveals the parent folder of a created file', async () => {
    const { result } = setup();
    const pending = startCommit(result, 'file', 'b', 'docs');
    await act(async () => { bridge.emit(ok('docs/b.md')); await pending; });
    expect(result.current.revealPath).toBe('docs');
  });
  it('does not resurrect or act on a draft after the workspace changed mid-request', async () => {
    const { result, rerender } = setup();
    const pending = startCommit(result, 'file', 'notes');
    appState.state.fileList = [fileA, notes];
    rerender({ workspaceKey: 'other' });
    expect(result.current.draft).toBeNull();
    await act(async () => { bridge.emit(ok('notes.md')); await pending; });
    expect(result.current.draft).toBeNull();
    expect(result.current.revealPath).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('does not resurrect a draft with a stale failure after the workspace changed', async () => {
    const { result, rerender } = setup();
    const pending = startCommit(result, 'folder', 'locked');
    rerender({ workspaceKey: 'other' });
    await act(async () => {
      bridge.emit({ command: 'createWorkspaceEntryResult', requestId: bridge.posted[0].requestId, ok: false, reason: 'failed' });
      await pending;
    });
    expect(result.current.draft).toBeNull();
    // the in-flight guard of the old workspace must not block a new draft
    act(() => result.current.start('folder'));
    act(() => result.current.setValue('next'));
    act(() => { void result.current.commit(); });
    expect(bridge.posted).toHaveLength(2);
  });
  it('blur cancels an untouched or invalid draft and commits a valid one', async () => {
    const { result } = setup();
    act(() => result.current.start('file'));
    act(() => result.current.blur());
    expect(result.current.draft).toBeNull();
    act(() => result.current.start('folder'));
    act(() => result.current.setValue('bad:name'));
    act(() => result.current.blur());
    expect(result.current.draft).toBeNull();
    act(() => result.current.start('folder'));
    act(() => result.current.setValue('fresh'));
    act(() => result.current.blur());
    expect(bridge.posted.at(-1)).toMatchObject({ command: 'createWorkspaceEntry', name: 'fresh' });
    // settle the request so no timeout timer dangles
    await act(async () => { bridge.emit({ command: 'createWorkspaceEntryResult', requestId: bridge.posted.at(-1).requestId, ok: true, path: 'fresh', kind: 'folder' }); });
    expect(result.current.draft).toBeNull();
  });
  it('hints when the extension will not be listed', () => {
    const { result } = setup();
    act(() => result.current.start('file'));
    act(() => result.current.setValue('todo.txt'));
    expect(result.current.hint).toBe("This file type won't appear in the Files tree");
  });
});
