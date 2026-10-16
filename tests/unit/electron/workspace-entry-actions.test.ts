import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import entries from '../../../electron/workspace/workspace-entries.js';
const roots: string[] = [];
const temp = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-rename-test-')); roots.push(root); return root; };
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));
const rename = (input: any) => (entries as any).renameWorkspaceEntry(input);
describe('workspace rename and deletion modes', () => {
  it('renames a file and folder while preserving bytes and descendants', async () => {
    const root = temp(); fs.mkdirSync(path.join(root, 'docs')); fs.writeFileSync(path.join(root, 'docs/a.md'), 'keep');
    expect(await rename({ workspacePath: root, path: 'docs/a.md', name: 'b.md', kind: 'file' })).toMatchObject({ ok: true, oldPath: 'docs/a.md', path: 'docs/b.md' });
    expect(await rename({ workspacePath: root, path: 'docs', name: 'notes', kind: 'folder' })).toMatchObject({ ok: true, path: 'notes' });
    expect(fs.readFileSync(path.join(root, 'notes/b.md'), 'utf8')).toBe('keep');
  });
  it('rejects collisions, invalid names, protected entries and escapes', async () => {
    const root = temp(); fs.writeFileSync(path.join(root,'a.md'),'A'); fs.writeFileSync(path.join(root,'b.md'),'B');
    for (const [entryPath,name,reason] of [['a.md','b.md','exists'],['a.md','../x','invalid-name'],['.git','notes','protected'],['../a.md','x.md','outside-workspace'],['','notes','protected']]) {
      expect(await rename({ workspacePath: root, path: entryPath, name, kind: 'file' })).toMatchObject({ ok:false, reason });
    }
    expect(fs.readFileSync(path.join(root,'a.md'),'utf8')).toBe('A'); expect(fs.readFileSync(path.join(root,'b.md'),'utf8')).toBe('B');
  });
  it('supports case-only rename and rejects kind mismatch', async () => {
    const root=temp(); fs.writeFileSync(path.join(root,'a.md'),'A');
    expect(await rename({workspacePath:root,path:'a.md',name:'A.md',kind:'file'})).toMatchObject({ok:true,path:'A.md'});
    expect(fs.readdirSync(root)).toContain('A.md');
    expect(await rename({workspacePath:root,path:'A.md',name:'folder',kind:'folder'})).toMatchObject({ok:false});
  });
  it('replies to rename before refresh, allowing identity migration first', async () => {
    const root=temp(); fs.writeFileSync(path.join(root,'a.md'),'A'); const order:string[]=[];
    const handlers=entries.createWorkspaceEntryHandlers({getWorkspacePath:()=>root,sendHostMessage:(m:any)=>order.push(m.command),refresh:async()=>{order.push('refresh');},trashItem:vi.fn()});
    await (handlers as any).handleRenameWorkspaceEntry({requestId:'r',path:'a.md',name:'b.md',kind:'file'});
    expect(order).toEqual(['renameWorkspaceEntryResult','refresh']);
  });
  it('honors permanent deletion without invoking Trash', async () => {
    const root=temp(); fs.writeFileSync(path.join(root,'a.md'),'A'); const trash=vi.fn(); const send=vi.fn();
    const handlers=entries.createWorkspaceEntryHandlers({getWorkspacePath:()=>root,sendHostMessage:send,refresh:vi.fn(),trashItem:trash});
    await handlers.handleDeleteWorkspaceEntries({requestId:'d',paths:['a.md'],mode:'permanent'});
    expect(trash).not.toHaveBeenCalled(); expect(fs.existsSync(path.join(root,'a.md'))).toBe(false);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({mode:'permanent',deleted:['a.md']}));
  });
});
it('does not relocate a different workspace after an asynchronous native rename',async()=>{
  const a=temp(),b=temp();fs.writeFileSync(path.join(a,'a.md'),'A');let current=a;const onRename=vi.fn();
  const handlers=entries.createWorkspaceEntryHandlers({getWorkspacePath:()=>current,onRename,sendHostMessage:vi.fn(),refresh:vi.fn(),trashItem:vi.fn()});
  const pending=(handlers as any).handleRenameWorkspaceEntry({requestId:'stale',path:'a.md',name:'b.md',kind:'file'});current=b;await pending;
  expect(fs.existsSync(path.join(a,'b.md'))).toBe(true);expect(onRename).not.toHaveBeenCalled();
});
it('renames files on a volume without hard-link support',async()=>{
  const root=temp();fs.writeFileSync(path.join(root,'a.md'),'keep');
  const fsApi={...fs,promises:{...fs.promises,link:async()=>{throw Object.assign(new Error('not supported'),{code:'ENOTSUP'});}}};
  expect(await rename({workspacePath:root,path:'a.md',name:'b.md',kind:'file',fsApi})).toMatchObject({ok:true,path:'b.md'});
  expect(fs.readFileSync(path.join(root,'b.md'),'utf8')).toBe('keep');expect(fs.existsSync(path.join(root,'a.md'))).toBe(false);
});
