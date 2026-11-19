import { renderMarkdown } from './markdown-renderer';
import { BrowserScanner } from './scanner';
import { BrowserSearchIndex } from './search-index';
import { BrowserRecentWorkspaces } from './recent-workspaces';
import { rewriteMediaUrls } from './media-resolver';
import {
  writeSingleFileDocument,
  buildMdFileFromName,
  readContainerDocument,
  readAndConvertFile,
} from './web-file-content';
import { isExtraDocumentFile, convertWebDocumentToMarkdown } from './web-document-converter';
export { writeSingleFileDocument };
import { nextIncrementalPublishCount, treeHasEmptyFolder } from './incremental-publish';
import type { MdFile, FolderNode } from '../../ui/src/types';
import {
  loadAllRecentWorkspaces,
  renderVirtualFile,
  loadVirtualWorkspaceHandler,
} from './user-virtual-workspaces';

function sendEmptyWelcome(send: (m: unknown) => void, fileList: MdFile[], operation: Record<string, unknown>) {
  send({ command: 'renderContent', html: '', markdownSource: '', frontmatter: {}, toc: [], filePath: '', relativePath: 'Welcome Page', title: 'Welcome', fileList, previewInfo: null, ...operation });
}

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
  documentConversionEnabled?: boolean;
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
  const recentsPromise = loadAllRecentWorkspaces();
  const snapshot = () => {
    const fileList = [...discovered].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return { fileList, tree: BrowserScanner.buildTree(fileList) };
  };
  const docConv = () => Boolean(state.documentConversionEnabled);
  const publishChanged = () => {
    if (!isWorkspaceScanCurrent(request)) return;
    const next = snapshot();
    lastPublishedCount = next.fileList.length;
    state.flatList = next.fileList;
    state.workspaceTree = next.tree;
    send({
      command: 'workspaceFilesChanged', ...next,
      workspaceName: state.activeWorkspaceName, workspacePath: state.activeWorkspacePath,
      documentConversionEnabled: docConv(), ...request.operation,
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
        documentConversionEnabled: docConv(), ...hostInfo(), ...request.operation,
      });
      revealed = true;
    })();
  };
  send({ command: 'workspaceScanProgress', scannedFiles: 0, active: true, ...request.operation });
  const scanPromise = BrowserScanner.scan(handle, {
    documentConversion: docConv(),
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
    if (lastPublishedCount !== flat.length || treeHasEmptyFolder(tree)) {
      send({
        command: 'workspaceFilesChanged', fileList: flat, tree,
        workspaceName: state.activeWorkspaceName, workspacePath: state.activeWorkspacePath,
        documentConversionEnabled: docConv(), ...request.operation,
      });
    }
  } else {
    send({
      command: 'readyAck', fileList: flat, tree, theme: 'dark', themeStyle: 'default', defaultExpanded: true,
      workspaceName: state.activeWorkspaceName, workspacePath: state.activeWorkspacePath, recentWorkspaces: recents,
      documentConversionEnabled: docConv(), ...hostInfo(), ...request.operation,
    });
  }
  send({ command: 'workspaceScanProgress', scannedFiles: flat.length, active: false, ...request.operation });

  if (openFirstFile && flat.length > 0) {
    state.currentFile = flat[0].relativePath;
    await sendFileContent(state.currentFile, request);
  } else if (isWorkspaceScanCurrent(request)) {
    sendEmptyWelcome(send, state.flatList, request.operation);
  }
  return isWorkspaceScanCurrent(request);
}

async function sendFileContent(relativePath: string, request?: WorkspaceScanRequest) {
  const handle = request?.handle ?? state.activeHandle;
  if (!handle || (request && !isWorkspaceScanCurrent(request))) return;
  let markdownSource = '';
  let rawText = '';
  let previewInfo: any = null;
  let documentWrite: any = undefined;
  try {
    const res = await readContainerDocument(handle, relativePath);
    markdownSource = res.markdownSource;
    rawText = res.rawText;
    previewInfo = res.previewInfo;
    documentWrite = res.documentWrite;
  } catch {
    markdownSource = `# File Not Found\n\nCould not read: **${relativePath}**`;
    rawText = markdownSource;
  }
  if (request && !isWorkspaceScanCurrent(request)) return;

  const { html, frontmatter, toc } = renderMarkdown(relativePath, markdownSource);
  const rewrittenHtml = await rewriteMediaUrls(handle, html, relativePath);
  if (request && !isWorkspaceScanCurrent(request)) return;
  const fileInfo = findFileInfo(state.flatList, relativePath);

  send({
    command: 'renderContent',
    html: rewrittenHtml,
    markdownSource,
    sourceDocumentText: /\.html?$/i.test(relativePath) ? rawText : null,
    frontmatter,
    toc,
    filePath: relativePath,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: state.flatList,
    previewInfo,
    documentWrite,
    documentConversionEnabled: Boolean(state.documentConversionEnabled),
    ...(request?.operation ?? getWorkspaceOperationMetadata()),
  });
}

// ── File-mode: single dropped file (FileSystemFileHandle) ──────────────────────

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
  const recents = await loadAllRecentWorkspaces();
  if (state.singleFileHandle !== handle || workspaceScanGeneration !== generation) return false;
  send({
    command: 'readyAck', fileList: state.flatList, tree: state.workspaceTree, theme: 'dark', themeStyle: 'default',
    defaultExpanded: true, workspaceName: state.activeWorkspaceName, workspacePath: state.activeWorkspacePath,
    recentWorkspaces: recents, documentConversionEnabled: Boolean(state.documentConversionEnabled), ...hostInfo(), ...operation,
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
    sendEmptyWelcome(send, state.flatList, operation);
    return;
  }

  let markdownSource = '';
  let rawText = '';
  let previewInfo: any = null;
  let documentWrite: any = undefined;
  try {
    const res = await readAndConvertFile(expectedHandle, relativePath);
    markdownSource = res.markdownSource;
    rawText = res.rawText;
    previewInfo = res.previewInfo;
    documentWrite = res.documentWrite;
  } catch {
    markdownSource = `# File Not Found\n\nCould not read: **${relativePath}**`;
    rawText = markdownSource;
  }

  if (state.singleFileHandle !== expectedHandle || workspaceScanGeneration !== generation) return;
  const { html, frontmatter, toc } = renderMarkdown(relativePath, markdownSource);
  const fileInfo = findFileInfo(state.flatList, relativePath);

  send({
    command: 'renderContent',
    html,
    markdownSource,
    sourceDocumentText: /\.html?$/i.test(relativePath) ? rawText : null,
    frontmatter,
    toc,
    filePath: relativePath,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: state.flatList,
    previewInfo,
    documentWrite,
    documentConversionEnabled: Boolean(state.documentConversionEnabled),
    ...operation,
  });
}

const loadVirtualWorkspace = (workspacePath: string, openFirstFile: boolean | string = true) => {
  let generation = workspaceScanGeneration;
  return loadVirtualWorkspaceHandler({
    workspacePath,
    openFirstFile: typeof openFirstFile === 'string' ? false : openFirstFile,
    targetFile: typeof openFirstFile === 'string' ? openFirstFile : undefined,
    state,
    send,
    hostInfo,
    findFileInfo,
    getWorkspaceOperationMetadata,
    resetFileState: () => {
      resetFileState();
      generation = workspaceScanGeneration;
    },
    isCurrentGeneration: () => workspaceScanGeneration === generation,
  });
};

async function sendVirtualFileContent(workspacePath: string, relativePath: string) {
  const rendered = renderVirtualFile({
    workspacePath,
    relativePath,
    fileList: state.flatList,
    findFileInfo,
    operationMetadata: getWorkspaceOperationMetadata(),
  });
  if (isExtraDocumentFile(relativePath)) {
    const raw = String((rendered as any).markdownSource ?? '');
    const converted = await convertWebDocumentToMarkdown({ name: relativePath, text: raw });
    const { html, frontmatter, toc } = renderMarkdown(relativePath, converted.markdown);
    send({
      ...rendered,
      html,
      markdownSource: converted.markdown,
      previewInfo: converted.previewInfo,
      documentWrite: converted.previewInfo?.readOnly
        ? { supported: false, revision: null, reason: 'read-only-runtime' }
        : (rendered as any).documentWrite,
      documentConversionEnabled: Boolean(state.documentConversionEnabled),
    });
    return;
  }
  send({ ...rendered, documentConversionEnabled: Boolean(state.documentConversionEnabled) });
}

async function sendFileRecentWorkspacesChanged() {
  const recents = await loadAllRecentWorkspaces();
  send({ command: 'recentWorkspacesChanged', recentWorkspaces: recents });
}

function sendWorkspaceUnavailable(workspacePath: string, reason = 'missing') {
  const operation = getWorkspaceOperationMetadata();
  resetFileState();
  loadAllRecentWorkspaces().then(recents => {
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

function cancelWorkspaceScan() { workspaceScanGeneration += 1; }
function cancelAllWorkspaceScans() { workspaceScanGeneration += 1; }

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
    loadVirtualWorkspace,
    sendVirtualFileContent,
    loadAllRecentWorkspaces,
  };
}
