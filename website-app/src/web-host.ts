import { BrowserScanner } from '../../chromium-xtension/src/scanner';
import { BrowserSearchIndex } from '../../chromium-xtension/src/search-index';
import { BrowserRecentWorkspaces } from '../../chromium-xtension/src/recent-workspaces';
import { rewriteMediaUrls, revokeAll } from '../../chromium-xtension/src/media-resolver';
import { pickDirectory, pickFile, verifyPermission } from '../../chromium-xtension/src/file-access';
import type { MdFile, FolderNode } from '../../ui/src/types';
import { createTestModeHandlers } from './web-test-host';
import { createFileModeHandlers } from './web-file-mode';
import { handleWebTestMessage } from './web-test-message-router';
import { handleWebFileUtilityMessage } from './web-file-utility-router';
import { createWorkspaceOperationState } from '../../chromium-xtension/src/workspace-operation-state';

// The bus must be set up before ui/src/main.tsx runs so detectBridge() can
// find window.__webDemoBus. This module is imported before main.tsx.
if (!window.__webDemoBus) {
  (window as any).__webDemoBus = new EventTarget();
}
const bus: EventTarget = (window as any).__webDemoBus;

export type DemoMode = 'test' | 'file';

export function detectMode(): DemoMode {
  const params = new URLSearchParams(window.location.search);
  const m = params.get('mode');
  return m === 'file' ? 'file' : 'test';
}

let mode: DemoMode = 'test';
let currentFile: string | null = null;
let flatList: MdFile[] = [];
let workspaceTree: FolderNode | null = null;
let readyHandled = false;
const workspaceOperation = createWorkspaceOperationState();

let activeHandle: FileSystemDirectoryHandle | null = null;
let activeWorkspacePath = '';
let activeWorkspaceName = '';
let searchIndex: BrowserSearchIndex | null = null;
let singleFileHandle: FileSystemFileHandle | null = null;

function send(msg: unknown) {
  bus.dispatchEvent(new CustomEvent('host-message', {
    detail: { ...workspaceOperation.current(), ...(msg as Record<string, unknown>) },
  }));
}

function sendLoading(label: string, detail?: string) {
  send({ command: 'setLoading', label, detail });
}

function hostInfo() {
  return {
    appVersion: '(demo)',
    appRuntime: 'chrome' as const,
    hostPlatform: 'unknown' as const,
    hostArch: 'unknown',
  };
}

function extractWorkspaceName(path: string) {
  return path.split('/').pop() || 'Workspace';
}

function findFileInfo(list: MdFile[], rel: string): { relativePath: string; title: string } {
  return (
    list.find(f => f.relativePath === rel) ?? {
      relativePath: rel,
      title: rel.split('/').pop() || 'Untitled',
    }
  );
}

const testState = {
  get flatList() { return flatList; },
  set flatList(value: MdFile[]) { flatList = value; },
  get workspaceTree() { return workspaceTree; },
  set workspaceTree(value: FolderNode | null) { workspaceTree = value; },
  get currentFile() { return currentFile; },
  set currentFile(value: string | null) { currentFile = value; },
};

const { sendTestReady, sendTestContent } = createTestModeHandlers({
  send,
  state: testState,
  hostInfo,
  findFileInfo,
});

const fileModeState = {
  get activeHandle() { return activeHandle; },
  set activeHandle(value: FileSystemDirectoryHandle | null) { activeHandle = value; },
  get activeWorkspacePath() { return activeWorkspacePath; },
  set activeWorkspacePath(value: string) { activeWorkspacePath = value; },
  get activeWorkspaceName() { return activeWorkspaceName; },
  set activeWorkspaceName(value: string) { activeWorkspaceName = value; },
  get currentFile() { return currentFile; },
  set currentFile(value: string | null) { currentFile = value; },
  get flatList() { return flatList; },
  set flatList(value: MdFile[]) { flatList = value; },
  get workspaceTree() { return workspaceTree; },
  set workspaceTree(value: FolderNode | null) { workspaceTree = value; },
  get searchIndex() { return searchIndex; },
  set searchIndex(value: BrowserSearchIndex | null) { searchIndex = value; },
  get singleFileHandle() { return singleFileHandle; },
  set singleFileHandle(value: FileSystemFileHandle | null) { singleFileHandle = value; },
};

const fileModeHandlers = createFileModeHandlers({
  state: fileModeState,
  send,
  sendLoading,
  hostInfo,
  findFileInfo,
  extractWorkspaceName,
  getWorkspaceOperationMetadata: workspaceOperation.current,
});
const {
  resetFileState,
  loadHandleWorkspace,
  sendFileContent,
  loadSingleFileWorkspace,
  sendSingleFileContent,
  sendFileRecentWorkspacesChanged,
  sendWorkspaceUnavailable,
  cancelWorkspaceScan,
  cancelAllWorkspaceScans,
} = fileModeHandlers;

bus.addEventListener('webview-message', async (e: Event) => {
  const msg = (e as CustomEvent).detail;
  if (!msg) return;

  if (mode === 'test') {
    await handleWebTestMessage(msg, {
      getReadyHandled: () => readyHandled,
      setReadyHandled: value => { readyHandled = value; },
      setCurrentFile: path => { currentFile = path; },
      getFlatList: () => flatList,
      send,
      sendTestReady,
      sendTestContent,
    });
    return;
  }

  // ── File mode ─────────────────────────────────────────────────────────────────
  if (await handleWebFileUtilityMessage(msg, {
    getSearchIndex: () => searchIndex,
    getSingleFileHandle: () => singleFileHandle,
    getFlatList: () => flatList,
    getActiveWorkspacePath: () => activeWorkspacePath,
    getWorkspaceTree: () => workspaceTree,
    getActiveHandle: () => activeHandle,
    send,
  })) return;

  switch (msg.command) {
    case 'ready': {
      if (readyHandled) return;
      readyHandled = true;
      const recents = await BrowserRecentWorkspaces.load();
      if (!activeHandle) {
        send({
          command: 'readyAck',
          fileList: [],
          tree: null,
          theme: 'dark',
          themeStyle: 'default',
          defaultExpanded: true,
          workspaceName: '',
          workspacePath: undefined,
          recentWorkspaces: recents,
          documentConversionEnabled: false,
          ...hostInfo(),
        });
      } else {
        await loadHandleWorkspace(activeHandle, msg.openFirstFile !== false);
      }
      break;
    }

    case 'openFolder': {
      workspaceOperation.apply(msg);
      const operation = workspaceOperation.current();
      try {
        const handle = msg.handle ?? (await pickDirectory());
        if (!workspaceOperation.isCurrent(operation)) break;
        if (!handle) {
          send({ command: 'workspaceOpenCancelled', ...operation });
          workspaceOperation.clear();
          break;
        }
        if (msg.replaceRecentWorkspacePath && msg.replaceRecentWorkspacePath !== handle.name) {
          await BrowserRecentWorkspaces.remove(msg.replaceRecentWorkspacePath);
        }
        if (!workspaceOperation.isCurrent(operation)) break;
        await loadHandleWorkspace(handle, msg.openFirstFile !== false);
      } catch (err) {
        console.warn('Folder selection cancelled or failed:', err);
        if (workspaceOperation.isCurrent(operation)) {
          send({ command: 'workspaceOpenCancelled', ...operation });
          workspaceOperation.clear();
        }
      }
      break;
    }

    case 'openFile': {
      workspaceOperation.apply(msg);
      const operation = workspaceOperation.current();
      try {
        const handle = await pickFile();
        if (!workspaceOperation.isCurrent(operation)) break;
        if (handle && handle.kind === 'file') {
          await loadSingleFileWorkspace(handle);
        }
      } catch (err) {
        console.warn('Single file selection cancelled or failed:', err);
      }
      break;
    }

    case 'openFileHandle': {
      workspaceOperation.apply(msg);
      const operation = workspaceOperation.current();
      try {
        const handle = msg.handle;
        if (!workspaceOperation.isCurrent(operation)) break;
        if (handle && handle.kind === 'file') {
          await loadSingleFileWorkspace(handle);
        }
      } catch (err) {
        console.warn('Single file selection cancelled or failed:', err);
      }
      break;
    }

    case 'openRecentWorkspace': {
      workspaceOperation.apply(msg);
      const operation = workspaceOperation.current();
      const folderPath: string = msg.path;
      const handle = await BrowserRecentWorkspaces.getHandle(folderPath);
      if (!workspaceOperation.isCurrent(operation)) break;
      if (!handle) { sendWorkspaceUnavailable(folderPath, 'missing'); break; }

      sendLoading('Checking permission…');
      const ok = await verifyPermission(handle);
      if (!workspaceOperation.isCurrent(operation)) break;
      if (!ok) { sendWorkspaceUnavailable(folderPath, 'locked'); break; }

      await loadHandleWorkspace(handle, msg.openFirstFile !== false);
      break;
    }

    case 'activateWorkspace': {
      workspaceOperation.apply(msg);
      const operation = workspaceOperation.current();
      const folderPath: string = msg.workspacePath;
      const handle = await BrowserRecentWorkspaces.getHandle(folderPath);
      if (!workspaceOperation.isCurrent(operation)) break;
      if (!handle) { sendWorkspaceUnavailable(folderPath, 'missing'); break; }
      const ok = await verifyPermission(handle);
      if (!workspaceOperation.isCurrent(operation)) break;
      if (!ok) { sendWorkspaceUnavailable(folderPath, 'locked'); break; }
      const completed = await loadHandleWorkspace(handle, msg.filePath ? false : msg.openFirstFile !== false);
      if (completed && msg.filePath && workspaceOperation.isCurrent(operation)) {
        currentFile = msg.filePath;
        await sendFileContent(msg.filePath);
      }
      break;
    }

    case 'cancelWorkspaceScan': {
      if (workspaceOperation.matches(msg.workspaceOperationId)) {
        const operation = workspaceOperation.current();
        cancelWorkspaceScan();
        bus.dispatchEvent(new CustomEvent('host-message', {
          detail: { command: 'workspaceScanProgress', scannedFiles: flatList.length, active: false, ...operation },
        }));
        workspaceOperation.clear();
      }
      break;
    }

    case 'cancelAllWorkspaceScans': {
      cancelAllWorkspaceScans();
      workspaceOperation.clear();
      break;
    }

    case 'deleteRecentWorkspace': {
      await BrowserRecentWorkspaces.remove(msg.path);
      await sendFileRecentWorkspacesChanged();
      break;
    }

    case 'closeWorkspace': {
      const operation = workspaceOperation.current();
      readyHandled = false;
      resetFileState();
      workspaceOperation.clear();
      revokeAll();
      const recents = await BrowserRecentWorkspaces.load();
      send({
        command: 'readyAck',
        fileList: [],
        tree: null,
        theme: 'dark',
        themeStyle: 'default',
        defaultExpanded: true,
        workspaceName: '',
        workspacePath: undefined,
        recentWorkspaces: recents,
        documentConversionEnabled: false,
        ...hostInfo(),
        ...operation,
      });
      break;
    }

    case 'navigate': {
      const path = msg.path;
      if (!path) {
        currentFile = null;
        send({
          command: 'renderContent',
          html: '',
          markdownSource: '',
          frontmatter: {},
          toc: [],
          filePath: '',
          relativePath: 'Welcome Page',
          title: 'Welcome',
          fileList: flatList,
          previewInfo: null,
        });
        return;
      }
      currentFile = path;
      if (singleFileHandle) {
        await sendSingleFileContent(path);
      } else {
        await sendFileContent(path);
      }
      break;
    }

    case 'refresh': {
      if (activeHandle) {
        sendLoading('Refreshing workspace…');
        const { tree, flat } = await BrowserScanner.scan(activeHandle);
        flatList = flat;
        workspaceTree = tree;
        if (!searchIndex) searchIndex = new BrowserSearchIndex(activeHandle);
        searchIndex.prime(flat);
        const recents = await BrowserRecentWorkspaces.load();
        send({
          command: 'readyAck',
          fileList: flat,
          tree,
          theme: 'dark',
          themeStyle: 'default',
          defaultExpanded: true,
          workspaceName: activeWorkspaceName,
          workspacePath: activeWorkspacePath,
          recentWorkspaces: recents,
          documentConversionEnabled: false,
          ...hostInfo(),
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
}
