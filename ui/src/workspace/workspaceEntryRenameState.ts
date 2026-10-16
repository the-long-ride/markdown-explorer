import type { AppState } from '../contexts/appStateModel';
import { getWorkspaceScopeKey } from '../contexts/contentTabState';
import { documentSessionKey } from '../editor/documentSession';
import type { FolderNode, MdFile } from '../types';

import { replaceEntryPrefix } from './workspaceEntryPaths.ts';
export { replaceEntryPrefix } from './workspaceEntryPaths.ts';

export function renameWorkspaceEntryState(state: AppState, workspaceKey: string, oldPath: string, newPath: string, capturedOld?: string, capturedNew?: string): AppState {
  const active = getWorkspaceScopeKey(state.workspacePath, state.workspaceName) === workspaceKey;
  if (!active && (!capturedOld || !capturedNew)) return state;
  const sample = state.fileList.find(file => file.relativePath.replace(/\\/g, '/') === oldPath || file.relativePath.replace(/\\/g, '/').startsWith(`${oldPath}/`));
  const base = sample ? sample.fsPath.replace(/\\/g, '/').slice(0, -sample.relativePath.replace(/\\/g, '/').length).replace(/\/$/, '') : (state.workspacePath ?? '').replace(/\\/g, '/').replace(/\/$/, '');
  const oldAbsolute = capturedOld ?? (base ? `${base}/${oldPath}` : oldPath);
  const newAbsolute = capturedNew ?? (base ? `${base}/${newPath}` : newPath);
  const absolute = (value: string) => replaceEntryPrefix(value, oldAbsolute, newAbsolute);
  const relative = (value: string) => replaceEntryPrefix(value, oldPath, newPath);
  const nullable = (value: string | null) => value === null ? null : absolute(value);
  const file = (item: MdFile): MdFile => {
    const relativePath = relative(item.relativePath);
    return { ...item, fsPath: absolute(item.fsPath), relativePath, parts: relativePath.split('/'), fileName: relativePath.split('/').pop()! };
  };
  const tree = (node: FolderNode): FolderNode => ({ ...node, path: relative(node.path), name: relative(node.path).split('/').pop() || node.name, files: node.files.map(file), children: node.children.map(tree) });
  const remapKeys = <T,>(record: Record<string, T>, transform: (value: T) => T) => Object.fromEntries(Object.entries(record).map(([key, value]) => [replaceEntryPrefix(documentSessionKey(key), documentSessionKey(oldAbsolute), documentSessionKey(newAbsolute)), transform(value)]));
  const mapScope = (record: Record<string, string[]> | undefined) => record?.[workspaceKey] ? { ...record, [workspaceKey]: record[workspaceKey].map(absolute) } : record;
  const pins = state.settings.sidebarPinnedItems;
  const pane = (value: AppState['splitView']['primary']) => ({ ...value, filePath: nullable(value.filePath), activeTabPath: nullable(value.activeTabPath), tabs: value.tabs.map(absolute) });
  return {
    ...state,
    fileList: active ? state.fileList.map(file) : state.fileList, tree: active && state.tree ? tree(state.tree) : state.tree,
    currentFile: nullable(state.currentFile), relativePath: active ? relative(state.relativePath) : state.relativePath, activeContentTabPath: nullable(state.activeContentTabPath),
    staleContentFilePath: nullable(state.staleContentFilePath),
    contentTabs: state.contentTabs.map(tab => absolute(tab.filePath) === tab.filePath ? tab : ({ ...tab, filePath: absolute(tab.filePath), relativePath: relative(tab.relativePath), fileName: relative(tab.relativePath).split('/').pop()! })),
    documentSessions: remapKeys(state.documentSessions, session => ({ ...session, filePath: absolute(session.filePath) })),
    documentRenderRevisions: remapKeys(state.documentRenderRevisions, value => value),
    splitView: { ...state.splitView, primary: pane(state.splitView.primary), secondary: pane(state.splitView.secondary) },
    settings: { ...state.settings,
      sidebarPinnedItems: pins?.[workspaceKey] ? { ...pins, [workspaceKey]: pins[workspaceKey].map(pin => ({ ...pin, path: pin.kind === 'file' ? absolute(pin.path) : relative(pin.path) })) } : pins,
      scopeFocus: mapScope(state.settings.scopeFocus), searchScopeFocus: mapScope(state.settings.searchScopeFocus),
    },
  };
}
