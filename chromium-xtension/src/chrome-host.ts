// =============================================================================
// chrome/src/chrome-host.ts — Host-side message router running in tab context
// =============================================================================

import { documentWriteCapability, pickDirectory, readTextFile, verifyPermission } from "./file-access";
import {
  startCurrentFileWatcher,
  stopCurrentFileWatcher,
} from "./current-file-watcher";
import { scanWorkspaceIncrementally } from "./incremental-workspace-scan";
import { renderMarkdown } from "./markdown-renderer";
import { BrowserSearchIndex } from "./search-index";
import { BrowserRecentWorkspaces } from "./recent-workspaces";
import { rewriteMediaUrls, revokeAll } from "./media-resolver";
import type { MdFile, FolderNode } from "../../ui/src/types";
import { createEmptyWorkspaceReadyAck, createWelcomeMessage, extractWorkspaceName, findFileInfo, getHostInfo, shouldOpenFirstFile } from "./chrome-host-utils";
import { handleChromeHostUtilityCommand } from "./chrome-host-search";
import { createWorkspaceOperationState, type WorkspaceOperationMetadata } from "./workspace-operation-state";
import { handleBrowserFontHostCommand } from "./browser-font-host";

export { getHostInfo, normalizeSearchQuery, filterSearchIndexTabs, isValidExternalUrl, extractWorkspaceName, findFileInfo, shouldOpenFirstFile } from "./chrome-host-utils";
export { WORKSPACE_SCAN_BATCH_SIZE, WORKSPACE_SCAN_REVEAL_DELAY_MS } from "./incremental-workspace-scan";


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
const workspaceOperation = createWorkspaceOperationState();

function currentWorkspaceOperationMetadata(): WorkspaceOperationMetadata { return workspaceOperation.current(); }
function applyWorkspaceOperation(msg: any) { workspaceOperation.apply(msg); }
function isWorkspaceOperationCurrent(operation: WorkspaceOperationMetadata): boolean { return workspaceOperation.isCurrent(operation); }
function clearWorkspaceOperation(): void { workspaceOperation.clear(); }


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
  workspaceOperation.clear();
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
    documentWrite: /\.mdx?$/i.test(requestedFile) ? await documentWriteCapability(handle, requestedFile) : undefined,
    ...request.operation,
  });
}

async function sendWelcome(request: WorkspaceRequestSnapshot = captureWorkspaceRequest()) {
  if (isWorkspaceRequestCurrent(request)) sendToWebview(createWelcomeMessage(flatList, request.operation));
}

// Subscribe to messages from Webview
bus.addEventListener("webview-message", async (e: Event) => {
  const msg = (e as CustomEvent).detail;
  if (!msg) return;

  if (await handleBrowserFontHostCommand(msg, sendToWebview)) return;
  if (await handleChromeHostUtilityCommand(msg, { searchIndex, flatList, workspaceTree, activeWorkspacePath, activeHandle, send: sendToWebview, readText: readTextFile })) return;

  switch (msg.command) {
    case "ready": {
      if (readyHandled) return;
      readyHandled = true;
      const recents = await BrowserRecentWorkspaces.load();
      if (!activeHandle) {
        sendToWebview(createEmptyWorkspaceReadyAck(recents));
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
      if (!workspaceOperation.matches(msg.workspaceOperationId)) break;
      const operation = currentWorkspaceOperationMetadata();
      workspaceScanGeneration += 1;
      stopCurrentFileWatcher();
      bus.dispatchEvent(new CustomEvent("host-message", {
        detail: { command: "workspaceScanProgress", scannedFiles: flatList.length, active: false, ...operation },
      }));
      workspaceOperation.clear();
      break;
    }

    case "cancelAllWorkspaceScans": {
      workspaceScanGeneration += 1;
      stopCurrentFileWatcher();
      workspaceOperation.clear();
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
      sendToWebview(createEmptyWorkspaceReadyAck(recents, operation));
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
  }
});
