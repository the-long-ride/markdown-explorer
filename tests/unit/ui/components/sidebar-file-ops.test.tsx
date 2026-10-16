import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../../../ui/src/components/Sidebar/Sidebar';
import { getTranslations } from '../../../../ui/src/contexts/translations';

const t = getTranslations('en');
const WS = 'C:\\ws';
const file = (relativePath: string) => ({
  fsPath: `${WS}\\${relativePath.replace(/\//g, '\\')}`, relativePath: relativePath.replace(/\//g, '\\'),
  parts: relativePath.split('/'), fileName: relativePath.split('/').pop()!, title: relativePath, extension: '.md', modifiedAt: 0,
});
const docA = file('docs/a.md');
const readme = file('Readme.md');
const tree = {
  name: 'ws', path: WS, files: [readme],
  children: [{ name: 'docs', path: 'docs', files: [docA], children: [{ name: 'empty', path: 'docs/empty', files: [], children: [] }] }],
};
const emptyOnlyTree = { name: 'ws', path: WS, files: [], children: [{ name: 'void', path: 'void', files: [], children: [] }] };

const spies = {
  navigate: vi.fn(), updateSettings: vi.fn(), closeContentTab: vi.fn(), discardDocumentChanges: vi.fn(), setDocumentEditMode: vi.fn(), dispatch: vi.fn(),
};
let mockState: any;
const posted: any[] = [];
const listeners = new Set<(message: any) => void>();
const bridge = {
  postMessage: (message: unknown) => { posted.push(message); },
  onMessage: (listener: (message: any) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
const emit = (message: unknown) => act(() => { for (const listener of [...listeners]) listener(message); });

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({ usePlatform: () => bridge }));
vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({ useAppState: () => ({ state: mockState, ...spies }) }));
vi.mock('../../../../ui/src/contexts/RepositorySnapshotContext', () => ({
  useRepositorySnapshot: () => ({
    state: { activePath: null }, repositoryView: { mode: 'live' }, revisionWorkspace: null, openSnapshotFile: vi.fn(), searchRevision: vi.fn(),
  }),
}));
vi.mock('../../../../ui/src/components/Sidebar/SidebarSearch', () => ({ SidebarSearch: () => <div data-testid="sidebar-search" /> }));

function makeState(patch: Record<string, unknown> = {}, settings: Record<string, unknown> = {}) {
  return {
    sidebarActiveTab: 'files', sidebarCollapsed: false, workspacePath: WS, workspaceName: 'ws',
    settings: { language: 'en', scopeFocus: {}, keybindings: {}, defaultHtmlPreview: true, historySidebarEnabled: false, showTitle: false, ...settings },
    currentFile: null, contentTabs: [], appRuntime: 'desktop', hostPlatform: 'win32',
    fileList: [docA, readme], tree, documentSessions: {}, ...patch,
  };
}

const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const treeEl = () => document.getElementById('sidebarTree') as HTMLElement;
const row = (name: string) => screen.getByText(name).closest('.tree-folder__header, .tree-file') as HTMLElement;
const childrenOf = (name: string) => row(name).parentElement!.querySelector(':scope > .tree-folder__children') as HTMLElement | null;
const textbox = (label: string) => screen.queryByRole('textbox', { name: label }) as HTMLInputElement | null;
const notices: any[] = [];
const onNotice = (event: Event) => notices.push((event as CustomEvent).detail);

beforeEach(() => {
  mockState = makeState();
  posted.length = 0;
  notices.length = 0;
  Object.values(spies).forEach((spy) => spy.mockClear());
  window.addEventListener('markdown-explorer-action-notice', onNotice);
});
afterEach(() => {
  cleanup();
  window.removeEventListener('markdown-explorer-action-notice', onNotice);
  delete (window as any).__webDemoBus;
  window.history.pushState({}, '', '/');
});

describe('Sidebar file operations', () => {
  it('renders create and select buttons before the sort group, and hides them without a workspace', () => {
    render(<Sidebar />);
    const sort = btn(t.sidebar.sortFiles);
    for (const name of [t.sidebar.newFile, t.sidebar.newFolder, t.sidebar.selectMode]) {
      expect(btn(name).compareDocumentPosition(sort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    cleanup();
    mockState = makeState({ workspacePath: '' });
    render(<Sidebar />);
    expect(screen.queryByRole('button', { name: t.sidebar.newFile })).toBeNull();
    expect(screen.queryByRole('button', { name: t.sidebar.newFolder })).toBeNull();
    expect(screen.queryByRole('button', { name: t.sidebar.selectMode })).toBeNull();
  });

  it('enables simulated entry controls in demo mode and real entry controls in file mode', () => {
    (window as any).__webDemoBus = new EventTarget();
    mockState = makeState({ appRuntime: 'chrome' });
    render(<Sidebar />);
    expect(btn(t.sidebar.newFile)).toBeTruthy();
    expect(btn(t.sidebar.newFolder)).toBeTruthy();
    expect(btn(t.sidebar.selectMode)).toBeTruthy();
    cleanup();
    window.history.pushState({}, '', '/?mode=file');
    render(<Sidebar />);
    expect(btn(t.sidebar.newFile)).toBeTruthy();
  });

  it('creates a file at the root through the inline input', () => {
    render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.newFile));
    const input = textbox('New file name')!;
    expect(input.value).toBe('.md');
    expect(input.closest('#sidebarTree')).toBe(treeEl());
    expect(treeEl().querySelector(':scope > .sidebar-entry-input')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(posted[0]).toMatchObject({ command: 'createWorkspaceEntry', parentPath: '', name: 'x.md', kind: 'file' });
  });

  it('creates inside the focused folder, or at the root after clicking empty tree space', () => {
    render(<Sidebar />);
    fireEvent.click(row('docs'));
    fireEvent.click(btn(t.sidebar.newFolder));
    const input = textbox('New folder name')!;
    expect(input.closest('.tree-folder__children')).toBe(childrenOf('docs'));
    fireEvent.click(treeEl());
    fireEvent.click(btn(t.sidebar.newFolder));
    expect(textbox('New folder name')!.closest('#sidebarTree > .sidebar-entry-input')).toBeTruthy();
    expect(textbox('New folder name')!.closest('.tree-folder__children')).toBeNull();
  });

  it('creates inside a folder from its context menu', () => {
    render(<Sidebar />);
    fireEvent.contextMenu(row('docs'));
    fireEvent.click(screen.getByRole('menuitem', { name: t.sidebar.newFileMenu }));
    expect(textbox('New file name')!.closest('.tree-folder__children')).toBe(childrenOf('docs'));
  });

  it('drops the creation draft when collapse-all hides the folder hosting the input', () => {
    render(<Sidebar />);
    fireEvent.click(row('docs'));
    fireEvent.click(btn(t.sidebar.newFile));
    expect(textbox('New file name')).toBeTruthy();
    fireEvent.click(btn(t.sidebar.collapseAllFolders));
    expect(textbox('New file name')).toBeNull();
    fireEvent.click(btn(t.sidebar.expandAllFolders));
    expect(textbox('New file name')).toBeNull();
  });

  it('drops the creation draft when the user collapses the folder hosting the input', () => {
    render(<Sidebar />);
    fireEvent.click(row('docs'));
    fireEvent.click(btn(t.sidebar.newFile));
    expect(textbox('New file name')).toBeTruthy();
    fireEvent.click(row('docs'));
    expect(row('docs').getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(row('docs'));
    expect(row('docs').getAttribute('aria-expanded')).toBe('true');
    expect(textbox('New file name')).toBeNull();
  });

  it('keeps the draft when an unrelated folder is collapsed', () => {
    render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.newFile));
    fireEvent.click(row('docs'));
    expect(textbox('New file name')).toBeTruthy();
  });

  it('enters selection mode, selects rows without navigating, leaves on scope toggle and Escape', () => {
    render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.selectMode));
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: t.sidebar.clearPinnedItems })).toBeNull();
    fireEvent.click(row('a.md'));
    expect(spies.navigate).not.toHaveBeenCalled();
    expect((screen.getByRole('checkbox', { name: 'Select a.md' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.sidebar.scopeFocus) }));
    expect(document.querySelector('.sidebar-entry-checkbox')).toBeNull();
    expect(btn(t.sidebar.clearPinnedItems)).toBeTruthy();
    fireEvent.click(btn(t.sidebar.selectMode));
    expect(document.querySelector('.sidebar-entry-checkbox')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.sidebar-entry-checkbox')).toBeNull();
    expect(btn(t.sidebar.clearPinnedItems)).toBeTruthy();
  });

  it('deletes selected entries and closes tabs of removed files', async () => {
    render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.selectMode));
    fireEvent.click(row('docs'));
    fireEvent.click(row('a.md'));
    fireEvent.click(btn('Delete selected (1)'));
    fireEvent.click(btn(t.sidebar.deleteTrashConfirm));
    expect(posted[0]).toMatchObject({ command: 'deleteWorkspaceEntries', paths: ['docs'] });
    emit({ command: 'deleteWorkspaceEntriesResult', requestId: posted[0].requestId, mode: 'trash', deleted: ['docs'], failed: [] });
    await waitFor(() => expect(spies.closeContentTab).toHaveBeenCalledWith(docA.fsPath));
    await waitFor(() => expect(document.querySelector('.sidebar-entry-checkbox')).toBeNull());
    expect(notices).toEqual([]);
  });

  it('reports failed deletions as an error notice', async () => {
    render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.selectMode));
    fireEvent.click(row('docs'));
    fireEvent.click(btn('Delete selected (1)'));
    fireEvent.click(btn(t.sidebar.deleteTrashConfirm));
    emit({ command: 'deleteWorkspaceEntriesResult', requestId: posted[0].requestId, mode: 'trash', deleted: [], failed: [{ path: 'docs', reason: 'permission-denied' }] });
    await waitFor(() => expect(notices).toEqual([{ message: 'Could not delete: docs', tone: 'error' }]));
    expect(spies.closeContentTab).not.toHaveBeenCalled();
    // Nothing was deleted: the selection stays so the user can retry.
    await waitFor(() => expect((btn('Delete selected (1)') as HTMLButtonElement).disabled).toBe(false));
    expect(document.querySelector('.sidebar-entry-checkbox')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'Select docs' }) as HTMLInputElement).checked).toBe(true);
  });

  it('sends one delete request when the confirmation fires twice and disables the actions while it runs', async () => {
    render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.selectMode));
    fireEvent.click(row('docs'));
    fireEvent.click(btn('Delete selected (1)'));
    const confirm = btn(t.sidebar.deleteTrashConfirm);
    act(() => { confirm.click(); confirm.click(); });
    expect(posted.filter((message) => message.command === 'deleteWorkspaceEntries')).toHaveLength(1);
    expect((btn('Delete selected (1)') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('toolbar', { name: t.sidebar.selectMode }).getAttribute('aria-busy')).toBe('true');
    emit({ command: 'deleteWorkspaceEntriesResult', requestId: posted[0].requestId, mode: 'trash', deleted: [], failed: [{ path: 'docs', reason: 'failed' }] });
    await waitFor(() => expect((btn('Delete selected (1)') as HTMLButtonElement).disabled).toBe(false));
    expect(notices).toHaveLength(1);
    expect(screen.getByRole('toolbar', { name: t.sidebar.selectMode }).getAttribute('aria-busy')).toBeNull();
  });

  it('exits selection on partial success even when some entries failed', async () => {
    render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.selectMode));
    fireEvent.click(row('docs'));
    fireEvent.click(row('Readme.md'));
    fireEvent.click(btn('Delete selected (2)'));
    fireEvent.click(btn(t.sidebar.deleteTrashConfirm));
    emit({ command: 'deleteWorkspaceEntriesResult', requestId: posted[0].requestId, mode: 'trash', deleted: ['Readme.md'], failed: [{ path: 'docs', reason: 'failed' }] });
    await waitFor(() => expect(document.querySelector('.sidebar-entry-checkbox')).toBeNull());
    expect(notices).toEqual([{ message: 'Could not delete: docs', tone: 'error' }]);
  });

  it('keeps a newer selection when selection mode is left and re-entered during a delete', async () => {
    mockState = makeState({}, { sidebarPinnedItems: { [WS]: [{ kind: 'folder', path: 'docs' }] } });
    render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.selectMode));
    fireEvent.click(row('docs'));
    fireEvent.click(btn('Delete selected (1)'));
    fireEvent.click(btn(t.sidebar.deleteTrashConfirm));
    fireEvent.click(btn(t.sidebar.exitSelectMode));
    fireEvent.click(btn(t.sidebar.selectMode));
    fireEvent.click(row('Readme.md'));
    spies.updateSettings.mockClear();
    emit({ command: 'deleteWorkspaceEntriesResult', requestId: posted[0].requestId, mode: 'trash', deleted: ['docs'], failed: [] });
    await waitFor(() => expect(spies.closeContentTab).toHaveBeenCalledWith(docA.fsPath));
    await waitFor(() => expect(screen.getByRole('toolbar', { name: t.sidebar.selectMode }).getAttribute('aria-busy')).toBeNull());
    // The pins of the deleted entries are still removed, but the new selection survives.
    expect(spies.updateSettings).toHaveBeenCalledWith({ sidebarPinnedItems: {} });
    expect(document.querySelector('.sidebar-entry-checkbox')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'Select Readme.md' }) as HTMLInputElement).checked).toBe(true);
    expect(btn('Delete selected (1)')).toBeTruthy();
  });

  it('does not touch the new workspace when the workspace changes during a delete', async () => {
    const other = 'C:\\other';
    mockState = makeState({}, { sidebarPinnedItems: { [WS]: [{ kind: 'folder', path: 'docs' }], [other]: [{ kind: 'folder', path: 'docs' }] } });
    const { rerender } = render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.selectMode));
    fireEvent.click(row('docs'));
    fireEvent.click(btn('Delete selected (1)'));
    fireEvent.click(btn(t.sidebar.deleteTrashConfirm));
    mockState = makeState({ workspacePath: other, workspaceName: 'other' }, { sidebarPinnedItems: { [WS]: [{ kind: 'folder', path: 'docs' }], [other]: [{ kind: 'folder', path: 'docs' }] } });
    rerender(<Sidebar />);
    spies.updateSettings.mockClear();
    emit({ command: 'deleteWorkspaceEntriesResult', requestId: posted[0].requestId, mode: 'trash', deleted: ['docs'], failed: [] });
    await waitFor(() => expect(spies.closeContentTab).toHaveBeenCalledWith(docA.fsPath));
    await act(async () => { await Promise.resolve(); });
    expect(spies.updateSettings).not.toHaveBeenCalled();
  });

  it('closes an item context menu on Escape without leaving selection mode', () => {
    render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.selectMode));
    fireEvent.contextMenu(row('docs'));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.querySelector('.sidebar-entry-checkbox')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.sidebar-entry-checkbox')).toBeNull();
  });

  it('unpins selected pinned entries after confirmation', () => {
    mockState = makeState({}, { sidebarPinnedItems: { [WS]: [{ kind: 'folder', path: 'docs' }, { kind: 'file', path: readme.fsPath }] } });
    render(<Sidebar />);
    fireEvent.click(btn(t.sidebar.selectMode));
    fireEvent.click(row('docs'));
    fireEvent.click(btn('Unpin selected (1)'));
    fireEvent.click(document.querySelector('.sidebar-confirm-dialog__confirm')!);
    expect(spies.updateSettings).toHaveBeenCalledWith({ sidebarPinnedItems: { [WS]: [{ kind: 'file', path: readme.fsPath }] } });
  });

  it('shows empty-only folders instead of the empty state', () => {
    mockState = makeState({ fileList: [], tree: emptyOnlyTree });
    render(<Sidebar />);
    expect(screen.getByText('void')).toBeTruthy();
    expect(screen.queryByText(t.sidebar.noFiles)).toBeNull();
    cleanup();
    mockState = makeState({ fileList: [], tree: { ...emptyOnlyTree, children: [] } });
    render(<Sidebar />);
    expect(screen.getByText(t.sidebar.noFiles)).toBeTruthy();
  });
});

it('focuses clicked rows, renames with F2, and opens mode-aware deletion with Delete', async () => {
  render(<Sidebar />);
  fireEvent.click(row('Readme.md'));
  expect(row('Readme.md').classList.contains('is-entry-focused')).toBe(true);
  fireEvent.keyDown(row('Readme.md'), { key: 'F2' });
  const input=screen.getByRole('textbox',{name:'Rename file'}) as HTMLInputElement;
  expect(input.value).toBe('Readme.md');expect(input.selectionStart).toBe(0);expect(input.selectionEnd).toBe(6);
  fireEvent.change(input,{target:{value:'Guide.md'}});fireEvent.keyDown(input,{key:'Enter'});
  const rename=posted.find(m=>m.command==='renameWorkspaceEntry');expect(rename).toMatchObject({path:'Readme.md',name:'Guide.md',kind:'file'});
  emit({command:'renameWorkspaceEntryResult',requestId:rename.requestId,ok:true,path:'Guide.md',oldPath:'Readme.md',kind:'file'});
  await waitFor(()=>expect(spies.dispatch).toHaveBeenCalledWith(expect.objectContaining({type:'RENAME_WORKSPACE_ENTRY',oldPath:'Readme.md',newPath:'Guide.md'})));
  fireEvent.click(row('Readme.md'));fireEvent.keyDown(row('Readme.md'),{key:'Delete'});
  const permanent=screen.getByRole('checkbox',{name:'Permanently Delete'});fireEvent.click(permanent);
  fireEvent.click(screen.getByRole('button',{name:'Delete permanently'}));
  await waitFor(()=>expect(posted).toContainEqual(expect.objectContaining({command:'deleteWorkspaceEntries',mode:'permanent',paths:['Readme.md']})));
  const deletion=posted.find(m=>m.command==='deleteWorkspaceEntries');emit({command:'deleteWorkspaceEntriesResult',requestId:deletion.requestId,mode:'permanent',deleted:['Readme.md'],failed:[]});
});
it('provides per-entry menu actions, cancels rename, and ignores Delete inside an input',()=>{
  render(<Sidebar />);fireEvent.contextMenu(row('Readme.md'));
  expect(screen.getByRole('menuitem',{name:/Delete file/})).toBeTruthy();
  fireEvent.click(screen.getByRole('menuitem',{name:/Rename file/}));
  const input=screen.getByRole('textbox',{name:'Rename file'});
  fireEvent.keyDown(input,{key:'Delete'});expect(screen.queryByRole('alertdialog')).toBeNull();
  fireEvent.keyDown(input,{key:'Escape'});expect(screen.queryByRole('textbox',{name:'Rename file'})).toBeNull();
  expect(posted.some(m=>m.command==='renameWorkspaceEntry')).toBe(false);
});
it('keeps a pending delete tied to the entries selected when its dialog opened',async()=>{
  render(<Sidebar />);fireEvent.click(btn(t.sidebar.selectMode));fireEvent.click(row('Readme.md'));fireEvent.click(btn('Delete selected (1)'));
  fireEvent.click(row('docs'));fireEvent.click(btn(t.sidebar.deleteTrashConfirm));
  await waitFor(()=>expect(posted).toContainEqual(expect.objectContaining({command:'deleteWorkspaceEntries',paths:['Readme.md']})));
  const request=posted.find(m=>m.command==='deleteWorkspaceEntries');emit({command:'deleteWorkspaceEntriesResult',requestId:request.requestId,mode:'trash',deleted:['Readme.md'],failed:[]});
});
it('ignores a late rename result after changing the active workspace',async()=>{
  const {rerender}=render(<Sidebar />);fireEvent.click(row('Readme.md'));fireEvent.keyDown(row('Readme.md'),{key:'F2'});
  fireEvent.change(screen.getByRole('textbox',{name:'Rename file'}),{target:{value:'Guide.md'}});fireEvent.keyDown(screen.getByRole('textbox',{name:'Rename file'}),{key:'Enter'});
  const request=posted.find(m=>m.command==='renameWorkspaceEntry');mockState=makeState({workspacePath:'C:\\other',workspaceName:'other'});rerender(<Sidebar />);spies.dispatch.mockClear();
  emit({command:'renameWorkspaceEntryResult',requestId:request.requestId,ok:true,path:'Guide.md',oldPath:'Readme.md',kind:'file'});
  await act(async()=>{await Promise.resolve();});expect(spies.dispatch).toHaveBeenCalledWith(expect.objectContaining({type:'RENAME_WORKSPACE_ENTRY',workspaceKey:WS,oldAbsolutePath:'C:/ws/Readme.md',newAbsolutePath:'C:/ws/Guide.md'}));
});
it('still migrates a successful pending rename after switching sidebar tabs',async()=>{
  const {rerender}=render(<Sidebar />);fireEvent.click(row('Readme.md'));fireEvent.keyDown(row('Readme.md'),{key:'F2'});
  fireEvent.change(screen.getByRole('textbox',{name:'Rename file'}),{target:{value:'Guide.md'}});fireEvent.keyDown(screen.getByRole('textbox',{name:'Rename file'}),{key:'Enter'});
  const request=posted.find(m=>m.command==='renameWorkspaceEntry');mockState=makeState({sidebarActiveTab:'search'});rerender(<Sidebar />);spies.dispatch.mockClear();
  emit({command:'renameWorkspaceEntryResult',requestId:request.requestId,ok:true,path:'Guide.md',oldPath:'Readme.md',kind:'file'});
  await waitFor(()=>expect(spies.dispatch).toHaveBeenCalledWith(expect.objectContaining({type:'RENAME_WORKSPACE_ENTRY',newPath:'Guide.md'})));
});
it('restores row keyboard focus after cancelling rename',async()=>{
  render(<Sidebar />);fireEvent.click(row('Readme.md'));fireEvent.keyDown(row('Readme.md'),{key:'F2'});
  fireEvent.keyDown(screen.getByRole('textbox',{name:'Rename file'}),{key:'Escape'});
  await waitFor(()=>expect(document.activeElement).toBe(row('Readme.md')));
});
it('restores folder focus and keeps keyboard actions after unchanged-name Enter',async()=>{
  render(<Sidebar />);fireEvent.click(row('docs'));fireEvent.keyDown(row('docs'),{key:'F2'});
  fireEvent.keyDown(screen.getByRole('textbox',{name:'Rename folder'}),{key:'Escape'});
  await waitFor(()=>expect(document.activeElement).toBe(row('docs')));
  fireEvent.keyDown(row('docs'),{key:'F2'});fireEvent.keyDown(screen.getByRole('textbox',{name:'Rename folder'}),{key:'Enter'});
  await waitFor(()=>expect(document.activeElement).toBe(row('docs')));
  fireEvent.keyDown(row('docs'),{key:'Delete'});expect(screen.getByRole('alertdialog')).toBeTruthy();
  expect(posted.some(m=>m.command==='renameWorkspaceEntry')).toBe(false);
});
