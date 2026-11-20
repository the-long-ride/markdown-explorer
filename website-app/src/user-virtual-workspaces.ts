import { BrowserScanner } from './scanner';
import { BrowserRecentWorkspaces } from './recent-workspaces';
import { renderMarkdown } from './markdown-renderer';
import type { MdFile, FolderNode, RecentWorkspace } from '../../ui/src/types';
import { DemoEntryStore, type DemoEntry } from './demo-entry-store';

export const USER_VIRTUAL_WORKSPACES_STORAGE_KEY = 'markdown-explorer.user-virtual-workspaces.v1';
export const VIRTUAL_WORKSPACE_ENTRIES_PREFIX = 'markdown-explorer.virtual-ws-entries.v1.';
export const VIRTUAL_WORKSPACE_CONTENT_PREFIX = 'markdown-explorer.virtual-ws-content.v1.';

export interface UserVirtualWorkspaceMeta {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_WELCOME_CONTENT = `# Welcome to your Virtual Workspace

You can create, edit, and organize Markdown documents directly in your browser.

- **Create files & folders**: Use the sidebar action buttons to add new files and folders.
- **Instant editing**: Click on any document to view or edit it.
- **Saved locally**: Your files and edits are stored right in your browser's local storage.

## Open Local Files & Folders

- **Workspace Selection**: Click the **Close Workspace** button in the top-left bar (next to the navigation arrows) to open the Workspace Selection page and open a local folder or file.
- **Drag & Drop Anywhere**: Drag and drop any \`.md\` file, supported document, or local folder right into anywhere in this app to open it immediately.

## Enable Local Folder Support (Chromium Browsers)

To open or drop local folders directly in Chrome, Edge, or Brave, enable the File System Access API flag:

1. Open a new browser tab and visit \`chrome://flags\` (or \`brave://flags\` / \`edge://flags\`).
2. Search for **File System Access API**.
3. Set it to **Enabled** and relaunch your browser.
`;

const fallbackStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function getStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  return typeof localStorage !== 'undefined' ? localStorage : fallbackStorage;
}

export function isVirtualWorkspacePath(targetPath: string | null | undefined): boolean {
  return typeof targetPath === 'string' && targetPath.startsWith('virtual://');
}

export function parseVirtualWorkspaceId(pathOrId: string): string {
  return pathOrId.startsWith('virtual://') ? pathOrId.slice('virtual://'.length) : pathOrId;
}

export function listUserVirtualWorkspaces(): UserVirtualWorkspaceMeta[] {
  try {
    const raw = getStorage().getItem(USER_VIRTUAL_WORKSPACES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is UserVirtualWorkspaceMeta =>
        Boolean(item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string'),
    );
  } catch {
    return [];
  }
}

function saveUserVirtualWorkspaces(list: UserVirtualWorkspaceMeta[]): void {
  try {
    getStorage().setItem(USER_VIRTUAL_WORKSPACES_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

const storeCache = new Map<string, DemoEntryStore>();

export function getVirtualWorkspaceEntryStore(pathOrId: string): DemoEntryStore {
  const id = parseVirtualWorkspaceId(pathOrId);
  let store = storeCache.get(id);
  if (!store) {
    const entryStorageKey = VIRTUAL_WORKSPACE_ENTRIES_PREFIX + id;
    const starterSeeds: readonly DemoEntry[] = [{ path: 'Welcome.md', kind: 'file' }];
    store = new DemoEntryStore(starterSeeds, getStorage(), entryStorageKey);
    storeCache.set(id, store);
  }
  return store;
}

function loadContentMap(pathOrId: string): Record<string, string> {
  const id = parseVirtualWorkspaceId(pathOrId);
  try {
    const raw = getStorage().getItem(VIRTUAL_WORKSPACE_CONTENT_PREFIX + id);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveContentMap(pathOrId: string, map: Record<string, string>): void {
  const id = parseVirtualWorkspaceId(pathOrId);
  try {
    getStorage().setItem(VIRTUAL_WORKSPACE_CONTENT_PREFIX + id, JSON.stringify(map));
  } catch {}
}

export function getVirtualWorkspaceFileContent(pathOrId: string, relativePath: string): string | null {
  const contents = loadContentMap(pathOrId);
  return typeof contents[relativePath] === 'string' ? contents[relativePath] : null;
}

export function setVirtualWorkspaceFileContent(pathOrId: string, relativePath: string, content: string): void {
  const contents = loadContentMap(pathOrId);
  contents[relativePath] = content;
  saveContentMap(pathOrId, contents);
}

export function renameVirtualWorkspaceContent(pathOrId: string, oldPath: string, newPath: string): void {
  const contents = loadContentMap(pathOrId);
  const updated: Record<string, string> = {};
  for (const [key, value] of Object.entries(contents)) {
    if (key === oldPath) {
      updated[newPath] = value;
    } else if (key.startsWith(`${oldPath}/`)) {
      updated[`${newPath}${key.slice(oldPath.length)}`] = value;
    } else {
      updated[key] = value;
    }
  }
  saveContentMap(pathOrId, updated);
}

export function deleteVirtualWorkspaceContent(pathOrId: string, deletedPaths: readonly string[]): void {
  const contents = loadContentMap(pathOrId);
  for (const del of deletedPaths) {
    for (const key of Object.keys(contents)) {
      if (key === del || key.startsWith(`${del}/`)) {
        delete contents[key];
      }
    }
  }
  saveContentMap(pathOrId, contents);
}

function extractTitle(raw: string, isMdx: boolean): string | null {
  if (isMdx) {
    const fmMatch = /^---\n([\s\S]*?)\n---/.exec(raw);
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const sep = line.indexOf(':');
        if (sep > 0 && line.slice(0, sep).trim() === 'title') {
          return line.slice(sep + 1).trim().replace(/^['"]|['"]$/g, '');
        }
      }
    }
  }
  const match = /^#+\s+(.+)$/m.exec(raw);
  return match?.[1]?.trim() ?? null;
}

export function buildVirtualMdFile(relativePath: string, raw: string, modifiedAt = Date.now()): MdFile {
  const parts = relativePath.split('/');
  const fileName = parts[parts.length - 1] || relativePath;
  const dot = fileName.lastIndexOf('.');
  const ext = dot !== -1 ? fileName.slice(dot).toLowerCase() : '';
  const isMdx = ext === '.mdx';
  const title = extractTitle(raw, isMdx) || (dot !== -1 ? fileName.slice(0, dot) : fileName) || fileName;
  return {
    fsPath: relativePath,
    relativePath,
    parts,
    fileName,
    title,
    extension: ext,
    documentKind: 'markdown',
    modifiedAt,
  };
}

export function createUserVirtualWorkspace(name?: string): UserVirtualWorkspaceMeta {
  const existing = listUserVirtualWorkspaces();
  const trimmed = typeof name === 'string' ? name.trim() : '';
  let finalName = trimmed;
  if (!finalName) {
    let n = 1;
    const names = new Set(existing.map((ws) => ws.name));
    while (names.has(`Virtual Workspace ${n}`)) {
      n += 1;
    }
    finalName = `Virtual Workspace ${n}`;
  }
  const id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const meta: UserVirtualWorkspaceMeta = {
    id,
    name: finalName,
    path: `virtual://${id}`,
    createdAt: now,
    updatedAt: now,
  };
  setVirtualWorkspaceFileContent(id, 'Welcome.md', DEFAULT_WELCOME_CONTENT);
  getVirtualWorkspaceEntryStore(id);

  existing.push(meta);
  saveUserVirtualWorkspaces(existing);
  return meta;
}

export function createVirtualWorkspaceFromDroppedFiles(
  files: readonly { readonly name: string; readonly content: string }[],
  name?: string,
): UserVirtualWorkspaceMeta {
  const suggestedName = name || (files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : undefined);
  const meta = createUserVirtualWorkspace(suggestedName);
  const store = getVirtualWorkspaceEntryStore(meta.id);
  const hasWelcome = files.some((f) => f.name.toLowerCase() === 'welcome.md');
  if (!hasWelcome) {
    store.delete('Welcome.md');
    deleteVirtualWorkspaceContent(meta.id, ['Welcome.md']);
  }
  for (const file of files) {
    if (!store.entries.some((e) => e.path === file.name)) store.create('', file.name, 'file');
    setVirtualWorkspaceFileContent(meta.id, file.name, file.content);
  }
  return meta;
}

export function removeUserVirtualWorkspace(pathOrId: string): boolean {
  const id = parseVirtualWorkspaceId(pathOrId);
  const existing = listUserVirtualWorkspaces();
  const index = existing.findIndex((w) => w.id === id || w.path === pathOrId);
  if (index === -1) return false;

  existing.splice(index, 1);
  saveUserVirtualWorkspaces(existing);

  storeCache.delete(id);
  const storage = getStorage();
  try {
    storage.removeItem(VIRTUAL_WORKSPACE_ENTRIES_PREFIX + id);
    storage.removeItem(VIRTUAL_WORKSPACE_CONTENT_PREFIX + id);
  } catch {}
  return true;
}

export function getVirtualWorkspaceSnapshot(pathOrId: string): {
  workspacePath: string;
  workspaceName: string;
  tree: FolderNode;
  files: MdFile[];
} {
  const id = parseVirtualWorkspaceId(pathOrId);
  const existing = listUserVirtualWorkspaces();
  const meta = existing.find((w) => w.id === id || w.path === pathOrId);
  const workspaceName = meta?.name || id;
  const workspacePath = meta?.path || `virtual://${id}`;

  const store = getVirtualWorkspaceEntryStore(id);
  const fileEntries = store.entries.filter((e) => e.kind === 'file');
  const folderPaths = store.entries.filter((e) => e.kind === 'folder').map((e) => e.path);

  const files: MdFile[] = fileEntries.map((e) => {
    const raw = getVirtualWorkspaceFileContent(id, e.path) ?? '';
    return buildVirtualMdFile(e.path, raw);
  }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const tree: FolderNode = {
    ...BrowserScanner.buildTree(files, folderPaths),
    name: workspaceName,
  };

  return { workspacePath, workspaceName, tree, files };
}

export async function loadAllRecentWorkspaces(): Promise<RecentWorkspace[]> {
  const recents = await BrowserRecentWorkspaces.load();
  const virtuals = listUserVirtualWorkspaces();
  const virtualRecents: RecentWorkspace[] = virtuals.map((ws) => ({
    name: ws.name,
    path: ws.path,
    lastOpened: ws.updatedAt || ws.createdAt,
  }));
  const seen = new Set<string>();
  const merged: RecentWorkspace[] = [];
  for (const item of [...virtualRecents, ...recents]) {
    if (!seen.has(item.path)) {
      seen.add(item.path);
      merged.push(item);
    }
  }
  return merged;
}

export function renderVirtualFile({
  workspacePath,
  relativePath,
  fileList,
  findFileInfo,
  operationMetadata,
}: {
  workspacePath: string;
  relativePath: string;
  fileList: MdFile[];
  findFileInfo: (list: MdFile[], rel: string) => { relativePath: string; title: string };
  operationMetadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const raw = getVirtualWorkspaceFileContent(workspacePath, relativePath);
  if (raw === null) {
    return {
      command: 'renderContent',
      html: `<p>File not found: <code>${relativePath}</code></p>`,
      markdownSource: '',
      frontmatter: {},
      toc: [],
      filePath: relativePath,
      relativePath,
      title: relativePath,
      fileList,
      previewInfo: null,
      ...operationMetadata,
    };
  }

  const { html, frontmatter, toc } = renderMarkdown(relativePath, raw);
  const fileInfo = findFileInfo(fileList, relativePath);

  return {
    command: 'renderContent',
    html,
    markdownSource: raw,
    sourceDocumentText: /\.html?$/i.test(relativePath) ? raw : null,
    frontmatter,
    toc,
    filePath: relativePath,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList,
    previewInfo: null,
    documentWrite: /\.mdx?$/i.test(relativePath)
      ? { supported: true, revision: String(raw.length) }
      : undefined,
    ...operationMetadata,
  };
}

export async function loadVirtualWorkspaceHandler({
  workspacePath,
  openFirstFile = true,
  targetFile,
  state,
  send,
  hostInfo,
  findFileInfo,
  getWorkspaceOperationMetadata,
  resetFileState,
  isCurrentGeneration,
}: {
  workspacePath: string;
  openFirstFile?: boolean;
  targetFile?: string;
  state: {
    activeWorkspacePath: string;
    activeWorkspaceName: string;
    flatList: MdFile[];
    workspaceTree: FolderNode | null;
    activeHandle: unknown;
    singleFileHandle: unknown;
    currentFile: string | null;
    documentConversionEnabled?: boolean;
  };
  send: (msg: unknown) => void;
  hostInfo: () => Record<string, unknown>;
  findFileInfo: (list: MdFile[], rel: string) => { relativePath: string; title: string };
  getWorkspaceOperationMetadata: () => Record<string, unknown>;
  resetFileState: () => void;
  isCurrentGeneration: () => boolean;
}): Promise<boolean> {
  const operation = getWorkspaceOperationMetadata();
  resetFileState();
  const snapshot = getVirtualWorkspaceSnapshot(workspacePath);
  state.activeWorkspacePath = snapshot.workspacePath;
  state.activeWorkspaceName = snapshot.workspaceName;
  state.flatList = snapshot.files;
  state.workspaceTree = snapshot.tree;
  state.activeHandle = null;
  state.singleFileHandle = null;
  send({ command: 'setLoading', label: 'Loading workspace…', ...operation });
  const recents = await loadAllRecentWorkspaces();
  if (!isCurrentGeneration()) return false;
  send({
    command: 'readyAck', fileList: state.flatList, tree: state.workspaceTree, theme: 'dark', themeStyle: 'default',
    defaultExpanded: true, workspaceName: state.activeWorkspaceName, workspacePath: state.activeWorkspacePath,
    recentWorkspaces: recents, documentConversionEnabled: Boolean(state.documentConversionEnabled), ...hostInfo(), ...operation,
  });
  if (targetFile) {
    state.currentFile = targetFile;
    send(renderVirtualFile({ workspacePath, relativePath: targetFile, fileList: state.flatList, findFileInfo, operationMetadata: operation }));
  } else if (openFirstFile && state.flatList.length > 0) {
    state.currentFile = state.flatList[0].relativePath;
    send(renderVirtualFile({ workspacePath, relativePath: state.currentFile, fileList: state.flatList, findFileInfo, operationMetadata: operation }));
  } else {
    send({ command: 'renderContent', html: '', markdownSource: '', frontmatter: {}, toc: [], filePath: '', relativePath: 'Welcome Page', title: 'Welcome', fileList: state.flatList, previewInfo: null, ...operation });
  }
  return true;
}
