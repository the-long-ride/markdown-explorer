import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { handlePanelWorkspaceEntryMessage } from '../../../vscode/src/core/panelWorkspaceEntries';
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
