import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createPanelWorkspaceEntry, deletePanelWorkspaceEntries, handlePanelWorkspaceEntryMessage, renamePanelWorkspaceEntry } from '../../../vscode/src/core/panelWorkspaceEntries';
const roots:string[]=[];
const temp=()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'vsc-rename-test-'));roots.push(root);return root;};
afterEach(()=>roots.splice(0).forEach(root=>fs.rmSync(root,{recursive:true,force:true})));
it('renames before refreshing and does not overwrite a sibling',async()=>{
  const root=temp();fs.writeFileSync(path.join(root,'a.md'),'A');const post=vi.fn();const order:string[]=[];
  const deps={workspacePath:root,post:(m:any)=>{post(m);order.push(m.command);},refresh:()=>{order.push('refresh');}};
  expect(await handlePanelWorkspaceEntryMessage({command:'renameWorkspaceEntry',requestId:'r',path:'a.md',name:'b.md',kind:'file'},deps)).toBe(true);
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ok:true,path:'b.md'}));expect(order).toEqual(['renameWorkspaceEntryResult','refresh']);
  fs.writeFileSync(path.join(root,'a.md'),'again');
  await handlePanelWorkspaceEntryMessage({command:'renameWorkspaceEntry',requestId:'c',path:'a.md',name:'b.md',kind:'file'},deps);
  expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ok:false,reason:'exists'}));
});
it('passes useTrash false for explicit permanent deletion',async()=>{
  const root=temp();fs.writeFileSync(path.join(root,'a.md'),'A');const remove=vi.fn(async()=>{});const post=vi.fn();
  await handlePanelWorkspaceEntryMessage({command:'deleteWorkspaceEntries',requestId:'d',paths:['a.md'],mode:'permanent'}, {workspacePath:root,post,refresh:vi.fn(),vscodeApi:{Uri:{file:(p:string)=>p},workspace:{fs:{delete:remove}}}});
  expect(remove).toHaveBeenCalledWith(path.join(root,'a.md'),{recursive:true,useTrash:false});expect(post).toHaveBeenCalledWith(expect.objectContaining({mode:'permanent'}));
});

it.each([
  [{ path: 1 }, 'outside-workspace'],
  [{ path: '../note.md' }, 'outside-workspace'],
  [{ path: '' }, 'protected'],
  [{ path: '.git/note.md' }, 'protected'],
  [{ kind: 'link' }, 'invalid-name'],
  [{ name: 1 }, 'invalid-name'],
  [{ name: '../b.md' }, 'invalid-name'],
  [{ name: '.git' }, 'protected'],
  [{ kind: 'folder' }, 'missing'],
])('rejects invalid rename options without altering the current file: %j', async (options, reason) => {
  const root = temp();
  const source = path.join(root, 'a.md');
  fs.writeFileSync(source, 'original');
  expect(await renamePanelWorkspaceEntry({ path: 'a.md', name: 'b.md', kind: 'file', ...options }, { workspacePath: root, post: vi.fn(), refresh: vi.fn() }))
    .toMatchObject({ ok: false, reason });
  expect(fs.readFileSync(source, 'utf8')).toBe('original');
});

it('renames a folder and treats renaming to the same name as a no-op', async () => {
  const root = temp();
  const deps = { workspacePath: root, post: vi.fn(), refresh: vi.fn() };
  fs.mkdirSync(path.join(root, 'notes'));
  fs.writeFileSync(path.join(root, 'notes', 'a.md'), 'notes');
  expect(await renamePanelWorkspaceEntry({ path: 'notes', name: 'notes', kind: 'folder' }, deps))
    .toMatchObject({ ok: true, path: 'notes' });
  expect(await renamePanelWorkspaceEntry({ path: 'notes', name: 'moved', kind: 'folder' }, deps))
    .toEqual({ ok: true, oldPath: 'notes', path: 'moved', kind: 'folder' });
  expect(fs.existsSync(path.join(root, 'notes'))).toBe(false);
  expect(fs.readFileSync(path.join(root, 'moved', 'a.md'), 'utf8')).toBe('notes');
  expect(await renamePanelWorkspaceEntry({ path: 'notes', name: 'moved', kind: 'folder' }, deps))
    .toMatchObject({ ok: false, reason: 'missing' });
});

it('handles case-only renames using a staging directory on a case-insensitive filesystem', async () => {
  const root = temp();
  const canonical = fs.realpathSync(root);
  const lower = path.join(canonical, 'note.md');
  const upper = path.join(canonical, 'Note.md');
  fs.writeFileSync(lower, 'original');
  const lstat = vi.fn((target: string) => fs.promises.lstat(target === upper ? lower : target));
  const rename = vi.fn(fs.promises.rename);
  const args = { path: 'note.md', name: 'Note.md', kind: 'file' };
  const deps = { workspacePath: root, post: vi.fn(), refresh: vi.fn(), fsApi: {
    ...fs, promises: { ...fs.promises, lstat, rename },
  } as typeof fs };
  expect(await renamePanelWorkspaceEntry(args, deps)).toMatchObject({ ok: true, path: 'Note.md' });
  expect(rename).toHaveBeenCalledTimes(2);
  const staged = rename.mock.calls[0][1];
  expect(rename.mock.calls).toEqual([[lower, staged], [staged, upper]]);
  expect(fs.readdirSync(root)).toEqual(['Note.md']);
});

it('copies when hard links are unavailable but rolls back the new file when removal of the old file fails', async () => {
  const root = temp();
  const canonical = fs.realpathSync(root);
  const source = path.join(canonical, 'a.md');
  const target = path.join(canonical, 'b.md');
  fs.writeFileSync(source, 'original');
  const link = vi.fn(async () => { throw Object.assign(new Error('different filesystem'), { code: 'EXDEV' }); });
  const copyFile = vi.fn(fs.promises.copyFile);
  const unlink = vi.fn(async (file: string) => {
    if (file === source) throw Object.assign(new Error('read only'), { name: 'NoPermissions' });
    await fs.promises.unlink(file);
  });
  const fsApi = { ...fs, promises: { ...fs.promises, link, copyFile, unlink } } as typeof fs;
  expect(await renamePanelWorkspaceEntry({ path: 'a.md', name: 'b.md', kind: 'file' }, {
    workspacePath: root, post: vi.fn(), refresh: vi.fn(), fsApi,
  })).toMatchObject({ ok: false, reason: 'permission-denied', error: 'read only' });
  expect(copyFile).toHaveBeenCalledExactlyOnceWith(source, target, fs.constants.COPYFILE_EXCL);
  expect(unlink.mock.calls.flat()).toEqual([source, target]);
  expect(fs.readFileSync(source, 'utf8')).toBe('original');
  expect(fs.existsSync(target)).toBe(false);
});

it('returns typed validation errors without a filesystem write', async () => {
  const root = temp();
  const blocked = new Error('workspace unavailable');
  const deps = { workspacePath: root, post: vi.fn(), refresh: vi.fn() };
  const stat = vi.fn(async () => { throw blocked; });
  const fsApi = { ...fs, promises: { ...fs.promises, stat } } as typeof fs;
  const rename = { path: 'a.md', name: 'b.md', kind: 'file' };
  expect(await renamePanelWorkspaceEntry(rename, { ...deps, workspacePath: null })).toMatchObject({ ok: false, reason: 'unsupported' });
  expect(await renamePanelWorkspaceEntry(rename, { ...deps, fsApi })).toMatchObject({ ok: false, reason: 'failed' });
  fs.writeFileSync(path.join(root, 'a.md'), 'untouched');
  expect(await deletePanelWorkspaceEntries({ paths: ['a.md'] }, deps)).toMatchObject({
    deleted: [], failed: [{ path: 'a.md', reason: 'unsupported' }],
  });
});

it('rejects NTFS streams for creation, rename and deletion on Windows', async () => {
  const root = temp();
  const deps = { workspacePath: root, post: vi.fn(), refresh: vi.fn() };
  vi.stubGlobal('process', Object.create(process, { platform: { value: 'win32' } }));
  expect(await createPanelWorkspaceEntry({ name: 'c.md', kind: 'file', parentPath: 'note:stream' }, deps))
    .toMatchObject({ ok: false, reason: 'invalid-name' });
  expect(await renamePanelWorkspaceEntry({ path: 'note:stream', name: 'b.md', kind: 'file' }, deps))
    .toMatchObject({ ok: false, reason: 'invalid-name' });
  expect(await deletePanelWorkspaceEntries({ paths: ['note:stream'] }, deps))
    .toMatchObject({ deleted: [], failed: [{ path: 'note:stream', reason: 'invalid-name' }] });
});
