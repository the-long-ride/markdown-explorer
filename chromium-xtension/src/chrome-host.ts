// =============================================================================
// chrome/src/chrome-host.ts — Host-side message router running in tab context
// =============================================================================

import { pickDirectory, readTextFile, verifyPermission } from "./file-access";
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
  return typeof url === "string" && /^https?:\/\//i.test(url);
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
  if (openFirstFile !== false && !currentFile && flatList.length > 0) {
    return flatList[0].relativePath;
  }
  return currentFile;
}

export function sendToWebview(msg: any) {
  bus.dispatchEvent(new CustomEvent("host-message", { detail: msg }));
}

export function sendLoading(label: string, detail?: string) {
  sendToWebview({
    command: "setLoading",
    label,
    detail,
  });
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
  activeHandle = null;
  activeWorkspacePath = "";
  activeWorkspaceName = "";
  currentFile = null;
  flatList = [];
  workspaceTree = null;
  searchIndex = null;
}

function sendWorkspaceUnavailable(workspacePath: string, reason = "missing") {
  resetWorkspaceState();

  BrowserRecentWorkspaces.load().then((recents) => {
    sendToWebview({
      command: "workspaceUnavailable",
      workspacePath,
      workspaceName: extractWorkspaceName(workspacePath),
      reason,
      recentWorkspaces: recents,
      ...getHostInfo(),
    });
  });
}

async function sendWorkspaceData() {
  if (!activeHandle) return;

  try {
    const handle = activeHandle;
    const scanGeneration = ++workspaceScanGeneration;
    const workspacePath = activeWorkspacePath;
    const workspaceName = activeWorkspaceName;
    const recentsPromise = BrowserRecentWorkspaces.load();
    sendToWebview({ command: 'workspaceScanProgress', scannedFiles: 0, active: true });
    const result = await scanWorkspaceIncrementally({
      handle,
      isCurrent: () => activeHandle === handle && scanGeneration === workspaceScanGeneration,
      onProgress(scannedFiles) {
        sendToWebview({ command: 'workspaceScanProgress', scannedFiles, active: true });
      },
      async onReveal(next) {
        const recentWorkspaces = await recentsPromise;
        if (activeHandle !== handle || scanGeneration !== workspaceScanGeneration) return;
        flatList = next.fileList;
        workspaceTree = next.tree;
        sendToWebview({
          command: 'readyAck', ...next, theme: 'dark', themeStyle: 'default',
          defaultExpanded: true, workspaceName, workspacePath, recentWorkspaces,
          documentConversionEnabled: false, ...getHostInfo(),
        });
      },
      onChanged(next) {
        flatList = next.fileList;
        workspaceTree = next.tree;
        sendToWebview({ command: 'workspaceFilesChanged', ...next, workspaceName, workspacePath,
          documentConversionEnabled: false });
      },
    });
    if (!result) return;
    const { tree, flat } = result;
    flatList = flat;
    workspaceTree = tree;

    if (!searchIndex) {
      searchIndex = new BrowserSearchIndex(activeHandle);
    }
    searchIndex.prime(flat);

    sendToWebview({ command: 'workspaceScanProgress', scannedFiles: flat.length, active: false });
  } catch (err) {
    console.error("Failed to scan workspace:", err);
    sendWorkspaceUnavailable(activeWorkspacePath, "missing");
  }
}

async function sendInitialContent(openFirstFile = false) {
  const resolvedFile = shouldOpenFirstFile(currentFile, openFirstFile, flatList);
  if (resolvedFile && resolvedFile !== currentFile) {
    currentFile = resolvedFile;
  }

  if (currentFile) {
    await sendContent();
  } else {
    await sendWelcome();
  }
}

async function sendContent() {
  if (!currentFile || !activeHandle) return;

  let raw = "";
  try {
    raw = await readTextFile(activeHandle, currentFile);
  } catch (err) {
    console.error("Failed to read file:", currentFile, err);
    raw = `# File Not Found\n\nCould not read file: **${currentFile}**`;
  }

  const { html, frontmatter, toc } = renderMarkdown(currentFile, raw);
  const rewrittenHtml = await rewriteMediaUrls(activeHandle, html, currentFile);

  const fileInfo = findFileInfo(flatList, currentFile);

  sendToWebview({
    command: "renderContent",
    html: rewrittenHtml,
    markdownSource: raw,
    frontmatter,
    toc,
    filePath: currentFile, // Match filePath parameter name expected by UI
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: flatList,
    previewInfo: null,
  });
}

async function sendWelcome() {
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
      try {
        const handle = msg.handle || (await pickDirectory());
        activeHandle = handle;
        activeWorkspaceName = handle.name;
        activeWorkspacePath = handle.name; // In browser, name is path prefix
        currentFile = null;

        sendLoading("Loading workspace...");
        await BrowserRecentWorkspaces.save(
          activeWorkspaceName,
          activeWorkspacePath,
          handle,
        );
        await sendWorkspaceData();
        await sendInitialContent(msg.openFirstFile !== false);
      } catch (err) {
        console.warn("Folder selection cancelled or failed:", err);
      }
      break;
    }

    case "openRecentWorkspace": {
      const folderPath = msg.path;
      const handle = await BrowserRecentWorkspaces.getHandle(folderPath);
      if (!handle) {
        sendWorkspaceUnavailable(folderPath, "missing");
        return;
      }

      sendLoading("Checking permission...");
      const hasPermission = await verifyPermission(handle);
      if (!hasPermission) {
        sendWorkspaceUnavailable(folderPath, "locked");
        return;
      }

      activeHandle = handle;
      activeWorkspaceName = handle.name;
      activeWorkspacePath = folderPath;
      currentFile = null;

      sendLoading("Loading workspace...");
      await BrowserRecentWorkspaces.save(
        activeWorkspaceName,
        activeWorkspacePath,
        handle,
      );
      await sendWorkspaceData();
      await sendInitialContent(msg.openFirstFile !== false);
      break;
    }

    case "deleteRecentWorkspace": {
      await BrowserRecentWorkspaces.remove(msg.path);
      await sendRecentWorkspacesChanged();
      break;
    }

    case "closeWorkspace": {
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
      });
      break;
    }

    case "navigate": {
      if (!msg.path) {
        currentFile = null;
        await sendWelcome();
        return;
      }
      currentFile = msg.path;
      await sendContent();
      break;
    }

    case "refresh": {
      if (activeHandle) {
        sendLoading("Refreshing workspace...");
        await sendWorkspaceData();
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

    case "openExternal": {
      if (isValidExternalUrl(msg.url)) {
        window.open(msg.url as string, "_blank");
      }
      break;
    }
  }
});
