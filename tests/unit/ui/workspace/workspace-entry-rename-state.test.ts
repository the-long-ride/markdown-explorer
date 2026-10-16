import { expect, it } from 'vitest';
import { createInitialState, reducer } from '../../../../ui/src/contexts/appStateReducer';
import { documentSessionKey } from '../../../../ui/src/editor/documentSession';
import { getWorkspaceScopeKey } from '../../../../ui/src/contexts/contentTabState';
it('migrates renamed folder descendants without losing unsaved buffers or inactive workspace settings', () => {
  const state = createInitialState(undefined, true);
  const old='/ws/docs/a.md', next='/ws/notes/a.md';
  state.workspacePath='/ws';state.workspaceName='ws';state.currentFile=old;state.relativePath='docs/a.md';state.activeContentTabPath=old;
  state.fileList=[{fsPath:old,relativePath:'docs/a.md',parts:['docs','a.md'],fileName:'a.md',title:'A'}];
  state.contentTabs=[{filePath:old,relativePath:'docs/a.md',fileName:'a.md',title:'A',contentHtml:'draft',markdownSource:'draft',frontmatter:{},toc:[],previewInfo:null}];
  state.documentSessions={[documentSessionKey(old)]:{filePath:old,source:'unsaved',persistedSource:'disk',lineEnding:'\n',revision:'r',mode:'inline-edit',saveState:'idle',pendingSaveSource:null,conflict:null}};
  const key=getWorkspaceScopeKey('/ws','ws');
  state.settings.sidebarPinnedItems={[key]:[{kind:'folder',path:'docs'},{kind:'file',path:old}],other:[{kind:'file',path:'/other/a.md'}]};
  const result=reducer(state,{type:'RENAME_WORKSPACE_ENTRY',workspaceKey:key,oldPath:'docs',newPath:'notes'} as any);
  expect(result.currentFile).toBe(next);expect(result.contentTabs[0].filePath).toBe(next);expect(result.fileList[0].relativePath).toBe('notes/a.md');
  expect(result.documentSessions[documentSessionKey(next)].source).toBe('unsaved');expect(result.documentSessions[documentSessionKey(old)]).toBeUndefined();
  expect(result.settings.sidebarPinnedItems[key]).toEqual([{kind:'folder',path:'notes'},{kind:'file',path:next}]);
  expect(result.settings.sidebarPinnedItems.other).toEqual(state.settings.sidebarPinnedItems.other);
  expect(reducer(state,{type:'RENAME_WORKSPACE_ENTRY',workspaceKey:'different',oldPath:'docs',newPath:'notes'} as any)).toBe(state);
});

it('migrates normalized Windows session keys and case-only filename changes', () => {
  const state=createInitialState(undefined,true);const old='C:\\WS\\Readme.md';state.workspacePath='C:\\WS';state.workspaceName='WS';state.currentFile=old;
  state.fileList=[{fsPath:old,relativePath:'Readme.md',parts:['Readme.md'],fileName:'Readme.md',title:'Readme'}];
  state.documentSessions={[documentSessionKey(old)]:{filePath:old,source:'unsaved',persistedSource:'disk',lineEnding:'\n',revision:'r',mode:'plain',saveState:'idle',pendingSaveSource:null,conflict:null}};
  const next=reducer(state,{type:'RENAME_WORKSPACE_ENTRY',workspaceKey:'C:\\WS',oldPath:'Readme.md',newPath:'README.md'});
  expect(next.documentSessions[documentSessionKey('C:\\WS\\README.md')].filePath).toBe('C:\\WS\\README.md');
  expect(next.documentSessions[documentSessionKey('C:\\WS\\README.md')].source).toBe('unsaved');
});
it('moves Windows normalized session keys when the filename changes', () => {
  const state=createInitialState(undefined,true);const old='C:\\WS\\Readme.md';state.workspacePath='C:\\WS';state.workspaceName='WS';state.currentFile=old;
  state.fileList=[{fsPath:old,relativePath:'Readme.md',parts:['Readme.md'],fileName:'Readme.md',title:'Readme'}];
  state.documentSessions={[documentSessionKey(old)]:{filePath:old,source:'unsaved',persistedSource:'disk',lineEnding:'\n',revision:'r',mode:'plain',saveState:'idle',pendingSaveSource:null,conflict:null}};
  const next=reducer(state,{type:'RENAME_WORKSPACE_ENTRY',workspaceKey:'C:\\WS',oldPath:'Readme.md',newPath:'Guide.md'});
  expect(next.documentSessions[documentSessionKey('C:\\WS\\Guide.md')]?.source).toBe('unsaved');
});
it('migrates retained dirty sessions and original-workspace pins while another workspace is active',()=>{
  const state=createInitialState(undefined,true);state.workspacePath='/other';state.workspaceName='other';state.currentFile='/other/docs/a.md';state.relativePath='docs/a.md';
  state.fileList=[{fsPath:'/other/docs/a.md',relativePath:'docs/a.md',parts:['docs','a.md'],fileName:'a.md',title:'other'}];
  state.documentSessions={'/ws/docs/a.md':{filePath:'/ws/docs/a.md',source:'dirty A',persistedSource:'disk',lineEnding:'\n',revision:'r',mode:'plain',saveState:'idle',pendingSaveSource:null,conflict:null}};
  state.settings.sidebarPinnedItems={'/ws':[{kind:'folder',path:'docs'}],'/other':[{kind:'folder',path:'docs'}]};
  const next=reducer(state,{type:'RENAME_WORKSPACE_ENTRY',workspaceKey:'/ws',oldPath:'docs',newPath:'notes',oldAbsolutePath:'/ws/docs',newAbsolutePath:'/ws/notes'} as any);
  expect(next.documentSessions['/ws/notes/a.md']?.source).toBe('dirty A');expect(next.currentFile).toBe(state.currentFile);expect(next.fileList).toBe(state.fileList);expect(next.relativePath).toBe('docs/a.md');
  expect(next.settings.sidebarPinnedItems?.['/ws']).toEqual([{kind:'folder',path:'notes'}]);expect(next.settings.sidebarPinnedItems?.['/other']).toEqual(state.settings.sidebarPinnedItems['/other']);
});
