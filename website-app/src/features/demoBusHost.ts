// =============================================================================
// website-app/src/features/demoBusHost.ts
// Lightweight in-memory web bus host for the interactive Feature Demo Studio.
// Never mutates the user's real IndexedDB or virtual-workspace localStorage.
// =============================================================================

import type { HostMessage, RecentWorkspace, WebviewMessage, WorkspaceSearchResult } from '../../../ui/src/types';
import { renderMarkdown } from '../markdown-renderer';
import { getFeatureDemoItem, resolveFeatureSlug, type FeatureDemoSlug } from './demoCatalog';
import {
  DEMO_DOCS,
  DEMO_FILES,
  DEMO_RECENT_WORKSPACES,
  DEMO_TREE,
  DEMO_WORKSPACE_NAME,
  DEMO_WORKSPACE_PATH,
  normalizeDemoDocPath,
} from './demoMarkdownFixtures';
import {
  compareDemoGitRevisions,
  listDemoDocumentHistory,
  listDemoRepositoryHistory,
  listDemoRevisionFiles,
  readDemoGitRevision,
  readDemoRevisionFile,
} from './demoGitFixtures';
import { version as appVersion } from '../../package.json';

export interface DemoHostController {
  selectDoc: (path: string) => void;
  applyFeaturePreset: (slug: FeatureDemoSlug) => void;
  getActiveDocPath: () => string;
  dispose: () => void;
}

export interface InstallDemoBusHostOptions {
  initialSlug?: FeatureDemoSlug;
  onSlugChange?: (slug: FeatureDemoSlug) => void;
}

type WebBusTarget = EventTarget & { send?: (msg: WebviewMessage) => void };

function searchInDocs(
  docs: Map<string, string>,
  query: string,
  matchCase: boolean,
): WorkspaceSearchResult[] {
  const needle = matchCase ? query : query.toLowerCase();
  if (!needle) return [];
  const results: WorkspaceSearchResult[] = [];
  for (const file of DEMO_FILES) {
    const source = docs.get(file.relativePath) ?? '';
    const haystack = matchCase ? source : source.toLowerCase();
    let offset = 0;
    let matchOrdinal = 0;
    while (offset < haystack.length && results.length < 60) {
      const idx = haystack.indexOf(needle, offset);
      if (idx === -1) break;
      const start = Math.max(0, idx - 36);
      const end = Math.min(source.length, idx + query.length + 56);
      const lineNumber = source.slice(0, idx).split('\n').length;
      results.push({
        fsPath: file.fsPath,
        title: file.title,
        fileName: file.fileName,
        relativePath: file.relativePath,
        excerpt: source.slice(start, end).replace(/\s+/g, ' ').trim(),
        matchIndex: idx,
        matchOrdinal,
        matchLength: query.length,
        lineNumber,
      });
      matchOrdinal += 1;
      offset = idx + Math.max(1, query.length);
    }
  }
  return results;
}

function triggerDemoDownload(fileName: string, mimeType: string, dataBase64: string): void {
  if (typeof document === 'undefined' || typeof atob !== 'function') return;
  const binary = atob(dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function docForWorkspacePath(workspacePath: string): string {
  const normalized = workspacePath.toLowerCase();
  if (normalized.includes('benchmark')) return 'docs/metrics-benchmarks.md';
  if (normalized.includes('release')) return 'docs/release-playbook.md';
  return 'docs/architecture-overview.md';
}

export function installDemoBusHost(options: InstallDemoBusHostOptions = {}): DemoHostController {
  const initialSlug = options.initialSlug ?? 'workspace';
  const docSources = new Map<string, string>(
    Object.values(DEMO_DOCS).map((doc) => [doc.path, doc.markdown]),
  );
  let activeDocPath = normalizeDemoDocPath(getFeatureDemoItem(initialSlug).defaultDocPath);
  let activeTheme: 'dark' | 'light' = 'dark';
  let activeWorkspaceName = DEMO_WORKSPACE_NAME;
  let activeWorkspacePath = DEMO_WORKSPACE_PATH;
  let recentWorkspaces: RecentWorkspace[] = DEMO_RECENT_WORKSPACES.map((item) => ({
    name: item.name,
    path: item.path,
    lastOpened: item.lastOpened,
  }));

  const win = window as Window & { __webBus?: WebBusTarget; __MDE_PLATFORM__?: string };
  const bus: WebBusTarget = win.__webBus instanceof EventTarget ? win.__webBus : new EventTarget();
  win.__MDE_PLATFORM__ = 'web';
  win.__webBus = bus;

  const emit = (msg: HostMessage) => {
    bus.dispatchEvent(new CustomEvent('host-message', { detail: msg }));
  };

  const renderAndSendDoc = (rawPath: string) => {
    const path = normalizeDemoDocPath(rawPath);
    activeDocPath = path;
    const fixture = DEMO_DOCS[path];
    const markdown = docSources.get(path) ?? fixture.markdown;
    const rendered = renderMarkdown(path, markdown, activeTheme);
    emit({
      command: 'renderContent',
      filePath: path,
      relativePath: path,
      title: fixture.title,
      html: rendered.html,
      markdownSource: markdown,
      frontmatter: rendered.frontmatter,
      toc: rendered.toc,
      fileList: DEMO_FILES,
      previewInfo: null,
      documentWrite: { supported: true, revision: String(markdown.length) },
    });
  };

  const switchInMemoryWorkspace = (nextPath: string, nextName?: string, docOverride?: string) => {
    activeWorkspacePath = nextPath;
    activeWorkspaceName = nextName || nextPath.split(/[/\\]/).filter(Boolean).pop() || DEMO_WORKSPACE_NAME;
    const existing = recentWorkspaces.filter((w) => w.path !== activeWorkspacePath);
    recentWorkspaces = [
      { name: activeWorkspaceName, path: activeWorkspacePath, lastOpened: Date.now() },
      ...existing,
    ];
    emit({
      command: 'workspaceFilesChanged',
      fileList: DEMO_FILES,
      tree: { ...DEMO_TREE, name: activeWorkspaceName, path: activeWorkspacePath },
      workspaceName: activeWorkspaceName,
      workspacePath: activeWorkspacePath,
      documentConversionEnabled: false,
    });
    emit({ command: 'recentWorkspacesChanged', recentWorkspaces });
    renderAndSendDoc(docOverride ?? docForWorkspacePath(activeWorkspacePath));
  };

  const sendReadyAck = () => {
    emit({
      command: 'readyAck',
      fileList: DEMO_FILES,
      tree: { ...DEMO_TREE, name: activeWorkspaceName, path: activeWorkspacePath },
      theme: activeTheme,
      themeStyle: 'raw-grid',
      defaultExpanded: true,
      workspaceName: activeWorkspaceName,
      workspacePath: activeWorkspacePath,
      recentWorkspaces,
      appVersion,
      appRuntime: 'web',
      hostPlatform: 'unknown',
      hostArch: 'unknown',
      canInstallUpdates: false,
      documentConversionEnabled: false,
    });
    renderAndSendDoc(activeDocPath);
  };

  const handleWebviewMessage = (msg: WebviewMessage) => {
    switch (msg.command) {
      case 'ready':
        sendReadyAck();
        break;
      case 'navigate':
        renderAndSendDoc(msg.path);
        break;
      case 'refresh':
        renderAndSendDoc(activeDocPath);
        break;
      case 'updateAppearance':
        if (msg.theme === 'dark' || msg.theme === 'light') {
          activeTheme = msg.theme;
          renderAndSendDoc(activeDocPath);
        }
        break;
      case 'openRecentWorkspace':
        switchInMemoryWorkspace(msg.path);
        break;
      case 'deleteRecentWorkspace':
        recentWorkspaces = recentWorkspaces.filter((item) => item.path !== msg.path);
        emit({ command: 'recentWorkspacesChanged', recentWorkspaces });
        break;
      case 'createVirtualWorkspace':
        switchInMemoryWorkspace(
          '/workspace/virtual-scratchpad',
          msg.name || 'virtual-scratchpad',
          'docs/architecture-overview.md',
        );
        break;
      case 'openFolder':
        switchInMemoryWorkspace(DEMO_WORKSPACE_PATH, DEMO_WORKSPACE_NAME, activeDocPath);
        break;
      case 'openFile':
        renderAndSendDoc(activeDocPath);
        break;
      case 'searchWorkspace':
        emit({
          command: 'workspaceSearchResults',
          requestId: msg.requestId,
          results: searchInDocs(docSources, msg.query, Boolean(msg.matchCase)),
          done: true,
        });
        break;
      case 'loadSearchPreview': {
        const path = normalizeDemoDocPath(msg.filePath);
        emit({
          command: 'searchPreviewResult',
          requestId: msg.requestId,
          ok: true,
          filePath: path,
          markdownSource: docSources.get(path) ?? DEMO_DOCS[path].markdown,
        });
        break;
      }
      case 'saveDocument': {
        const path = normalizeDemoDocPath(msg.filePath);
        docSources.set(path, msg.source);
        emit({
          command: 'saveDocumentResult',
          requestId: msg.requestId,
          filePath: path,
          ok: true,
          revision: String(msg.source.length),
        });
        if (path === activeDocPath) renderAndSendDoc(path);
        break;
      }
      case 'readWorkspaceTextResource': {
        const path = normalizeDemoDocPath(msg.resourcePath);
        emit({
          command: 'workspaceTextResourceResult',
          requestId: msg.requestId,
          ok: true,
          resolvedPath: path,
          content: docSources.get(path) ?? DEMO_DOCS[path].markdown,
        });
        break;
      }
      case 'saveExportFile':
        triggerDemoDownload(msg.fileName, msg.mimeType, msg.dataBase64);
        break;
      case 'copyCode':
        void navigator.clipboard?.writeText?.(msg.text).catch(() => {});
        break;
      case 'listDesktopFonts':
        emit({ command: 'desktopFontsResult', requestId: msg.requestId, fonts: [] });
        break;
      case 'listDocumentHistory':
        emit({
          command: 'documentHistoryResult',
          requestId: msg.requestId,
          ok: true,
          revisions: listDemoDocumentHistory(msg.filePath, msg.limit),
        });
        break;
      case 'readGitRevision':
        emit({
          command: 'gitRevisionResult',
          requestId: msg.requestId,
          ok: true,
          snapshot: readDemoGitRevision(msg.oid, msg.path),
        });
        break;
      case 'compareGitRevisions': {
        const comparison = compareDemoGitRevisions(msg.left, msg.right, docSources);
        emit({
          command: 'gitComparisonResult',
          requestId: msg.requestId,
          ok: true,
          ...comparison,
        });
        break;
      }
      case 'listRepositoryHistory':
        emit({
          command: 'repositoryHistoryResult',
          requestId: msg.requestId,
          ok: true,
          commits: listDemoRepositoryHistory({
            limit: msg.limit,
            offset: msg.offset,
            before: msg.before,
          }),
        });
        break;
      case 'listRevisionFiles':
        emit({
          command: 'revisionFilesResult',
          requestId: msg.requestId,
          ok: true,
          files: listDemoRevisionFiles(msg.oid),
        });
        break;
      case 'readRevisionFile':
        emit({
          command: 'revisionFileResult',
          requestId: msg.requestId,
          ok: true,
          snapshot: readDemoRevisionFile(msg.oid, msg.path),
        });
        break;
      default:
        break;
    }
  };

  bus.send = handleWebviewMessage;
  const onBusEvent = (event: Event) => {
    const detail = (event as CustomEvent<WebviewMessage>).detail;
    if (detail) handleWebviewMessage(detail);
  };
  bus.addEventListener('webview-message', onBusEvent);

  const onWindowMessage = (event: MessageEvent) => {
    const data = event.data as { type?: unknown; feature?: unknown } | null;
    if (!data || data.type !== 'mde-demo-select' || typeof data.feature !== 'string') return;
    const nextSlug = resolveFeatureSlug(data.feature);
    renderAndSendDoc(getFeatureDemoItem(nextSlug).defaultDocPath);
    options.onSlugChange?.(nextSlug);
  };
  window.addEventListener('message', onWindowMessage);

  return {
    selectDoc: renderAndSendDoc,
    applyFeaturePreset(slug: FeatureDemoSlug) {
      renderAndSendDoc(getFeatureDemoItem(slug).defaultDocPath);
    },
    getActiveDocPath: () => activeDocPath,
    dispose() {
      bus.removeEventListener('webview-message', onBusEvent);
      window.removeEventListener('message', onWindowMessage);
    },
  };
}
