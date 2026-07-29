// =============================================================================
// website-app/src/web-host.ts
// Host-side message router for the demo web app.
// Mirrors chrome-host.ts but for two demo modes:
//   'test'  — virtual workspace from bundled test/*.md files
//   'file'  — real FileSystemAccess API (pick directory or single file)
// =============================================================================

import { BrowserScanner } from '../../chromium-xtension/src/scanner';
import { BrowserSearchIndex } from '../../chromium-xtension/src/search-index';
import { BrowserRecentWorkspaces } from '../../chromium-xtension/src/recent-workspaces';
import { rewriteMediaUrls, revokeAll } from '../../chromium-xtension/src/media-resolver';
import { pickDirectory, pickFile, readTextFile, verifyPermission } from '../../chromium-xtension/src/file-access';
import type { MdFile, FolderNode } from '../../ui/src/types';
import { normalizeForSearch, prepareHaystack } from '../../ui/src/utils/unicodeSearch';
import { makeExcerpt, searchVirtualFiles } from './web-test-search';
import { createTestModeHandlers } from './web-test-host';
import { createFileModeHandlers } from './web-file-mode';

// ── Bus ───────────────────────────────────────────────────────────────────────

// The bus must be set up before ui/src/main.tsx runs so detectBridge() can
// find window.__webDemoBus. This module is imported before main.tsx.
if (!window.__webDemoBus) {
  (window as any).__webDemoBus = new EventTarget();
}
const bus: EventTarget = (window as any).__webDemoBus;

// ── Mode detection ────────────────────────────────────────────────────────────

export type DemoMode = 'test' | 'file';

export function detectMode(): DemoMode {
  const params = new URLSearchParams(window.location.search);
  const m = params.get('mode');
  return m === 'file' ? 'file' : 'test';
}

// ── Shared state ──────────────────────────────────────────────────────────────

let mode: DemoMode = 'test';
let currentFile: string | null = null;
let flatList: MdFile[] = [];
let workspaceTree: FolderNode | null = null;
let readyHandled = false;
let activeWorkspaceOperationId: string | null = null;
let activeWorkspaceTabId: string | null = null;

type WorkspaceOperationMetadata = {
  workspaceOperationId?: string;
  workspaceTabId?: string;
};

// ── File-mode state ───────────────────────────────────────────────────────────

let activeHandle: FileSystemDirectoryHandle | null = null;
let activeWorkspacePath = '';
let activeWorkspaceName = '';
let searchIndex: BrowserSearchIndex | null = null;
let singleFileHandle: FileSystemFileHandle | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentWorkspaceOperationMetadata(): WorkspaceOperationMetadata {
  return activeWorkspaceOperationId && activeWorkspaceTabId
    ? { workspaceOperationId: activeWorkspaceOperationId, workspaceTabId: activeWorkspaceTabId }
    : {};
}

function applyWorkspaceOperation(msg: any) {
  activeWorkspaceOperationId = typeof msg?.workspaceOperationId === 'string'
    ? msg.workspaceOperationId
    : null;
  activeWorkspaceTabId = typeof msg?.workspaceTabId === 'string'
    ? msg.workspaceTabId
    : null;
}

function isWorkspaceOperationCurrent(operation: WorkspaceOperationMetadata): boolean {
  return activeWorkspaceOperationId === (operation.workspaceOperationId || null)
    && activeWorkspaceTabId === (operation.workspaceTabId || null);
}

function clearWorkspaceOperation() {
  activeWorkspaceOperationId = null;
  activeWorkspaceTabId = null;
}

function send(msg: unknown) {
  bus.dispatchEvent(new CustomEvent('host-message', {
    detail: { ...currentWorkspaceOperationMetadata(), ...(msg as Record<string, unknown>) },
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


function resolveWorkspaceTextResourcePath(documentPath: string, resourcePath: string): string | null {
  const reference = resourcePath.split(/[?#]/, 1)[0];
  if (!reference || /^(?:https?:|data:|blob:|javascript:|file:)/i.test(reference)) return null;
  const baseParts = reference.startsWith('/')
    ? []
    : documentPath.split('/').slice(0, -1).filter(Boolean);
  for (const part of reference.replace(/^\/+/, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!baseParts.length) return null;
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }
  const resolved = baseParts.join('/');
  return /\.(?:css|js|mjs|cjs)$/i.test(resolved) ? resolved : null;
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
  getWorkspaceOperationMetadata: currentWorkspaceOperationMetadata,
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

// ── Test-mode helpers moved to web-test-search.ts
// ── Test-mode handlers are provided by web-test-host.ts
// ── File-mode: real FileSystem API ────────────────────────────────────────────

// ── File-mode handlers are provided by web-file-mode.ts
// ── Message router ─────────────────────────────────────────────────────────────

bus.addEventListener('webview-message', async (e: Event) => {
  const msg = (e as CustomEvent).detail;
  if (!msg) return;

  // ── Test mode ────────────────────────────────────────────────────────────────
  if (mode === 'test') {
    switch (msg.command) {
      case 'ready': {
        if (readyHandled) return;
        readyHandled = true;
        await sendTestReady();
        break;
      }
      case 'navigate': {
        const path = msg.path;
        if (!path) {
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
        await sendTestContent(path);
        break;
      }
      case 'refresh': {
        await sendTestReady();
        break;
      }
      case 'searchWorkspace': {
        const q = String(msg.query || '').trim().toLowerCase();
        send({
          command: 'workspaceSearchResults',
          requestId: msg.requestId,
          results: searchVirtualFiles(q),
        });
        break;
      }
      case 'closeWorkspace': {
        // In test mode, just re-send the test workspace (can't actually close)
        readyHandled = false;
        await sendTestReady();
        break;
      }
      case 'readWorkspaceTextResource': {
        send({ command: 'workspaceTextResourceResult', requestId: msg.requestId, ok: false, reason: 'unsupported' });
        break;
      }
      case 'openExternal': {
        if (typeof msg.url === 'string' && /^(?:https?|file):\/\//i.test(msg.url)) {
          window.open(msg.url as string, '_blank');
        }
        break;
      }
      default:
        break;
    }
    return;
  }

  // ── File mode ─────────────────────────────────────────────────────────────────
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
      applyWorkspaceOperation(msg);
      const operation = currentWorkspaceOperationMetadata();
      try {
        const handle = msg.handle ?? (await pickDirectory());
        if (!isWorkspaceOperationCurrent(operation)) break;
        if (!handle) {
          send({ command: 'workspaceOpenCancelled', ...operation });
          clearWorkspaceOperation();
          break;
        }
        if (msg.replaceRecentWorkspacePath && msg.replaceRecentWorkspacePath !== handle.name) {
          await BrowserRecentWorkspaces.remove(msg.replaceRecentWorkspacePath);
        }
        if (!isWorkspaceOperationCurrent(operation)) break;
        await loadHandleWorkspace(handle, msg.openFirstFile !== false);
      } catch (err) {
        console.warn('Folder selection cancelled or failed:', err);
        if (isWorkspaceOperationCurrent(operation)) {
          send({ command: 'workspaceOpenCancelled', ...operation });
          clearWorkspaceOperation();
        }
      }
      break;
    }

    case 'openFile': {
      applyWorkspaceOperation(msg);
      const operation = currentWorkspaceOperationMetadata();
      try {
        const handle = await pickFile();
        if (!isWorkspaceOperationCurrent(operation)) break;
        if (handle && handle.kind === 'file') {
          await loadSingleFileWorkspace(handle);
        }
      } catch (err) {
        console.warn('Single file selection cancelled or failed:', err);
      }
      break;
    }

    case 'openFileHandle': {
      applyWorkspaceOperation(msg);
      const operation = currentWorkspaceOperationMetadata();
      try {
        const handle = msg.handle;
        if (!isWorkspaceOperationCurrent(operation)) break;
        if (handle && handle.kind === 'file') {
          await loadSingleFileWorkspace(handle);
        }
      } catch (err) {
        console.warn('Single file selection cancelled or failed:', err);
      }
      break;
    }

    case 'openRecentWorkspace': {
      applyWorkspaceOperation(msg);
      const operation = currentWorkspaceOperationMetadata();
      const folderPath: string = msg.path;
      const handle = await BrowserRecentWorkspaces.getHandle(folderPath);
      if (!isWorkspaceOperationCurrent(operation)) break;
      if (!handle) { sendWorkspaceUnavailable(folderPath, 'missing'); break; }

      sendLoading('Checking permission…');
      const ok = await verifyPermission(handle);
      if (!isWorkspaceOperationCurrent(operation)) break;
      if (!ok) { sendWorkspaceUnavailable(folderPath, 'locked'); break; }

      await loadHandleWorkspace(handle, msg.openFirstFile !== false);
      break;
    }

    case 'activateWorkspace': {
      applyWorkspaceOperation(msg);
      const operation = currentWorkspaceOperationMetadata();
      const folderPath: string = msg.workspacePath;
      const handle = await BrowserRecentWorkspaces.getHandle(folderPath);
      if (!isWorkspaceOperationCurrent(operation)) break;
      if (!handle) { sendWorkspaceUnavailable(folderPath, 'missing'); break; }
      const ok = await verifyPermission(handle);
      if (!isWorkspaceOperationCurrent(operation)) break;
      if (!ok) { sendWorkspaceUnavailable(folderPath, 'locked'); break; }
      const completed = await loadHandleWorkspace(handle, msg.filePath ? false : msg.openFirstFile !== false);
      if (completed && msg.filePath && isWorkspaceOperationCurrent(operation)) {
        currentFile = msg.filePath;
        await sendFileContent(msg.filePath);
      }
      break;
    }

    case 'cancelWorkspaceScan': {
      if (activeWorkspaceOperationId && msg.workspaceOperationId === activeWorkspaceOperationId) {
        const operation = currentWorkspaceOperationMetadata();
        cancelWorkspaceScan();
        bus.dispatchEvent(new CustomEvent('host-message', {
          detail: { command: 'workspaceScanProgress', scannedFiles: flatList.length, active: false, ...operation },
        }));
        clearWorkspaceOperation();
      }
      break;
    }

    case 'cancelAllWorkspaceScans': {
      cancelAllWorkspaceScans();
      clearWorkspaceOperation();
      break;
    }

    case 'deleteRecentWorkspace': {
      await BrowserRecentWorkspaces.remove(msg.path);
      await sendFileRecentWorkspacesChanged();
      break;
    }

    case 'closeWorkspace': {
      const operation = currentWorkspaceOperationMetadata();
      readyHandled = false;
      resetFileState();
      clearWorkspaceOperation();
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

    case 'searchWorkspace': {
      const q = String(msg.query || '').trim().toLowerCase();
      if (searchIndex) {
        const results = await searchIndex.search(q, flatList, 80);
        send({ command: 'workspaceSearchResults', requestId: msg.requestId, results });
      } else if (singleFileHandle && flatList.length > 0) {
        try {
          const file = await singleFileHandle.getFile();
          const raw = await file.text();
          const haystack = prepareHaystack(raw);
          const results = [];
          const item = flatList[0];
          const title = item.title;
          const fileName = item.fileName;
          const relativePath = item.relativePath;

          const titleScore = normalizeForSearch(title).includes(q) ? 5 : 0;
          const fileNameScore = normalizeForSearch(fileName).includes(q) ? 4 : 0;
          const baseScore = titleScore + fileNameScore;
          
          let nextNormIndex = 0;
          let ordinal = 0;
          while (results.length < 8) {
            const result = haystack.indexOfNormalized(q, nextNormIndex);
            if (!result) break;
            results.push({
              ...item,
              title,
              fileName,
              relativePath,
              excerpt: makeExcerpt(raw, result.match.index, result.match.matchLength),
              matchIndex: result.match.index,
              matchOrdinal: ordinal,
              matchLength: result.match.matchLength,
            });
            ordinal++;
            nextNormIndex = result.nextNormIndex;
          }
          
          if (results.length === 0 && baseScore > 0) {
            results.push({
              ...item,
              title,
              fileName,
              relativePath,
              excerpt: '',
              matchIndex: 0,
              matchOrdinal: 0,
              matchLength: 0,
            });
          }
          send({ command: 'workspaceSearchResults', requestId: msg.requestId, results });
        } catch (err) {
          console.error('Failed to search single file:', err);
          send({ command: 'workspaceSearchResults', requestId: msg.requestId, results: [] });
        }
      } else {
        send({ command: 'workspaceSearchResults', requestId: msg.requestId, results: [] });
      }
      break;
    }

    case 'loadWorkspaceSearchIndexes': {
      const tabs = (Array.isArray(msg.tabs) ? msg.tabs : []).flatMap((tab: any) => {
        const tabId = String(tab?.tabId || '');
        const wp = String(tab?.workspacePath || '');
        if (!tabId || !wp || wp !== activeWorkspacePath) return [];
        return [{ tabId, workspacePath: activeWorkspacePath, fileList: flatList, tree: workspaceTree }];
      });
      if (tabs.length > 0) send({ command: 'workspaceSearchIndexLoaded', tabs });
      break;
    }

    case 'indexWorkspaceSearchItems': {
      if (searchIndex) searchIndex.prime(msg.items || []);
      break;
    }

    case 'readWorkspaceTextResource': {
      const resolvedPath = resolveWorkspaceTextResourcePath(String(msg.documentPath || ''), String(msg.resourcePath || ''));
      if (!activeHandle || !resolvedPath) {
        send({ command: 'workspaceTextResourceResult', requestId: msg.requestId, ok: false, reason: 'outside-workspace' });
        break;
      }
      try {
        const content = await readTextFile(activeHandle, resolvedPath);
        send({ command: 'workspaceTextResourceResult', requestId: msg.requestId, ok: true, content, resolvedPath });
      } catch {
        send({ command: 'workspaceTextResourceResult', requestId: msg.requestId, ok: false, reason: 'missing' });
      }
      break;
    }

    case 'openExternal': {
      if (typeof msg.url === 'string' && /^(?:https?|file):\/\//i.test(msg.url)) {
        window.open(msg.url as string, '_blank');
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
