import { BrowserScanner } from './scanner';
import { BrowserSearchIndex } from './search-index';
import { BrowserRecentWorkspaces } from './recent-workspaces';
import { rewriteMediaUrls, revokeAll } from './media-resolver';
import { pickDirectory, pickFile, verifyPermission } from './file-access';
import type { MdFile, FolderNode } from '../../ui/src/types';
import { version as appVersion } from '../package.json';
import { createTestModeHandlers } from './web-test-host';
import { createFileModeHandlers } from './web-file-mode';
import { handleWebTestMessage } from './web-test-message-router';
import { executeWebNavigation } from './web-navigation';
import { handleWebFileUtilityMessage } from './web-file-utility-router';
import { createWorkspaceOperationState } from './workspace-operation-state';
import { handleBrowserFontHostCommand } from './browser-font-host';
import {
  isVirtualWorkspacePath, createUserVirtualWorkspace, createVirtualWorkspaceFromDroppedFiles,
  getVirtualWorkspaceEntryStore, setVirtualWorkspaceFileContent, removeUserVirtualWorkspace,
  getVirtualWorkspaceSnapshot, listUserVirtualWorkspaces,
} from './user-virtual-workspaces';

declare global {
  interface Window {
    __webBus?: EventTarget;
  }
}

// The bus must be set up before ui/src/main.tsx runs so detectBridge() can
// find window.__webBus. This module is imported before main.tsx.
// This existing bus also marks the shared browser UI as running in the web variant.
if (!window.__webBus) {
  (window as any).__webBus = new EventTarget();
}
const bus: EventTarget = (window as any).__webBus;

export function getWebBus(): EventTarget {
  return bus;
}

export type DemoMode = 'test' | 'web';

let mode: DemoMode = 'test';
let currentFile: string | null = null;
let flatList: MdFile[] = [];
let workspaceTree: FolderNode | null = null;
let readyHandled = false;
let explicitlyClosedWorkspace = false;
const workspaceOperation = createWorkspaceOperationState();

let activeHandle: FileSystemDirectoryHandle | null = null;
let activeWorkspacePath = '';
let activeWorkspaceName = '';
let searchIndex: BrowserSearchIndex | null = null;
let singleFileHandle: FileSystemFileHandle | null = null;
const workspaceSearchGeneration = { value: 0 };
let documentConversionEnabled = false;
try {
  if (typeof localStorage !== 'undefined') documentConversionEnabled = localStorage.getItem('documentConversion') === 'true';
} catch {}

const send = (msg: unknown) => {
  bus.dispatchEvent(new CustomEvent('host-message', {
    detail: { ...workspaceOperation.current(), ...(msg as Record<string, unknown>) },
  }));
};

function sendLoading(label: string, detail?: string) {
  send({ command: 'setLoading', label, detail });
}

const hostInfo = () => ({ appVersion, appRuntime: 'web' as const, hostPlatform: 'unknown' as const, hostArch: 'unknown' });
const extractWorkspaceName = (path: string) => path.split('/').pop() || 'Workspace';
const findFileInfo = (list: MdFile[], rel: string): { relativePath: string; title: string } =>
  list.find(f => f.relativePath === rel) ?? { relativePath: rel, title: rel.split('/').pop() || 'Untitled' };

const testState = {
  get flatList() { return flatList; }, set flatList(v: MdFile[]) { flatList = v; },
  get workspaceTree() { return workspaceTree; }, set workspaceTree(v: FolderNode | null) { workspaceTree = v; },
  get currentFile() { return currentFile; }, set currentFile(v: string | null) { currentFile = v; },
};

const { sendTestReady, sendTestContent, refreshTestWorkspace } = createTestModeHandlers({
  send, state: testState, hostInfo, findFileInfo,
  getDocumentConversionEnabled: () => documentConversionEnabled,
});

const fileModeState = {
  get activeHandle() { return activeHandle; }, set activeHandle(v: FileSystemDirectoryHandle | null) { activeHandle = v; },
  get activeWorkspacePath() { return activeWorkspacePath; }, set activeWorkspacePath(v: string) { activeWorkspacePath = v; },
  get activeWorkspaceName() { return activeWorkspaceName; }, set activeWorkspaceName(v: string) { activeWorkspaceName = v; },
  get currentFile() { return currentFile; }, set currentFile(v: string | null) { currentFile = v; },
  get flatList() { return flatList; }, set flatList(v: MdFile[]) { flatList = v; },
  get workspaceTree() { return workspaceTree; }, set workspaceTree(v: FolderNode | null) { workspaceTree = v; },
  get searchIndex() { return searchIndex; }, set searchIndex(v: BrowserSearchIndex | null) { searchIndex = v; },
  get singleFileHandle() { return singleFileHandle; }, set singleFileHandle(v: FileSystemFileHandle | null) { singleFileHandle = v; },
  get documentConversionEnabled() { return documentConversionEnabled; }, set documentConversionEnabled(v: boolean) { documentConversionEnabled = v; },
};

const fileModeHandlers = createFileModeHandlers({
  state: fileModeState, send, hostInfo, findFileInfo, extractWorkspaceName,
  getWorkspaceOperationMetadata: workspaceOperation.current,
});
const {
  resetFileState, loadHandleWorkspace, sendFileContent, loadSingleFileWorkspace,
  sendSingleFileContent, sendFileRecentWorkspacesChanged, sendWorkspaceUnavailable,
  cancelWorkspaceScan, cancelAllWorkspaceScans, loadVirtualWorkspace,
  sendVirtualFileContent, loadAllRecentWorkspaces,
} = fileModeHandlers;

let rescanGeneration = 0;

/** Returns null (and writes no state) when the workspace changed or a newer rescan started meanwhile. */
async function rescanWorkspace(handle: FileSystemDirectoryHandle) {
  const generation = ++rescanGeneration;
  const { tree, flat } = await BrowserScanner.scan(handle, { documentConversion: documentConversionEnabled });
  if (activeHandle !== handle || generation !== rescanGeneration) return null;
  flatList = flat;
  workspaceTree = tree;
  if (!searchIndex) searchIndex = new BrowserSearchIndex(handle);
  searchIndex.prime(flat);
  return { tree, flat };
}

/** Rescans after a host-side entry change and pushes the fresh tree (empty folders included) to the UI. */
async function refreshWorkspaceTree(): Promise<void> {
  if (isVirtualWorkspacePath(activeWorkspacePath)) {
    const snapshot = getVirtualWorkspaceSnapshot(activeWorkspacePath);
    flatList = snapshot.files;
    workspaceTree = snapshot.tree;
    send({
      command: 'workspaceFilesChanged', fileList: flatList, tree: workspaceTree,
      workspaceName: activeWorkspaceName, workspacePath: activeWorkspacePath, documentConversionEnabled,
    });
    return;
  }
  const handle = activeHandle;
  if (!handle) return;
  const scanned = await rescanWorkspace(handle);
  if (!scanned) return;
  const { tree, flat } = scanned;
  send({
    command: 'workspaceFilesChanged', fileList: flat, tree,
    workspaceName: activeWorkspaceName, workspacePath: activeWorkspacePath, documentConversionEnabled,
  });
}

bus.addEventListener('webview-message', async (e: Event) => {
  const msg = (e as CustomEvent).detail;
  if (!msg) return;

  if (await handleBrowserFontHostCommand(msg, send)) return;

  if (mode === 'test') {
    await handleWebTestMessage(msg, {
      getReadyHandled: () => readyHandled,
      setReadyHandled: value => { readyHandled = value; },
      setCurrentFile: path => { currentFile = path; },
      getCurrentFile: () => currentFile,
      getFlatList: () => flatList,
      send, sendTestReady, sendTestContent, refreshTestWorkspace,
      searchGeneration: workspaceSearchGeneration,
      getDocumentConversionEnabled: () => documentConversionEnabled,
      setDocumentConversionEnabled: value => { documentConversionEnabled = value; },
    });
    return;
  }

  // ── Web mode ──────────────────────────────────────────────────────────────────
  if (await handleWebFileUtilityMessage(msg, {
    getSearchIndex: () => searchIndex, getSingleFileHandle: () => singleFileHandle, getFlatList: () => flatList,
    getActiveWorkspacePath: () => activeWorkspacePath, getWorkspaceTree: () => workspaceTree, getActiveHandle: () => activeHandle,
    send, refreshWorkspace: refreshWorkspaceTree, searchGeneration: workspaceSearchGeneration,
    onRename: (oldPath, newPath, origin) => {
      if (activeHandle !== origin) return;
      if (currentFile === oldPath || currentFile?.startsWith(oldPath + '/')) currentFile = newPath + currentFile.slice(oldPath.length);
    },
  })) return;

  if (msg.type === 'createVirtualWorkspace' || msg.command === 'createVirtualWorkspace') {
    explicitlyClosedWorkspace = false;
    workspaceOperation.apply(msg);
    const meta = createUserVirtualWorkspace(msg.name);
    await loadVirtualWorkspace(meta.path, true);
    return;
  }

  if (msg.type === 'openDroppedFiles' || msg.command === 'openDroppedFiles') {
    explicitlyClosedWorkspace = false;
    workspaceOperation.apply(msg);
    const operation = workspaceOperation.current();
    const dropped = Array.isArray(msg.files) ? msg.files : [];
    if (dropped.length > 0) {
      if (isVirtualWorkspacePath(activeWorkspacePath)) {
        const store = getVirtualWorkspaceEntryStore(activeWorkspacePath);
        for (const file of dropped) {
          if (!store.entries.some((e) => e.path === file.name)) store.create('', file.name, 'file');
          setVirtualWorkspaceFileContent(activeWorkspacePath, file.name, file.content);
        }
        await refreshWorkspaceTree();
        if (workspaceOperation.isCurrent(operation)) {
          currentFile = dropped[0].name;
          await sendVirtualFileContent(activeWorkspacePath, dropped[0].name);
        }
      } else {
        const meta = createVirtualWorkspaceFromDroppedFiles(dropped);
        await loadVirtualWorkspace(meta.path, dropped[0].name);
      }
    }
    return;
  }

  async function activateOrOpenRecent(folderPath: string, filePath?: string, openFirstFile = true) {
    explicitlyClosedWorkspace = false;
    const operation = workspaceOperation.current();
    if (isVirtualWorkspacePath(folderPath)) {
      if (await loadVirtualWorkspace(folderPath, filePath ? false : openFirstFile) && filePath && workspaceOperation.isCurrent(operation)) {
        currentFile = filePath;
        await sendVirtualFileContent(folderPath, filePath);
      }
      return;
    }
    const handle = await BrowserRecentWorkspaces.getHandle(folderPath);
    if (!workspaceOperation.isCurrent(operation) || !handle) {
      if (!handle) sendWorkspaceUnavailable(folderPath, 'missing');
      return;
    }
    sendLoading('Checking permission…');
    if (!(await verifyPermission(handle)) || !workspaceOperation.isCurrent(operation)) {
      sendWorkspaceUnavailable(folderPath, 'locked');
      return;
    }
    if (await loadHandleWorkspace(handle, filePath ? false : openFirstFile) && filePath && workspaceOperation.isCurrent(operation)) {
      currentFile = filePath;
      await sendFileContent(filePath);
    }
  }

  switch (msg.command) {
    case 'ready': {
      if (typeof msg.documentConversion === 'boolean') {
        documentConversionEnabled = msg.documentConversion;
      }
      if (readyHandled) return;
      readyHandled = true;
      const recents = await loadAllRecentWorkspaces();
      if (isVirtualWorkspacePath(activeWorkspacePath)) {
        await loadVirtualWorkspace(activeWorkspacePath, msg.openFirstFile !== false);
      } else if (!activeHandle) {
        if (!explicitlyClosedWorkspace) {
          const existingVirtuals = listUserVirtualWorkspaces();
          const targetVirtual = existingVirtuals.length > 0
            ? [...existingVirtuals].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))[0]
            : createUserVirtualWorkspace();
          await loadVirtualWorkspace(targetVirtual.path, msg.openFirstFile !== false);
        } else {
          send({
            command: 'readyAck', fileList: [], tree: null, theme: 'dark', themeStyle: 'default',
            defaultExpanded: true, workspaceName: '', workspacePath: undefined, recentWorkspaces: recents,
            documentConversionEnabled, ...hostInfo(),
          });
        }
      } else {
        await loadHandleWorkspace(activeHandle, msg.openFirstFile !== false);
      }
      break;
    }

    case 'setDocumentConversion': {
      documentConversionEnabled = Boolean(msg.enabled);
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem('documentConversion', String(documentConversionEnabled));
      } catch {}
      if (isVirtualWorkspacePath(activeWorkspacePath)) {
        await refreshWorkspaceTree();
        if (currentFile) await sendVirtualFileContent(activeWorkspacePath, currentFile);
      } else if (activeHandle) {
        await refreshWorkspaceTree();
        if (currentFile) await sendFileContent(currentFile);
      } else if (singleFileHandle) {
        if (currentFile) await sendSingleFileContent(currentFile);
      }
      break;
    }

    case 'openFolder': {
      explicitlyClosedWorkspace = false;
      workspaceOperation.apply(msg);
      const operation = workspaceOperation.current();
      try {
        const handle = msg.handle ?? (await pickDirectory());
        if (!workspaceOperation.isCurrent(operation)) break;
        if (!handle) { send({ command: 'workspaceOpenCancelled', ...operation }); workspaceOperation.clear(); break; }
        if (msg.replaceRecentWorkspacePath && msg.replaceRecentWorkspacePath !== handle.name) await BrowserRecentWorkspaces.remove(msg.replaceRecentWorkspacePath);
        if (workspaceOperation.isCurrent(operation)) await loadHandleWorkspace(handle, msg.openFirstFile !== false);
      } catch (err) {
        console.warn('Folder selection cancelled or failed:', err);
        if (workspaceOperation.isCurrent(operation)) { send({ command: 'workspaceOpenCancelled', ...operation }); workspaceOperation.clear(); }
      }
      break;
    }

    case 'openFile':
    case 'openFileHandle': {
      explicitlyClosedWorkspace = false;
      workspaceOperation.apply(msg);
      const operation = workspaceOperation.current();
      try {
        const handle = msg.command === 'openFileHandle' ? msg.handle : await pickFile({ documentConversion: documentConversionEnabled });
        if (!workspaceOperation.isCurrent(operation)) break;
        if (handle && handle.kind === 'file') await loadSingleFileWorkspace(handle);
      } catch (err) {
        console.warn('Single file selection cancelled or failed:', err);
      }
      break;
    }

    case 'openSpecificFolder': {
      explicitlyClosedWorkspace = false;
      workspaceOperation.apply(msg);
      const folderPath = String(msg.path || msg.folderPath || '');
      if (isVirtualWorkspacePath(folderPath)) {
        await loadVirtualWorkspace(folderPath, msg.openFirstFile !== false);
      }
      break;
    }

    case 'openRecentWorkspace': {
      workspaceOperation.apply(msg);
      await activateOrOpenRecent(msg.path, undefined, msg.openFirstFile !== false);
      break;
    }

    case 'activateWorkspace': {
      workspaceOperation.apply(msg);
      await activateOrOpenRecent(msg.workspacePath, msg.filePath, msg.openFirstFile !== false);
      break;
    }

    case 'cancelWorkspaceScan':
      if (workspaceOperation.matches(msg.workspaceOperationId)) {
        const operation = workspaceOperation.current();
        cancelWorkspaceScan();
        send({ command: 'workspaceScanProgress', scannedFiles: flatList.length, active: false, ...operation });
        workspaceOperation.clear();
      }
      break;

    case 'cancelAllWorkspaceScans':
      cancelAllWorkspaceScans();
      workspaceOperation.clear();
      break;

    case 'removeWorkspace':
    case 'deleteRecentWorkspace': {
      const targetPath = String(msg.path || msg.workspacePath || '');
      if (isVirtualWorkspacePath(targetPath)) removeUserVirtualWorkspace(targetPath);
      else await BrowserRecentWorkspaces.remove(targetPath);
      await sendFileRecentWorkspacesChanged();
      break;
    }

    case 'closeWorkspace': {
      explicitlyClosedWorkspace = true;
      const operation = workspaceOperation.current();
      readyHandled = false;
      resetFileState();
      workspaceOperation.clear();
      revokeAll();
      const recents = await loadAllRecentWorkspaces();
      send({
        command: 'readyAck', fileList: [], tree: null, theme: 'dark', themeStyle: 'default',
        defaultExpanded: true, workspaceName: '', workspacePath: undefined, recentWorkspaces: recents,
        documentConversionEnabled, ...hostInfo(), ...operation,
      });
      break;
    }

    case 'navigate': {
      await executeWebNavigation(msg.path, currentFile, flatList, {
        setCurrentFile: path => { currentFile = path; },
        send,
        openFile: async (filePath) => {
          if (isVirtualWorkspacePath(activeWorkspacePath)) await sendVirtualFileContent(activeWorkspacePath, filePath);
          else if (singleFileHandle) await sendSingleFileContent(filePath);
          else await sendFileContent(filePath);
        },
      });
      break;
    }

    case 'refresh': {
      if (isVirtualWorkspacePath(activeWorkspacePath)) {
        sendLoading('Refreshing workspace…');
        const snapshot = getVirtualWorkspaceSnapshot(activeWorkspacePath);
        flatList = snapshot.files;
        workspaceTree = snapshot.tree;
        const recents = await loadAllRecentWorkspaces();
        send({
          command: 'readyAck', fileList: flatList, tree: workspaceTree, theme: 'dark', themeStyle: 'default',
          defaultExpanded: true, workspaceName: activeWorkspaceName, workspacePath: activeWorkspacePath,
          recentWorkspaces: recents, documentConversionEnabled, ...hostInfo(),
        });
        if (currentFile) await sendVirtualFileContent(activeWorkspacePath, currentFile);
      } else if (activeHandle) {
        sendLoading('Refreshing workspace…');
        const scanned = await rescanWorkspace(activeHandle);
        if (!scanned) break;
        const { tree, flat } = scanned;
        const recents = await loadAllRecentWorkspaces();
        send({
          command: 'readyAck', fileList: flat, tree, theme: 'dark', themeStyle: 'default',
          defaultExpanded: true, workspaceName: activeWorkspaceName, workspacePath: activeWorkspacePath,
          recentWorkspaces: recents, documentConversionEnabled, ...hostInfo(),
        });
        if (currentFile) await sendFileContent(currentFile);
      } else if (singleFileHandle) {
        sendLoading('Refreshing file…');
        if (currentFile) await sendSingleFileContent(currentFile);
      }
      break;
    }

    default:
      break;
  }
});

/** Call this once to set the operating mode before the bus listeners process messages. */
export function initWebHost(demoMode: DemoMode) {
  mode = demoMode;
  explicitlyClosedWorkspace = false;
  readyHandled = false;
  resetFileState();
}
