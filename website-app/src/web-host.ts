// =============================================================================
// website-app/src/web-host.ts
// Host-side message router for the demo web app.
// Mirrors chrome-host.ts but for two demo modes:
//   'test'  — virtual workspace from bundled test/*.md files
//   'file'  — real FileSystemAccess API (pick directory or single file)
// =============================================================================

import { renderMarkdown } from '../../chromium-xtension/src/markdown-renderer';
import { BrowserScanner } from '../../chromium-xtension/src/scanner';
import { BrowserSearchIndex } from '../../chromium-xtension/src/search-index';
import { BrowserRecentWorkspaces } from '../../chromium-xtension/src/recent-workspaces';
import { rewriteMediaUrls, revokeAll } from '../../chromium-xtension/src/media-resolver';
import { pickDirectory, pickFile, readTextFile, verifyPermission } from '../../chromium-xtension/src/file-access';
import {
  virtualFiles,
  virtualTree,
  getVirtualContent,
} from './virtual-workspace';
import type { MdFile, FolderNode } from '../../ui/src/types';
import { normalizeForSearch, prepareHaystack } from '../../ui/src/utils/unicodeSearch';

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

// ── File-mode state ───────────────────────────────────────────────────────────

let activeHandle: FileSystemDirectoryHandle | null = null;
let activeWorkspacePath = '';
let activeWorkspaceName = '';
let searchIndex: BrowserSearchIndex | null = null;
let singleFileHandle: FileSystemFileHandle | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(msg: unknown) {
  bus.dispatchEvent(new CustomEvent('host-message', { detail: msg }));
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

// ── Test-mode helpers ─────────────────────────────────────────────────────────

// Simple content search over virtual files
interface SearchExcerpt { excerpt: string; index: number; matchLength: number }

function makeExcerpt(text: string, index: number, matchLength: number): string {
  const before = text.slice(0, index).replace(/\s+/g, ' ').trim();
  const after = text.slice(index + matchLength).replace(/\s+/g, ' ').trim();
  const bWords = before ? before.split(' ') : [];
  const aWords = after ? after.split(' ') : [];
  const parts: string[] = [];
  if (bWords.length > 8) parts.push('...');
  parts.push(...bWords.slice(-8));
  parts.push(text.slice(index, index + matchLength));
  parts.push(...aWords.slice(0, 8));
  if (aWords.length > 8) parts.push('...');
  return parts.join(' ').trim();
}

function searchVirtualFiles(query: string, limit = 80): unknown[] {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const results: Array<{
    file: MdFile;
    score: number;
    excerpt: string;
    matchIndex: number;
    matchLength: number;
    matchOrdinal: number;
  }> = [];

  for (const file of virtualFiles) {
    const raw = getVirtualContent(file.relativePath) ?? '';
    const haystack = prepareHaystack(raw);
    const titleScore = normalizeForSearch(file.title).includes(q) ? 5 : 0;
    const fileScore = normalizeForSearch(file.fileName).includes(q) ? 4 : 0;
    let ordinal = 0;
    let nextNormIndex = 0;

    while (results.length < limit * 2) {
      const result = haystack.indexOfNormalized(q, nextNormIndex);
      if (!result) break;
      results.push({
        file,
        score: titleScore + fileScore + 3 - Math.min(ordinal, 20) / 100,
        excerpt: makeExcerpt(raw, result.match.index, result.match.matchLength),
        matchIndex: result.match.index,
        matchLength: result.match.matchLength,
        matchOrdinal: ordinal,
      });
      ordinal++;
      nextNormIndex = result.nextNormIndex;
      if (ordinal >= 8) break;
    }

    if (ordinal === 0 && (titleScore + fileScore) > 0) {
      results.push({
        file,
        score: titleScore + fileScore,
        excerpt: '',
        matchIndex: 0,
        matchLength: 0,
        matchOrdinal: 0,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(r => ({
    ...r.file,
    title: r.file.title,
    excerpt: r.excerpt,
    matchIndex: r.matchIndex,
    matchLength: r.matchLength,
    matchOrdinal: r.matchOrdinal,
  }));
}

// ── Test-mode: send workspace + first file ────────────────────────────────────

async function sendTestReady() {
  flatList = virtualFiles;
  workspaceTree = virtualTree;
  currentFile = virtualFiles[0]?.relativePath ?? null;

  send({
    command: 'readyAck',
    fileList: flatList,
    tree: workspaceTree,
    theme: 'dark',
    themeStyle: 'default',
    defaultExpanded: true,
    workspaceName: 'Test Workspace',
    workspacePath: 'test-workspace',
    recentWorkspaces: [],
    documentConversionEnabled: false,
    ...hostInfo(),
  });

  if (currentFile) {
    await sendTestContent(currentFile);
  }
}

async function sendTestContent(relativePath: string) {
  const raw = getVirtualContent(relativePath);
  if (raw === null) {
    send({
      command: 'renderContent',
      html: `<p>File not found: <code>${relativePath}</code></p>`,
      markdownSource: '',
      frontmatter: {},
      toc: [],
      filePath: relativePath,
      relativePath,
      title: relativePath,
      fileList: flatList,
      previewInfo: null,
    });
    return;
  }

  const { html, frontmatter, toc } = renderMarkdown(relativePath, raw);
  const fileInfo = findFileInfo(flatList, relativePath);

  send({
    command: 'renderContent',
    html,
    markdownSource: raw,
    frontmatter,
    toc,
    filePath: relativePath,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: flatList,
    previewInfo: null,
  });
}

// ── File-mode: real FileSystem API ────────────────────────────────────────────

function resetFileState() {
  activeHandle = null;
  activeWorkspacePath = '';
  activeWorkspaceName = '';
  currentFile = null;
  flatList = [];
  workspaceTree = null;
  searchIndex = null;
  singleFileHandle = null;
}

async function loadHandleWorkspace(handle: FileSystemDirectoryHandle, openFirstFile = true) {
  activeHandle = handle;
  activeWorkspaceName = handle.name;
  activeWorkspacePath = handle.name;
  currentFile = null;

  sendLoading('Loading workspace…');
  await BrowserRecentWorkspaces.save(activeWorkspaceName, activeWorkspacePath, handle);

  const { tree, flat } = await BrowserScanner.scan(handle);
  flatList = flat;
  workspaceTree = tree;
  searchIndex = new BrowserSearchIndex(handle);
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

  if (openFirstFile && flat.length > 0) {
    currentFile = flat[0].relativePath;
    await sendFileContent(currentFile);
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
      fileList: flatList,
      previewInfo: null,
    });
  }
}

async function sendFileContent(relativePath: string) {
  if (!activeHandle) return;
  let raw = '';
  try {
    raw = await readTextFile(activeHandle, relativePath);
  } catch {
    raw = `# File Not Found\n\nCould not read: **${relativePath}**`;
  }

  const { html, frontmatter, toc } = renderMarkdown(relativePath, raw);
  const rewrittenHtml = await rewriteMediaUrls(activeHandle, html, relativePath);
  const fileInfo = findFileInfo(flatList, relativePath);

  send({
    command: 'renderContent',
    html: rewrittenHtml,
    markdownSource: raw,
    frontmatter,
    toc,
    filePath: relativePath,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: flatList,
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
  singleFileHandle = handle;
  const fileName = handle.name;
  activeWorkspaceName = fileName;
  activeWorkspacePath = fileName;
  currentFile = fileName;

  const entry = buildMdFileFromName(fileName);
  flatList = [entry];
  workspaceTree = { name: fileName, path: '', children: [], files: [entry] };

  sendLoading('Loading file…');
  const recents = await BrowserRecentWorkspaces.load();
  send({
    command: 'readyAck',
    fileList: flatList,
    tree: workspaceTree,
    theme: 'dark',
    themeStyle: 'default',
    defaultExpanded: true,
    workspaceName: activeWorkspaceName,
    workspacePath: activeWorkspacePath,
    recentWorkspaces: recents,
    documentConversionEnabled: false,
    ...hostInfo(),
  });

  await sendSingleFileContent(fileName);
}

async function sendSingleFileContent(relativePath: string) {
  if (!singleFileHandle) {
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

  let raw = '';
  try {
    const file = await singleFileHandle.getFile();
    raw = await file.text();
  } catch {
    raw = `# File Not Found\n\nCould not read: **${relativePath}**`;
  }

  const { html, frontmatter, toc } = renderMarkdown(relativePath, raw);
  const fileInfo = findFileInfo(flatList, relativePath);

  send({
    command: 'renderContent',
    html,
    markdownSource: raw,
    frontmatter,
    toc,
    filePath: relativePath,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: flatList,
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
      case 'openExternal': {
        if (typeof msg.url === 'string' && /^https?:\/\//i.test(msg.url)) {
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
      try {
        const handle = msg.handle ?? (await pickDirectory());
        await loadHandleWorkspace(handle, msg.openFirstFile !== false);
      } catch (err) {
        console.warn('Folder selection cancelled or failed:', err);
      }
      break;
    }

    case 'openFile': {
      try {
        const handle = await pickFile();
        if (handle && handle.kind === 'file') {
          await loadSingleFileWorkspace(handle);
        }
      } catch (err) {
        console.warn('Single file selection cancelled or failed:', err);
      }
      break;
    }

    case 'openFileHandle': {
      try {
        const handle = msg.handle;
        if (handle && handle.kind === 'file') {
          await loadSingleFileWorkspace(handle);
        }
      } catch (err) {
        console.warn('Single file selection cancelled or failed:', err);
      }
      break;
    }

    case 'openRecentWorkspace': {
      const folderPath: string = msg.path;
      const handle = await BrowserRecentWorkspaces.getHandle(folderPath);
      if (!handle) { sendWorkspaceUnavailable(folderPath, 'missing'); return; }

      sendLoading('Checking permission…');
      const ok = await verifyPermission(handle);
      if (!ok) { sendWorkspaceUnavailable(folderPath, 'locked'); return; }

      await loadHandleWorkspace(handle, msg.openFirstFile !== false);
      break;
    }

    case 'deleteRecentWorkspace': {
      await BrowserRecentWorkspaces.remove(msg.path);
      await sendFileRecentWorkspacesChanged();
      break;
    }

    case 'closeWorkspace': {
      readyHandled = false;
      resetFileState();
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

    case 'openExternal': {
      if (typeof msg.url === 'string' && /^https?:\/\//i.test(msg.url)) {
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
