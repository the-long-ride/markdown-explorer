import { describe, expect, it, vi } from 'vitest';
import { createUserVirtualWorkspace, getVirtualWorkspaceSnapshot, setVirtualWorkspaceFileContent } from '../../../website-app/src/user-virtual-workspaces';
import { buildMdFileFromName } from '../../../website-app/src/web-file-content';
import { handleWebFileUtilityMessage } from '../../../website-app/src/web-file-utility-router';
import { BrowserSearchIndex } from '../../../website-app/src/search-index';
import { asFileHandle, memoryFile, MemoryFolder } from './memory-file-system';

function router(overrides: Partial<Parameters<typeof handleWebFileUtilityMessage>[1]> = {}) {
  const send = vi.fn();
  const deps = {
    getSearchIndex: () => null,
    getSingleFileHandle: () => null,
    getFlatList: () => [],
    getActiveWorkspacePath: () => '',
    getWorkspaceTree: () => null,
    getActiveHandle: () => null,
    refreshWorkspace: vi.fn(async () => {}),
    onRename: vi.fn(),
    send,
    ...overrides,
  };
  return {
    send, deps,
    async dispatch(command: string, payload: Record<string, unknown> = {}) {
      send.mockClear();
      const handled = await handleWebFileUtilityMessage({ command, requestId: 'req', ...payload }, deps);
      expect(handled).toBe(true);
      return send.mock.lastCall?.[0];
    },
  };
}

describe('file utility router', () => {
  it('does not emit outdated folder search batches or completion errors', async () => {
    const item = buildMdFileFromName('guide.md');
    const index = new BrowserSearchIndex(new MemoryFolder('root').asHandle());
    const generation = { value: 0 };
    const search = vi.spyOn(index, 'searchIncremental');
    const { dispatch, send } = router({ getSearchIndex: () => index, getFlatList: () => [item], searchGeneration: generation });
    search.mockImplementationOnce(async (_query, _items, options) => {
      generation.value += 1;
      expect(options?.shouldCancel?.()).toBe(true);
      options?.onBatch?.([]);
      return { total: 0, truncated: false, cancelled: true };
    }).mockImplementationOnce(async () => {
      generation.value += 1;
      throw new Error('Superseded');
    });
    expect(await dispatch('searchWorkspace', { query: 'guide' })).toBeUndefined();
    expect(await dispatch('searchWorkspace', { query: 'guide' })).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('creates, renames, edits, searches, and deletes entries in virtual workspaces', async () => {
    const { path } = createUserVirtualWorkspace('Scratch');
    const { dispatch, send, deps } = router({
      getActiveWorkspacePath: () => path,
      getFlatList: () => getVirtualWorkspaceSnapshot(path).files,
      searchGeneration: { value: 0 },
    });
    const create = (name: string, kind = 'file') => dispatch('createWorkspaceEntry', { parentPath: '', name, kind });
    expect(await create('folder', 'folder')).toMatchObject({ ok: true, path: 'folder' });
    expect(await create('note.md')).toMatchObject({ ok: true, path: 'note.md' });
    expect(await create('note.md')).toMatchObject({ ok: false });
    expect(await dispatch('saveDocument', { filePath: 'note.md', source: 'a NeEdLe in the workspace' })).toMatchObject({ ok: true });
    expect(await dispatch('renameWorkspaceEntry', { path: 'note.md', name: 'renamed.md', kind: 'file' })).toMatchObject({ ok: true, path: 'renamed.md' });
    expect(deps.onRename).toHaveBeenCalledWith('note.md', 'renamed.md', null);
    expect(await dispatch('renameWorkspaceEntry', { path: 'note.md', name: 'other.md', kind: 'file' })).toMatchObject({ ok: false });

    const item = deps.getFlatList().find((file) => file.relativePath === 'renamed.md')!;
    expect(await dispatch('searchWorkspace', { query: ' needle ' })).toMatchObject({ done: true, total: 1 });
    expect(send.mock.calls[0][0]).toMatchObject({ done: false, results: [{ relativePath: 'renamed.md' }] });
    expect(await dispatch('searchWorkspace', { query: 'needle', matchCase: true })).toMatchObject({ done: true, total: 0 });
    expect(await dispatch('loadSearchPreview', { filePath: item.fsPath })).toMatchObject({ ok: true, markdownSource: expect.stringContaining('NeEdLe') });
    expect(await dispatch('loadSearchPreview', { filePath: 'unknown' })).toMatchObject({ ok: false, reason: 'outside-workspace' });

    setVirtualWorkspaceFileContent(path, 'style.css', 'body { color: black }');
    expect(await dispatch('readWorkspaceTextResource', { documentPath: 'folder/page.html', resourcePath: '.././style.css?v=3' })).toMatchObject({
      ok: true, resolvedPath: 'style.css', content: 'body { color: black }',
    });
    for (const resourcePath of ['https://example.test/site.css', '../style.css', '/x.png', '', 'missing.css']) {
      expect(await dispatch('readWorkspaceTextResource', { documentPath: 'page.html', resourcePath })).toMatchObject({ ok: false, reason: 'missing' });
    }

    expect(await dispatch('deleteWorkspaceEntries', { paths: ['renamed.md', 'missing.md'] })).toMatchObject({
      deleted: ['renamed.md'], failed: [{ path: 'missing.md' }],
    });
    expect(await dispatch('deleteWorkspaceEntries', {})).toMatchObject({ deleted: [], failed: [] });
    expect(await dispatch('scanInsightsWorkspace')).toMatchObject({ command: 'insightsScanComplete' });
    expect(await dispatch('readInsightsDocumentSource', { relativePath: 'Welcome.md' })).toMatchObject({ status: 'ok' });
  });

  it('handles incomplete messages from a virtual workspace', async () => {
    const { path } = createUserVirtualWorkspace('Scratch');
    const { dispatch } = router({
      getActiveWorkspacePath: () => path,
      getFlatList: () => getVirtualWorkspaceSnapshot(path).files,
    });
    expect(await dispatch('saveDocument')).toMatchObject({ ok: true, revision: '0' });
    expect(await dispatch('searchWorkspace')).toMatchObject({ done: true, total: 0 });
    expect(await dispatch('loadSearchPreview')).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(await dispatch('readWorkspaceTextResource', { resourcePath: 'app.css' })).toMatchObject({ ok: false, reason: 'missing' });
  });

  it('searches and previews a single file with case-sensitive and Unicode matching', async () => {
    const source = 'café CAFÉ';
    const file = memoryFile('Notes.md', source);
    const item = buildMdFileFromName(file.name);
    const { dispatch } = router({
      getSingleFileHandle: () => asFileHandle(file),
      getFlatList: () => [item],
    });
    expect(await dispatch('searchWorkspace', { query: 'CAFE\u0301' })).toMatchObject({ total: 2, done: true });
    expect(await dispatch('searchWorkspace', { query: 'CAFÉ', matchCase: true })).toMatchObject({ total: 1, results: [{ matchIndex: 5 }] });
    expect(await dispatch('searchWorkspace', { query: 'Notes', matchCase: true })).toMatchObject({ total: 1, results: [{ matchLength: 0 }] });
    expect(await dispatch('searchWorkspace', { query: 'different' })).toMatchObject({ total: 0 });
    expect(await dispatch('loadSearchPreview', { filePath: item.fsPath })).toMatchObject({ ok: true, markdownSource: source });
    expect(await dispatch('loadSearchPreview', {})).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(await dispatch('saveDocument', { filePath: 'Notes.md', source: '# Saved', force: true })).toMatchObject({ ok: true });
    expect(await dispatch('saveDocument', { filePath: 'outside.md' })).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(await dispatch('readWorkspaceTextResource', { resourcePath: 'style.css' })).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(await dispatch('scanInsightsWorkspace')).toMatchObject({ command: 'insightsScanComplete', totalEntries: 1 });
    expect(await dispatch('readInsightsDocumentSource', { relativePath: 'folder/Notes.md' })).toMatchObject({ status: 'ok', source: '# Saved' });
    expect(await dispatch('readInsightsDocumentSource', { relativePath: 'missing.md' })).toMatchObject({ status: 'missing' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(file, 'getFile').mockRejectedValue(new Error('not readable'));
    expect(await dispatch('searchWorkspace', { query: 'any' })).toMatchObject({ total: 0, done: true });
    expect(await dispatch('loadSearchPreview', { filePath: item.fsPath })).toMatchObject({ ok: false, reason: 'missing' });
    expect(await dispatch('scanInsightsWorkspace')).toMatchObject({ totalEntries: 1 });
    expect(await dispatch('readInsightsDocumentSource', { relativePath: 'Notes.md' })).toMatchObject({ status: 'missing' });
  });

  it('uses the folder index, scopes tabs and reads only allowed local resources', async () => {
    const folder = new MemoryFolder('docs');
    const file = memoryFile('note.md', 'hello from notes');
    folder.children.set(file.name, file);
    folder.children.set('app.css', memoryFile('app.css', 'body {}'));
    const handle = folder.asHandle();
    const item = buildMdFileFromName('note.md');
    const index = new BrowserSearchIndex(handle);
    const { dispatch, send } = router({
      getSearchIndex: () => index,
      getFlatList: () => [item],
      getActiveHandle: () => handle,
      getActiveWorkspacePath: () => 'docs',
      searchGeneration: { value: 0 },
    });
    await dispatch('indexWorkspaceSearchItems', { items: [item] });
    await dispatch('indexWorkspaceSearchItems');
    expect(await dispatch('searchWorkspace', { query: 'hello' })).toMatchObject({ total: 1, done: true });
    expect(send.mock.calls[0][0]).toMatchObject({ done: false, results: [{ relativePath: item.relativePath }] });
    expect(await dispatch('loadSearchPreview', { filePath: item.fsPath })).toMatchObject({ ok: true, markdownSource: 'hello from notes' });
    expect(await dispatch('loadWorkspaceSearchIndexes', { tabs: [
      null, {}, { tabId: 'missing-path' }, { tabId: 'other', workspacePath: 'other' }, { tabId: 'active', workspacePath: 'docs' },
    ] })).toMatchObject({ tabs: [{ tabId: 'active', workspacePath: 'docs', fileList: [item] }] });
    expect(await dispatch('loadWorkspaceSearchIndexes')).toBeUndefined();
    expect(await dispatch('saveDocument', { filePath: 'note.md', source: 'saved', expectedRevision: '1:16' })).toMatchObject({ ok: true });
    expect(await dispatch('readWorkspaceTextResource', { resourcePath: '/app.css' })).toMatchObject({ ok: true, content: 'body {}' });
    expect(await dispatch('readWorkspaceTextResource', { resourcePath: 'missing.css' })).toMatchObject({ ok: false, reason: 'missing' });
    expect(await dispatch('readWorkspaceTextResource', { resourcePath: '../../app.css' })).toMatchObject({ ok: false, reason: 'outside-workspace' });
    const error = vi.spyOn(index, 'searchIncremental').mockRejectedValueOnce(new Error('index unavailable')).mockRejectedValueOnce('offline');
    expect(await dispatch('searchWorkspace', { query: 'hello' })).toMatchObject({ total: 0, done: true, error: 'index unavailable' });
    expect(await dispatch('searchWorkspace', { query: 'hello' })).toMatchObject({ error: 'offline' });
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('replies without a writable or searchable workspace and checks external URLs', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { dispatch } = router({ getFlatList: () => [buildMdFileFromName('note.md')] });
    expect(await dispatch('saveDocument')).toMatchObject({ ok: false, reason: 'read-only' });
    expect(await dispatch('searchWorkspace')).toMatchObject({ done: true, total: 0 });
    expect(await dispatch('readWorkspaceTextResource')).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(await dispatch('loadSearchPreview', { filePath: 'note.md' })).toMatchObject({ ok: false, reason: 'missing' });
    await dispatch('openExternal', { url: 'HTTPS://example.test/path' });
    await dispatch('openExternal', { url: 'about:blank' });
    await dispatch('openExternal', { url: 1 });
    expect(open).toHaveBeenCalledExactlyOnceWith('HTTPS://example.test/path', '_blank');
  });
});
