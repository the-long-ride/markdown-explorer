// =============================================================================
// chrome/src/chrome-host.ts — Host-side message router running in tab context
// =============================================================================

import { pickDirectory, readTextFile, verifyPermission } from "./file-access";
import {
  startCurrentFileWatcher,
  stopCurrentFileWatcher,
} from "./current-file-watcher";
import {
  scanWorkspaceIncrementally,
  WORKSPACE_SCAN_BATCH_SIZE,
  WORKSPACE_SCAN_REVEAL_DELAY_MS,
} from "./incremental-workspace-scan";
import { renderMarkdown } from "./markdown-renderer";
import { BrowserSearchIndex } from "./search-index";
import { BrowserRecentWorkspaces } from "./recent-workspaces";
import { rewriteMediaUrls, revokeAll } from "./media-resolver";
import type { MdFile, FolderNode } from "../../ui/src/types";

declare const chrome: { runtime: { getManifest(): { version: string } } };

declare global {
  interface Window {
    __chromeExtBus?: EventTarget;
  }
}

// Ensure the bus exists on window
if (!window.__chromeExtBus) {
  window.__chromeExtBus = new EventTarget();
}

const bus = window.__chromeExtBus;

let activeHandle: FileSystemDirectoryHandle | null = null;
let activeWorkspacePath = "";
let activeWorkspaceName = "";
let currentFile: string | null = null; // Relative path, e.g. "docs/intro.md"
let flatList: MdFile[] = [];
let workspaceTree: FolderNode | null = null;
let searchIndex: BrowserSearchIndex | null = null;
let readyHandled = false;
let workspaceScanGeneration = 0;
let activeWorkspaceOperationId: string | null = null;
let activeWorkspaceTabId: string | null = null;

type WorkspaceOperationMetadata = {
  workspaceOperationId?: string;
  workspaceTabId?: string;
};

export { WORKSPACE_SCAN_BATCH_SIZE, WORKSPACE_SCAN_REVEAL_DELAY_MS };

export function getHostInfo() {
  return {
    appVersion: chrome.runtime.getManifest().version,
    appRuntime: "chrome" as const,
    hostPlatform: "unknown" as const,
    hostArch: "unknown",
  };
}

export function normalizeSearchQuery(query: unknown): string {
  return String(query || "")
    .trim()
    .toLowerCase();
}

export function filterSearchIndexTabs(
  tabRequests: unknown[],
  activeWorkspacePath: string,
): Array<{ tabId: string; workspacePath: string; fileList: MdFile[]; tree: FolderNode | null }> {
  return (Array.isArray(tabRequests) ? tabRequests : []).flatMap((tab: any) => {
    const tabId = String(tab?.tabId || "");
    const workspacePath = String(tab?.workspacePath || "");
    if (!tabId || !workspacePath || workspacePath !== activeWorkspacePath)
      return [];

    return [
      {
        tabId,
        workspacePath: activeWorkspacePath,
        fileList: [] as MdFile[],
        tree: null as FolderNode | null,
      },
    ];
  });
}

export function isValidExternalUrl(url: unknown): boolean {
  return typeof url === "string" && /^(?:https?|file):\/\//i.test(url);
}

export function extractWorkspaceName(workspacePath: string): string {
  return workspacePath.split("/").pop() || "Workspace";
}

export function findFileInfo(
  flatList: MdFile[],
  relativePath: string,
): { relativePath: string; title: string } {
  return (
    flatList.find((f) => f.relativePath === relativePath) || {
      relativePath,
      title: relativePath.split("/").pop() || "Untitled",
    }
  );
}

export function shouldOpenFirstFile(
  currentFile: string | null,
  openFirstFile: boolean | undefined,
  flatList: MdFile[],
): string | null {
  return openFirstFile !== false && !currentFile && flatList.length > 0 ? flatList[0].relativePath : currentFile;
}

function currentWorkspaceOperationMetadata(): WorkspaceOperationMetadata {
  return activeWorkspaceOperationId && activeWorkspaceTabId
    ? {
        workspaceOperationId: activeWorkspaceOperationId,
        workspaceTabId: activeWorkspaceTabId,
      }
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
  const operationId = operation.workspaceOperationId || null;
  const tabId = operation.workspaceTabId || null;
  return activeWorkspaceOperationId === operationId && activeWorkspaceTabId === tabId;
}

function clearWorkspaceOperation(): void {
  activeWorkspaceOperationId = null;
  activeWorkspaceTabId = null;
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

export function sendToWebview(msg: any) {
  bus.dispatchEvent(new CustomEvent("host-message", {
    detail: { ...currentWorkspaceOperationMetadata(), ...msg },
  }));
}

export function sendLoading(label: string, detail?: string) {
  sendToWebview({ command: "setLoading", label, detail });
}

async function sendRecentWorkspacesChanged() {
  const recents = await BrowserRecentWorkspaces.load();
  sendToWebview({
    command: "recentWorkspacesChanged",
    recentWorkspaces: recents,
  });
}

export function resetWorkspaceState(): void {
  workspaceScanGeneration += 1;
  stopCurrentFileWatcher();
  activeHandle = null;
  activeWorkspacePath = "";
  activeWorkspaceName = "";
  currentFile = null;
  flatList = [];
  workspaceTree = null;
  searchIndex = null;
  activeWorkspaceOperationId = null;
  activeWorkspaceTabId = null;
}

function sendWorkspaceUnavailable(workspacePath: string, reason = "missing", operation = currentWorkspaceOperationMetadata()) {
  resetWorkspaceState();

  BrowserRecentWorkspaces.load().then((recents) => {
    sendToWebview({
      command: "workspaceUnavailable",
      workspacePath,
      workspaceName: extractWorkspaceName(workspacePath),
      reason,
      recentWorkspaces: recents,
      ...getHostInfo(),
      ...operation,
    });
  });
}

async function sendWorkspaceData(): Promise<boolean> {
  if (!activeHandle) return false;
  const operation = currentWorkspaceOperationMetadata();
  const handle = activeHandle;
  const scanGeneration = ++workspaceScanGeneration;
  const workspacePath = activeWorkspacePath;
  const workspaceName = activeWorkspaceName;

  try {
    const recentsPromise = BrowserRecentWorkspaces.load();
    sendToWebview({ command: 'workspaceScanProgress', scannedFiles: 0, active: true, ...operation });
    const result = await scanWorkspaceIncrementally({
      handle,
      isCurrent: () => activeHandle === handle && scanGeneration === workspaceScanGeneration,
      onProgress(scannedFiles) {
        sendToWebview({ command: 'workspaceScanProgress', scannedFiles, active: true, ...operation });
      },
      async onReveal(next) {
        const recentWorkspaces = await recentsPromise;
        if (activeHandle !== handle || scanGeneration !== workspaceScanGeneration) return;
        flatList = next.fileList;
        workspaceTree = next.tree;
        sendToWebview({
          command: 'readyAck', ...next, theme: 'dark', themeStyle: 'default',
          defaultExpanded: true, workspaceName, workspacePath, recentWorkspaces,
          documentConversionEnabled: false, ...getHostInfo(), ...operation,
        });
      },
      onChanged(next) {
        flatList = next.fileList;
        workspaceTree = next.tree;
        sendToWebview({ command: 'workspaceFilesChanged', ...next, workspaceName, workspacePath,
          documentConversionEnabled: false, ...operation });
      },
    });
    if (!result) return false;
    const { tree, flat } = result;
    flatList = flat;
    workspaceTree = tree;

    if (!searchIndex) {
      searchIndex = new BrowserSearchIndex(activeHandle);
    }
    searchIndex.prime(flat);

    sendToWebview({ command: 'workspaceScanProgress', scannedFiles: flat.length, active: false, ...operation });
    return true;
  } catch (err) {
    console.error("Failed to scan workspace:", err);
    if (
      activeHandle === handle
      && scanGeneration === workspaceScanGeneration
      && isWorkspaceOperationCurrent(operation)
    ) {
      sendWorkspaceUnavailable(workspacePath, "missing", operation);
    }
    return false;
  }
}

type WorkspaceRequestSnapshot = {
  handle: FileSystemDirectoryHandle | null;
  generation: number;
  operation: WorkspaceOperationMetadata;
};

function captureWorkspaceRequest(): WorkspaceRequestSnapshot {
  return {
    handle: activeHandle,
    generation: workspaceScanGeneration,
    operation: currentWorkspaceOperationMetadata(),
  };
}

function isWorkspaceRequestCurrent(request: WorkspaceRequestSnapshot): boolean {
  return activeHandle === request.handle && workspaceScanGeneration === request.generation;
}

async function sendInitialContent(openFirstFile = false) {
  const request = captureWorkspaceRequest();
  const resolvedFile = shouldOpenFirstFile(currentFile, openFirstFile, flatList);
  if (resolvedFile && resolvedFile !== currentFile) {
    currentFile = resolvedFile;
    startCurrentFileWatcher(activeHandle, currentFile, (p) => {
      if (isWorkspaceRequestCurrent(request)) {
        sendToWebview({ command: "currentFileChanged", filePath: p, ...request.operation });
      }
    });
  }

  if (!isWorkspaceRequestCurrent(request)) return;
  if (currentFile) {
    await sendContent(request, currentFile);
  } else {
    await sendWelcome(request);
  }
}

async function sendContent(
  request: WorkspaceRequestSnapshot = captureWorkspaceRequest(),
  requestedFile: string | null = currentFile,
) {
  const handle = request.handle;
  if (!requestedFile || !handle || !isWorkspaceRequestCurrent(request)) return;

  let raw = "";
  try {
    raw = await readTextFile(handle, requestedFile);
  } catch (err) {
    console.error("Failed to read file:", requestedFile, err);
    raw = `# File Not Found\n\nCould not read file: **${requestedFile}**`;
  }
  if (!isWorkspaceRequestCurrent(request)) return;

  const { html, frontmatter, toc } = renderMarkdown(requestedFile, raw);
  const rewrittenHtml = await rewriteMediaUrls(handle, html, requestedFile);
  if (!isWorkspaceRequestCurrent(request)) return;

  const fileInfo = findFileInfo(flatList, requestedFile);

  sendToWebview({
    command: "renderContent",
    html: rewrittenHtml,
    markdownSource: raw,
    sourceDocumentText: /\.html?$/i.test(requestedFile) ? raw : null,
    frontmatter,
    toc,
    filePath: requestedFile,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: flatList,
    previewInfo: null,
    ...request.operation,
  });
}

async function sendWelcome(request: WorkspaceRequestSnapshot = captureWorkspaceRequest()) {
  if (!isWorkspaceRequestCurrent(request)) return;
  sendToWebview({
    command: "renderContent",
    html: "",
    markdownSource: "",
    frontmatter: {},
    toc: [],
    filePath: "",
    relativePath: "Welcome Page",
    title: "Welcome",
    fileList: flatList,
    previewInfo: null,
    ...request.operation,
  });
}

// Subscribe to messages from Webview
bus.addEventListener("webview-message", async (e: Event) => {
  const msg = (e as CustomEvent).detail;
  if (!msg) return;

  switch (msg.command) {
    case "ready": {
      if (readyHandled) return;
      readyHandled = true;
      const recents = await BrowserRecentWorkspaces.load();
      if (!activeHandle) {
        sendToWebview({
          command: "readyAck",
          fileList: [],
          tree: null,
          theme: "dark",
          themeStyle: "default",
          defaultExpanded: true,
          workspaceName: "",
          workspacePath: undefined,
          recentWorkspaces: recents,
          documentConversionEnabled: false,
          ...getHostInfo(),
        });
      } else {
        await sendWorkspaceData();
      }
      break;
    }

    case "openFolder": {
      applyWorkspaceOperation(msg);
      const operation = currentWorkspaceOperationMetadata();
      try {
        const handle = msg.handle || (await pickDirectory());
        if (!isWorkspaceOperationCurrent(operation)) break;
        if (!handle) {
          sendToWebview({ command: "workspaceOpenCancelled", ...operation });
          clearWorkspaceOperation();
          break;
        }
        if (msg.replaceRecentWorkspacePath && msg.replaceRecentWorkspacePath !== handle.name) {
          await BrowserRecentWorkspaces.remove(msg.replaceRecentWorkspacePath);
        }
        if (!isWorkspaceOperationCurrent(operation)) break;
        activeHandle = handle;
        searchIndex = null;
        activeWorkspaceName = handle.name;
        activeWorkspacePath = handle.name; // In browser, name is path prefix
        currentFile = null;
        flatList = [];
        workspaceTree = null;
        stopCurrentFileWatcher();

        sendLoading("Loading workspace...");
        await BrowserRecentWorkspaces.save(
          activeWorkspaceName,
          activeWorkspacePath,
          handle,
        );
        if (!isWorkspaceOperationCurrent(operation) || activeHandle !== handle) break;
        await sendRecentWorkspacesChanged();
        if (!isWorkspaceOperationCurrent(operation) || activeHandle !== handle) break;
        const completed = await sendWorkspaceData();
        if (completed && isWorkspaceOperationCurrent(operation)) {
          await sendInitialContent(msg.openFirstFile !== false);
        }
      } catch (err) {
        console.warn("Folder selection cancelled or failed:", err);
        if (isWorkspaceOperationCurrent(operation)) {
          sendToWebview({ command: "workspaceOpenCancelled", ...operation });
          clearWorkspaceOperation();
        }
      }
      break;
    }

    case "openRecentWorkspace": {
      applyWorkspaceOperation(msg);
      const operation = currentWorkspaceOperationMetadata();
      const folderPath = msg.path;
      const handle = await BrowserRecentWorkspaces.getHandle(folderPath);
      if (!isWorkspaceOperationCurrent(operation)) break;
      if (!handle) {
        sendWorkspaceUnavailable(folderPath, "missing", operation);
        break;
      }

      sendLoading("Checking permission...");
      const hasPermission = await verifyPermission(handle);
      if (!isWorkspaceOperationCurrent(operation)) break;
      if (!hasPermission) {
        sendWorkspaceUnavailable(folderPath, "locked", operation);
        break;
      }

      activeHandle = handle;
      searchIndex = null;
      activeWorkspaceName = handle.name;
      activeWorkspacePath = folderPath;
      currentFile = null;
      flatList = [];
      workspaceTree = null;
      stopCurrentFileWatcher();

      sendLoading("Loading workspace...");
      await BrowserRecentWorkspaces.save(
        activeWorkspaceName,
        activeWorkspacePath,
        handle,
      );
      if (!isWorkspaceOperationCurrent(operation) || activeHandle !== handle) break;
      await sendRecentWorkspacesChanged();
      if (!isWorkspaceOperationCurrent(operation) || activeHandle !== handle) break;
      const completed = await sendWorkspaceData();
      if (completed && isWorkspaceOperationCurrent(operation)) {
        await sendInitialContent(msg.openFirstFile !== false);
      }
      break;
    }

    case "activateWorkspace": {
      applyWorkspaceOperation(msg);
      const operation = currentWorkspaceOperationMetadata();
      const folderPath = msg.workspacePath;
      const handle = await BrowserRecentWorkspaces.getHandle(folderPath);
      if (!isWorkspaceOperationCurrent(operation)) break;
      if (!handle) {
        sendWorkspaceUnavailable(folderPath, "missing", operation);
        break;
      }
      const hasPermission = await verifyPermission(handle);
      if (!isWorkspaceOperationCurrent(operation)) break;
      if (!hasPermission) {
        sendWorkspaceUnavailable(folderPath, "locked", operation);
        break;
      }
      activeHandle = handle;
      searchIndex = null;
      activeWorkspaceName = handle.name;
      activeWorkspacePath = folderPath;
      currentFile = msg.filePath || null;
      flatList = [];
      workspaceTree = null;
      stopCurrentFileWatcher();
      sendLoading("Loading workspace...");
      const completed = await sendWorkspaceData();
      if (completed && isWorkspaceOperationCurrent(operation)) {
        await sendInitialContent(msg.openFirstFile !== false);
      }
      break;
    }

    case "cancelWorkspaceScan": {
      if (!activeWorkspaceOperationId || msg.workspaceOperationId !== activeWorkspaceOperationId) break;
      const operation = currentWorkspaceOperationMetadata();
      workspaceScanGeneration += 1;
      stopCurrentFileWatcher();
      bus.dispatchEvent(new CustomEvent("host-message", {
        detail: { command: "workspaceScanProgress", scannedFiles: flatList.length, active: false, ...operation },
      }));
      activeWorkspaceOperationId = null;
      activeWorkspaceTabId = null;
      break;
    }

    case "cancelAllWorkspaceScans": {
      workspaceScanGeneration += 1;
      stopCurrentFileWatcher();
      activeWorkspaceOperationId = null;
      activeWorkspaceTabId = null;
      break;
    }

    case "deleteRecentWorkspace": {
      await BrowserRecentWorkspaces.remove(msg.path);
      await sendRecentWorkspacesChanged();
      break;
    }

    case "closeWorkspace": {
      const operation = currentWorkspaceOperationMetadata();
      readyHandled = false;
      resetWorkspaceState();
      revokeAll();

      const recents = await BrowserRecentWorkspaces.load();
      sendToWebview({
        command: "readyAck",
        fileList: [],
        tree: null,
        theme: "dark",
        themeStyle: "default",
        defaultExpanded: true,
        workspaceName: "",
        workspacePath: undefined,
        recentWorkspaces: recents,
        documentConversionEnabled: false,
        ...getHostInfo(),
        ...operation,
      });
      break;
    }

    case "navigate": {
      if (!msg.path) {
        currentFile = null;
        flatList = [];
        workspaceTree = null;
        stopCurrentFileWatcher();
        await sendWelcome();
        return;
      }
      currentFile = msg.path;
      startCurrentFileWatcher(activeHandle, currentFile, (p) => sendToWebview({ command: "currentFileChanged", filePath: p }));
      await sendContent();
      break;
    }

    case "refresh": {
      if (activeHandle) {
        sendLoading("Refreshing workspace...");
        const completed = await sendWorkspaceData();
        if (!completed) break;
        if (currentFile) {
          await sendContent();
        } else {
          await sendWelcome();
        }
      }
      break;
    }

    case "searchWorkspace": {
      const query = normalizeSearchQuery(msg.query);
      const requestId = msg.requestId;
      if (searchIndex) {
        const results = await searchIndex.search(query, flatList, 80);
        sendToWebview({
          command: "workspaceSearchResults",
          requestId,
          results,
        });
      } else {
        sendToWebview({
          command: "workspaceSearchResults",
          requestId,
          results: [],
        });
      }
      break;
    }

    case "loadWorkspaceSearchIndexes": {
      const tabs = filterSearchIndexTabs(msg.tabs, activeWorkspacePath).map((tab) => ({
        ...tab,
        fileList: flatList,
        tree: workspaceTree,
      }));

      if (tabs.length > 0) {
        sendToWebview({
          command: "workspaceSearchIndexLoaded",
          tabs,
        });
      }
      break;
    }

    case "indexWorkspaceSearchItems": {
      if (searchIndex) {
        searchIndex.prime(msg.items || []);
      }
      break;
    }

    case "readWorkspaceTextResource": {
      const resolvedPath = resolveWorkspaceTextResourcePath(String(msg.documentPath || ""), String(msg.resourcePath || ""));
      if (!activeHandle || !resolvedPath) {
        sendToWebview({ command: "workspaceTextResourceResult", requestId: msg.requestId, ok: false, reason: "outside-workspace" });
        break;
      }
      try {
        const content = await readTextFile(activeHandle, resolvedPath);
        sendToWebview({ command: "workspaceTextResourceResult", requestId: msg.requestId, ok: true, content, resolvedPath });
      } catch {
        sendToWebview({ command: "workspaceTextResourceResult", requestId: msg.requestId, ok: false, reason: "missing" });
      }
      break;
    }

    case "openExternal": {
      if (isValidExternalUrl(msg.url)) {
        window.open(msg.url as string, "_blank");
      }
      break;
    }
  }
});
