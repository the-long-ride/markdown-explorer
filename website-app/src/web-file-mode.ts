import { renderMarkdown } from '../../chromium-xtension/src/markdown-renderer';
import { BrowserScanner } from '../../chromium-xtension/src/scanner';
import { BrowserSearchIndex } from '../../chromium-xtension/src/search-index';
import { BrowserRecentWorkspaces } from '../../chromium-xtension/src/recent-workspaces';
import { rewriteMediaUrls } from '../../chromium-xtension/src/media-resolver';
import {
  documentRevision,
  documentWriteCapability,
  readTextFile,
  writeFileHandle,
  type BrowserDocumentWriteResult,
} from '../../chromium-xtension/src/file-access';
import { nextIncrementalPublishCount } from '../../chromium-xtension/src/incremental-publish';
import type { MdFile, FolderNode } from '../../ui/src/types';

type WorkspaceOperationMetadata = {
  workspaceOperationId?: string;
  workspaceTabId?: string;
};

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
  getWorkspaceOperationMetadata: () => WorkspaceOperationMetadata;
}

export const WORKSPACE_SCAN_REVEAL_DELAY_MS = 3000;
export const WORKSPACE_SCAN_BATCH_SIZE = 32;

function isEditableMarkdownPath(filePath: string): boolean {
  return /\.mdx?$/i.test(filePath);
}

async function singleFileDocumentWriteCapability(handle: FileSystemFileHandle) {
  const permission = await (handle as any).queryPermission?.({ mode: 'readwrite' });
  if (permission !== 'granted') {
    return { supported: false, revision: null, reason: 'permission-required' as const };
  }
  return { supported: true, revision: await documentRevision(handle) };
}

export async function writeSingleFileDocument(
  handle: FileSystemFileHandle,
  source: string,
  expectedRevision: string | null,
  force = false,
): Promise<BrowserDocumentWriteResult> {
  return writeFileHandle(handle, source, expectedRevision, force);
}

export function createFileModeHandlers({
  state,
  send,
  hostInfo,
  findFileInfo,
  extractWorkspaceName,
  getWorkspaceOperationMetadata,
}: FileModeDeps) {
let workspaceScanGeneration = 0;
function resetFileState() {
  workspaceScanGeneration += 1;
  state.activeHandle = null;
  state.activeWorkspacePath = '';
  state.activeWorkspaceName = '';
  state.currentFile = null;
  state.flatList = [];
  state.workspaceTree = null;
  state.searchIndex = null;
  state.singleFileHandle = null;
}

type WorkspaceScanRequest = {
  handle: FileSystemDirectoryHandle;
  generation: number;
  operation: WorkspaceOperationMetadata;
};

function isWorkspaceScanCurrent(request: WorkspaceScanRequest): boolean {
  return state.activeHandle === request.handle && workspaceScanGeneration === request.generation;
}

async function loadHandleWorkspace(
  handle: FileSystemDirectoryHandle,
  openFirstFile = true,
): Promise<boolean> {
  const request: WorkspaceScanRequest = {
    handle,
    generation: ++workspaceScanGeneration,
    operation: getWorkspaceOperationMetadata(),
  };
  state.activeHandle = handle;
  state.activeWorkspaceName = handle.name;
  state.activeWorkspacePath = handle.name;
  state.currentFile = null;
  state.flatList = [];
  state.workspaceTree = null;
  state.searchIndex = null;
  state.singleFileHandle = null;

  send({ command: 'setLoading', label: 'Loading workspace…', ...request.operation });
  await BrowserRecentWorkspaces.save(state.activeWorkspaceName, state.activeWorkspacePath, handle);
  if (!isWorkspaceScanCurrent(request)) return false;
  await sendFileRecentWorkspacesChanged();
  if (!isWorkspaceScanCurrent(request)) return false;

  let revealed = false;
  let revealStarted = false;
  let thresholdElapsed = false;
  let lastPublishedCount = 0;
  const discovered: MdFile[] = [];
  const recentsPromise = BrowserRecentWorkspaces.load();
  const snapshot = () => {
    const fileList = [...discovered].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return { fileList, tree: BrowserScanner.buildTree(fileList) };
  };
  const publishChanged = () => {
    if (!isWorkspaceScanCurrent(request)) return;
    const next = snapshot();
    lastPublishedCount = next.fileList.length;
    state.flatList = next.fileList;
    state.workspaceTree = next.tree;
    send({
      command: 'workspaceFilesChanged', ...next,
      workspaceName: state.activeWorkspaceName, workspacePath: state.activeWorkspacePath,
      documentConversionEnabled: false, ...request.operation,
    });
  };
  let revealPromise: Promise<void> | null = null;
  const startReveal = () => {
    if (!isWorkspaceScanCurrent(request) || revealStarted || discovered.length === 0) return;
    revealStarted = true;
    revealPromise = (async () => {
      const recentWorkspaces = await recentsPromise;
      if (!isWorkspaceScanCurrent(request)) return;
      const next = snapshot();
      lastPublishedCount = next.fileList.length;
      state.flatList = next.fileList;
      state.workspaceTree = next.tree;
      send({
        command: 'readyAck', ...next, theme: 'dark', themeStyle: 'default',
        defaultExpanded: true, workspaceName: state.activeWorkspaceName,
        workspacePath: state.activeWorkspacePath, recentWorkspaces,
        documentConversionEnabled: false, ...hostInfo(), ...request.operation,
      });
      revealed = true;
    })();
  };
  send({ command: 'workspaceScanProgress', scannedFiles: 0, active: true, ...request.operation });
  const scanPromise = BrowserScanner.scan(handle, {
    isCurrent: () => isWorkspaceScanCurrent(request),
    onProgress(scannedFiles) {
      if (!isWorkspaceScanCurrent(request)) return;
      send({ command: 'workspaceScanProgress', scannedFiles, active: true, ...request.operation });
    },
    onFile(file, scannedFiles) {
      if (!isWorkspaceScanCurrent(request)) return;
      discovered.push(file);
      if (thresholdElapsed && !revealStarted) startReveal();
      else if (revealed && scannedFiles >= nextIncrementalPublishCount(lastPublishedCount, WORKSPACE_SCAN_BATCH_SIZE)) publishChanged();
    },
  });
  const revealTimer = globalThis.setTimeout(() => {
    if (!isWorkspaceScanCurrent(request)) return;
    thresholdElapsed = true;
    startReveal();
  }, WORKSPACE_SCAN_REVEAL_DELAY_MS);
  const { tree, flat } = await scanPromise;
  globalThis.clearTimeout(revealTimer);
  if (revealPromise) await revealPromise;
  if (!isWorkspaceScanCurrent(request)) return false;
  state.flatList = flat;
  state.workspaceTree = tree;
  state.searchIndex = new BrowserSearchIndex(handle);
  state.searchIndex.prime(flat);

  const recents = await recentsPromise;
  if (!isWorkspaceScanCurrent(request)) return false;
  if (revealed) {
    if (lastPublishedCount !== flat.length) {
      send({
        command: 'workspaceFilesChanged', fileList: flat, tree,
        workspaceName: state.activeWorkspaceName, workspacePath: state.activeWorkspacePath,
        documentConversionEnabled: false, ...request.operation,
      });
    }
  } else {
    send({
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
      ...request.operation,
    });
  }
  send({ command: 'workspaceScanProgress', scannedFiles: flat.length, active: false, ...request.operation });

  if (openFirstFile && flat.length > 0) {
    state.currentFile = flat[0].relativePath;
    await sendFileContent(state.currentFile, request);
  } else if (isWorkspaceScanCurrent(request)) {
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
      ...request.operation,
    });
  }
  return isWorkspaceScanCurrent(request);
}

async function sendFileContent(relativePath: string, request?: WorkspaceScanRequest) {
  const handle = request?.handle ?? state.activeHandle;
  if (!handle || (request && !isWorkspaceScanCurrent(request))) return;
  let raw = '';
  try {
    raw = await readTextFile(handle, relativePath);
  } catch {
    raw = `# File Not Found\n\nCould not read: **${relativePath}**`;
  }
  if (request && !isWorkspaceScanCurrent(request)) return;

  const { html, frontmatter, toc } = renderMarkdown(relativePath, raw);
  const rewrittenHtml = await rewriteMediaUrls(handle, html, relativePath);
  if (request && !isWorkspaceScanCurrent(request)) return;
  const fileInfo = findFileInfo(state.flatList, relativePath);
  const documentWrite = isEditableMarkdownPath(relativePath)
    ? await documentWriteCapability(handle, relativePath)
    : undefined;

  send({
    command: 'renderContent',
    html: rewrittenHtml,
    markdownSource: raw,
    sourceDocumentText: /\.html?$/i.test(relativePath) ? raw : null,
    frontmatter,
    toc,
    filePath: relativePath,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: state.flatList,
    previewInfo: null,
    documentWrite,
    ...(request?.operation ?? getWorkspaceOperationMetadata()),
  });
}

// ── File-mode: single dropped file (FileSystemFileHandle) ──────────────────────

function buildMdFileFromName(fileName: string, modifiedAt = 0): MdFile {
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
    modifiedAt,
  };
}

async function loadSingleFileWorkspace(handle: FileSystemFileHandle) {
  const operation = getWorkspaceOperationMetadata();
  resetFileState();
  const generation = workspaceScanGeneration;
  state.singleFileHandle = handle;
  const fileName = handle.name;
  state.activeWorkspaceName = fileName;
  state.activeWorkspacePath = fileName;
  state.currentFile = fileName;

  let modifiedAt = 0;
  try { modifiedAt = (await handle.getFile()).lastModified || 0; } catch {}
  const entry = buildMdFileFromName(fileName, modifiedAt);
  state.flatList = [entry];
  state.workspaceTree = { name: fileName, path: '', children: [], files: [entry], modifiedAt };

  send({ command: 'setLoading', label: 'Loading file…', ...operation });
  const recents = await BrowserRecentWorkspaces.load();
  if (state.singleFileHandle !== handle || workspaceScanGeneration !== generation) return false;
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
    ...operation,
  });

  await sendSingleFileContent(fileName, handle, operation, generation);
  return state.singleFileHandle === handle && workspaceScanGeneration === generation;
}

async function sendSingleFileContent(
  relativePath: string,
  expectedHandle: FileSystemFileHandle | null = state.singleFileHandle,
  operation: Record<string, string> = getWorkspaceOperationMetadata(),
  generation = workspaceScanGeneration,
) {
  if (!expectedHandle || state.singleFileHandle !== expectedHandle || workspaceScanGeneration !== generation) {
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
      ...operation,
    });
    return;
  }

  let raw = '';
  try {
    const file = await expectedHandle.getFile();
    raw = await file.text();
  } catch {
    raw = `# File Not Found\n\nCould not read: **${relativePath}**`;
  }

  if (state.singleFileHandle !== expectedHandle || workspaceScanGeneration !== generation) return;
  const { html, frontmatter, toc } = renderMarkdown(relativePath, raw);
  const fileInfo = findFileInfo(state.flatList, relativePath);
  const documentWrite = isEditableMarkdownPath(relativePath)
    ? await singleFileDocumentWriteCapability(expectedHandle)
    : undefined;

  send({
    command: 'renderContent',
    html,
    markdownSource: raw,
    sourceDocumentText: /\.html?$/i.test(relativePath) ? raw : null,
    frontmatter,
    toc,
    filePath: relativePath,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: state.flatList,
    previewInfo: null,
    documentWrite,
    ...operation,
  });
}

async function sendFileRecentWorkspacesChanged() {
  const recents = await BrowserRecentWorkspaces.load();
  send({ command: 'recentWorkspacesChanged', recentWorkspaces: recents });
}

function sendWorkspaceUnavailable(workspacePath: string, reason = 'missing') {
  const operation = getWorkspaceOperationMetadata();
  resetFileState();
  BrowserRecentWorkspaces.load().then(recents => {
    send({
      command: 'workspaceUnavailable',
      workspacePath,
      workspaceName: extractWorkspaceName(workspacePath),
      reason,
      recentWorkspaces: recents,
      ...hostInfo(),
      ...operation,
    });
  });
}

function cancelWorkspaceScan() {
  workspaceScanGeneration += 1;
}

function cancelAllWorkspaceScans() {
  workspaceScanGeneration += 1;
}

  return {
    resetFileState,
    loadHandleWorkspace,
    sendFileContent,
    buildMdFileFromName,
    loadSingleFileWorkspace,
    sendSingleFileContent,
    sendFileRecentWorkspacesChanged,
    sendWorkspaceUnavailable,
    cancelWorkspaceScan,
    cancelAllWorkspaceScans,
  };
}
