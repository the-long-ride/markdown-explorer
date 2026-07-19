import { renderMarkdown } from '../../chromium-xtension/src/markdown-renderer';
import { BrowserScanner } from '../../chromium-xtension/src/scanner';
import { BrowserSearchIndex } from '../../chromium-xtension/src/search-index';
import { BrowserRecentWorkspaces } from '../../chromium-xtension/src/recent-workspaces';
import { rewriteMediaUrls } from '../../chromium-xtension/src/media-resolver';
import { readTextFile } from '../../chromium-xtension/src/file-access';
import type { MdFile, FolderNode } from '../../ui/src/types';

interface FileModeState {
  activeHandle: FileSystemDirectoryHandle | null;
  activeWorkspacePath: string;
  activeWorkspaceName: string;
  currentFile: string | null;
  flatList: MdFile[];
  workspaceTree: FolderNode | null;
  searchIndex: BrowserSearchIndex | null;
  singleFileHandle: FileSystemFileHandle | null;
}

interface FileModeDeps {
  state: FileModeState;
  send: (message: unknown) => void;
  sendLoading: (label: string, detail?: string) => void;
  hostInfo: () => Record<string, unknown>;
  findFileInfo: (list: MdFile[], relativePath: string) => { relativePath: string; title: string };
  extractWorkspaceName: (path: string) => string;
}

export function createFileModeHandlers({
  state,
  send,
  sendLoading,
  hostInfo,
  findFileInfo,
  extractWorkspaceName,
}: FileModeDeps) {
function resetFileState() {
  state.activeHandle = null;
  state.activeWorkspacePath = '';
  state.activeWorkspaceName = '';
  state.currentFile = null;
  state.flatList = [];
  state.workspaceTree = null;
  state.searchIndex = null;
  state.singleFileHandle = null;
}

async function loadHandleWorkspace(handle: FileSystemDirectoryHandle, openFirstFile = true) {
  state.activeHandle = handle;
  state.activeWorkspaceName = handle.name;
  state.activeWorkspacePath = handle.name;
  state.currentFile = null;

  sendLoading('Loading workspace…');
  await BrowserRecentWorkspaces.save(state.activeWorkspaceName, state.activeWorkspacePath, handle);

  let revealed = false;
  send({ command: 'workspaceScanProgress', scannedFiles: 0, active: true });
  const scanPromise = BrowserScanner.scan(handle, {
    onProgress(scannedFiles) {
      send({ command: 'workspaceScanProgress', scannedFiles, active: true });
    },
  });
  const revealTimer = window.setTimeout(async () => {
    if (state.activeHandle !== handle) return;
    revealed = true;
    send({
      command: 'readyAck', fileList: [], tree: null, theme: 'dark', themeStyle: 'default',
      defaultExpanded: true, workspaceName: state.activeWorkspaceName,
      workspacePath: state.activeWorkspacePath,
      recentWorkspaces: await BrowserRecentWorkspaces.load(), documentConversionEnabled: false,
      ...hostInfo(),
    });
  }, 2500);
  const { tree, flat } = await scanPromise;
  window.clearTimeout(revealTimer);
  if (state.activeHandle !== handle) return;
  state.flatList = flat;
  state.workspaceTree = tree;
  state.searchIndex = new BrowserSearchIndex(handle);
  state.searchIndex.prime(flat);

  const recents = await BrowserRecentWorkspaces.load();
  send(revealed ? {
    command: 'workspaceFilesChanged', fileList: flat, tree,
    workspaceName: state.activeWorkspaceName, workspacePath: state.activeWorkspacePath,
    documentConversionEnabled: false,
  } : {
    command: 'readyAck',
    fileList: flat,
    tree,
    theme: 'dark',
    themeStyle: 'default',
    defaultExpanded: true,
    workspaceName: state.activeWorkspaceName,
    workspacePath: state.activeWorkspacePath,
    recentWorkspaces: recents,
    documentConversionEnabled: false,
    ...hostInfo(),
  });
  send({ command: 'workspaceScanProgress', scannedFiles: flat.length, active: false });

  if (openFirstFile && flat.length > 0) {
    state.currentFile = flat[0].relativePath;
    await sendFileContent(state.currentFile);
  } else {
    send({
      command: 'renderContent',
      html: '',
      markdownSource: '',
      frontmatter: {},
      toc: [],
      filePath: '',
      relativePath: 'Welcome Page',
      title: 'Welcome',
      fileList: state.flatList,
      previewInfo: null,
    });
  }
}

async function sendFileContent(relativePath: string) {
  if (!state.activeHandle) return;
  let raw = '';
  try {
    raw = await readTextFile(state.activeHandle, relativePath);
  } catch {
    raw = `# File Not Found\n\nCould not read: **${relativePath}**`;
  }

  const { html, frontmatter, toc } = renderMarkdown(relativePath, raw);
  const rewrittenHtml = await rewriteMediaUrls(state.activeHandle, html, relativePath);
  const fileInfo = findFileInfo(state.flatList, relativePath);

  send({
    command: 'renderContent',
    html: rewrittenHtml,
    markdownSource: raw,
    frontmatter,
    toc,
    filePath: relativePath,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: state.flatList,
    previewInfo: null,
  });
}

// ── File-mode: single dropped file (FileSystemFileHandle) ──────────────────────

function buildMdFileFromName(fileName: string): MdFile {
  const dot = fileName.lastIndexOf('.');
  const ext = dot !== -1 ? fileName.slice(dot).toLowerCase() : '';
  const base = dot !== -1 ? fileName.slice(0, dot) : fileName;
  return {
    fsPath: fileName,
    relativePath: fileName,
    parts: [fileName],
    fileName,
    title: base || fileName,
    extension: ext,
    documentKind: 'markdown',
  };
}

async function loadSingleFileWorkspace(handle: FileSystemFileHandle) {
  resetFileState();
  state.singleFileHandle = handle;
  const fileName = handle.name;
  state.activeWorkspaceName = fileName;
  state.activeWorkspacePath = fileName;
  state.currentFile = fileName;

  const entry = buildMdFileFromName(fileName);
  state.flatList = [entry];
  state.workspaceTree = { name: fileName, path: '', children: [], files: [entry] };

  sendLoading('Loading file…');
  const recents = await BrowserRecentWorkspaces.load();
  send({
    command: 'readyAck',
    fileList: state.flatList,
    tree: state.workspaceTree,
    theme: 'dark',
    themeStyle: 'default',
    defaultExpanded: true,
    workspaceName: state.activeWorkspaceName,
    workspacePath: state.activeWorkspacePath,
    recentWorkspaces: recents,
    documentConversionEnabled: false,
    ...hostInfo(),
  });

  await sendSingleFileContent(fileName);
}

async function sendSingleFileContent(relativePath: string) {
  if (!state.singleFileHandle) {
    send({
      command: 'renderContent',
      html: '',
      markdownSource: '',
      frontmatter: {},
      toc: [],
      filePath: '',
      relativePath: 'Welcome Page',
      title: 'Welcome',
      fileList: state.flatList,
      previewInfo: null,
    });
    return;
  }

  let raw = '';
  try {
    const file = await state.singleFileHandle.getFile();
    raw = await file.text();
  } catch {
    raw = `# File Not Found\n\nCould not read: **${relativePath}**`;
  }

  const { html, frontmatter, toc } = renderMarkdown(relativePath, raw);
  const fileInfo = findFileInfo(state.flatList, relativePath);

  send({
    command: 'renderContent',
    html,
    markdownSource: raw,
    frontmatter,
    toc,
    filePath: relativePath,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: state.flatList,
    previewInfo: null,
  });
}

async function sendFileRecentWorkspacesChanged() {
  const recents = await BrowserRecentWorkspaces.load();
  send({ command: 'recentWorkspacesChanged', recentWorkspaces: recents });
}

function sendWorkspaceUnavailable(workspacePath: string, reason = 'missing') {
  resetFileState();
  BrowserRecentWorkspaces.load().then(recents => {
    send({
      command: 'workspaceUnavailable',
      workspacePath,
      workspaceName: extractWorkspaceName(workspacePath),
      reason,
      recentWorkspaces: recents,
      ...hostInfo(),
    });
  });
}

  return { resetFileState, loadHandleWorkspace, sendFileContent, buildMdFileFromName, loadSingleFileWorkspace, sendSingleFileContent, sendFileRecentWorkspacesChanged, sendWorkspaceUnavailable };
}

