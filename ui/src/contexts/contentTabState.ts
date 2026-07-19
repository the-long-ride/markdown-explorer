import { collectSelectedFolderPaths, reconcileScopeFocusPaths } from './scope-focus-reconcile.js';
import { HtmlRenderer } from '../markdown/renderer';
import { parse } from '../markdown/parser';
import { rewriteRelativeMediaUrls } from '../markdown/mediaUrls';
import type {
  ContentTab,
  FolderNode,
  MdFile,
  RenderContentMessage,
} from '../types';
import { normalizePathKey } from './appStateModel';
import type { AppState } from './appStateModel';

export function getWorkspaceScopeKey(workspacePath: string | undefined, workspaceName: string): string {
  return workspacePath || workspaceName || 'default';
}

export function getPathFileName(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath || 'Document';
}

export function stripMarkdownExtension(fileName: string): string {
  const extIndex = fileName.lastIndexOf('.');
  return extIndex > 0 ? fileName.slice(0, extIndex) : fileName;
}

export function findFileInfo(fileList: readonly MdFile[], filePath: string): MdFile | undefined {
  const target = normalizePathKey(filePath);
  return fileList.find(
    (file) =>
      normalizePathKey(file.fsPath) === target ||
      normalizePathKey(file.relativePath) === target,
  );
}

export function upsertContentTab(tabs: readonly ContentTab[], tab: ContentTab): ContentTab[] {
  const existingIndex = tabs.findIndex(
    (item) => normalizePathKey(item.filePath) === normalizePathKey(tab.filePath),
  );
  if (existingIndex === -1) return [...tabs, tab];
  return tabs.map((item, index) => (index === existingIndex ? tab : item));
}

export function reorderContentTabs(
  tabs: readonly ContentTab[],
  sourcePath: string,
  targetPath: string,
): ContentTab[] {
  const sourceIndex = tabs.findIndex((tab) => normalizePathKey(tab.filePath) === normalizePathKey(sourcePath));
  const targetIndex = tabs.findIndex((tab) => normalizePathKey(tab.filePath) === normalizePathKey(targetPath));
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return tabs as ContentTab[];
  const nextTabs = [...tabs];
  const [source] = nextTabs.splice(sourceIndex, 1);
  nextTabs.splice(targetIndex, 0, source);
  return nextTabs;
}

export interface RenderedMarkdown {
  html: string;
  frontmatter: Record<string, string>;
  toc: Array<{ level: number; text: string; id: string }>;
}

export function renderMarkdownClientSide(
  markdownSource: string | null | undefined,
  filePath: string | null,
  isMdx?: boolean,
): RenderedMarkdown {
  const empty = { html: '', frontmatter: {}, toc: [] };
  if (!markdownSource) return empty;
  try {
    const result = parse(markdownSource, isMdx ?? false);
    const renderer = new HtmlRenderer({ theme: 'auto', isMdx: isMdx ?? false });
    const rendered = renderer.render(result.tokens);
    const html = rewriteRelativeMediaUrls(rendered.html, filePath ?? '');
    return { html, frontmatter: result.frontmatter, toc: rendered.toc };
  } catch (err) {
    console.error('Client-side markdown rendering failed:', err);
    return { html: `<pre>${markdownSource}</pre>`, frontmatter: {}, toc: [] };
  }
}

export function createContentTabFromMessage(
  msg: RenderContentMessage,
  fileList: readonly MdFile[],
): ContentTab {
  const fileInfo = findFileInfo(fileList, msg.filePath);
  const relativePath = msg.relativePath || fileInfo?.relativePath || getPathFileName(msg.filePath);
  const fileName = fileInfo?.fileName || getPathFileName(relativePath || msg.filePath);
  const title = msg.title || fileInfo?.title || stripMarkdownExtension(fileName);
  const isMdx = msg.filePath ? msg.filePath.endsWith('.mdx') : false;
  const rendered = msg.markdownSource
    ? renderMarkdownClientSide(msg.markdownSource, msg.filePath, isMdx)
    : { html: msg.html, frontmatter: msg.frontmatter, toc: msg.toc };
  return {
    filePath: msg.filePath,
    relativePath,
    fileName,
    title,
    contentHtml: rendered.html,
    markdownSource: msg.markdownSource ?? null,
    frontmatter: rendered.frontmatter,
    toc: rendered.toc,
    previewInfo: msg.previewInfo ?? null,
  };
}

export function createContentTabFromState(state: AppState): ContentTab | null {
  if (!state.currentFile) return null;
  const fileInfo = findFileInfo(state.fileList, state.currentFile);
  const relativePath = state.relativePath || fileInfo?.relativePath || getPathFileName(state.currentFile);
  const fileName = fileInfo?.fileName || getPathFileName(relativePath || state.currentFile);
  return {
    filePath: state.currentFile,
    relativePath,
    fileName,
    title: fileInfo?.title || stripMarkdownExtension(fileName),
    contentHtml: state.contentHtml,
    markdownSource: state.markdownSource,
    frontmatter: state.frontmatter,
    toc: state.toc,
    previewInfo: state.previewInfo,
  };
}

export function applyContentTab(state: AppState, tab: ContentTab, tabs = state.contentTabs): AppState {
  return {
    ...state,
    currentFile: tab.filePath,
    contentHtml: tab.contentHtml,
    markdownSource: tab.markdownSource,
    frontmatter: tab.frontmatter,
    toc: tab.toc,
    relativePath: tab.relativePath,
    isLoading: false,
    loadingLabel: '',
    loadingDetail: '',
    previewInfo: tab.previewInfo ?? null,
    notFoundHref: null,
    workspaceUnavailablePath: null,
    workspaceUnavailableReason: null,
    contentTabs: tabs as ContentTab[],
    activeContentTabPath: tab.filePath,
    renderVersion: state.renderVersion + 1,
  };
}

export function clearContentTabs(state: AppState): AppState {
  return {
    ...state,
    currentFile: null,
    contentHtml: '',
    markdownSource: null,
    frontmatter: {},
    toc: [],
    previewInfo: null,
    relativePath: '',
    isLoading: false,
    notFoundHref: null,
    contentTabs: [],
    activeContentTabPath: null,
    renderVersion: state.renderVersion + 1,
  };
}

export function applyContentTabsFallback(
  state: AppState,
  tabs: readonly ContentTab[],
  preferredPath?: string,
): AppState {
  const nextTabs = tabs as ContentTab[];
  if (nextTabs.length === 0) return clearContentTabs(state);

  const activePath = normalizePathKey(state.activeContentTabPath ?? '');
  const activeTab = nextTabs.find(
    (item) => normalizePathKey(item.filePath) === activePath,
  );
  if (activeTab) {
    return {
      ...state,
      contentTabs: nextTabs,
    };
  }

  const preferredTab = preferredPath
    ? nextTabs.find(
        (item) => normalizePathKey(item.filePath) === normalizePathKey(preferredPath),
      )
    : null;
  return applyContentTab(state, preferredTab ?? nextTabs[nextTabs.length - 1], nextTabs);
}

export function refreshContentTabMetadata(
  tabs: readonly ContentTab[],
  fileList: readonly MdFile[],
): ContentTab[] {
  if (tabs.length === 0 || fileList.length === 0) return tabs as ContentTab[];
  return tabs.map((tab) => {
    const fileInfo = findFileInfo(fileList, tab.filePath);
    if (!fileInfo) return tab;
    return {
      ...tab,
      fileName: fileInfo.fileName,
      title: fileInfo.title,
      relativePath: fileInfo.relativePath,
    };
  });
}

export function reconcileScopeFocusSetting({
  scopeFocus,
  scopeKey,
  previousFileList,
  nextFileList,
  previousTree,
  includeNewFiles,
}: {
  scopeFocus: Record<string, string[]> | undefined;
  scopeKey: string;
  previousFileList: readonly MdFile[];
  nextFileList: readonly MdFile[];
  previousTree: FolderNode | null;
  includeNewFiles: boolean;
}): Record<string, string[]> | undefined {
  if (!scopeFocus || !Object.prototype.hasOwnProperty.call(scopeFocus, scopeKey)) {
    return scopeFocus;
  }

  const savedScopePaths = scopeFocus[scopeKey] ?? [];
  const previousFilePaths = previousFileList.map((file) => file.fsPath);
  const nextFilePaths = nextFileList.map((file) => file.fsPath);
  const previousFilePathSet = new Set(previousFilePaths);
  const selectedFolderPaths = collectSelectedFolderPaths(
    previousTree,
    new Set(savedScopePaths.filter((filePath) => previousFilePathSet.has(filePath))),
  );
  const reconciledPaths = reconcileScopeFocusPaths({
    savedScopePaths,
    previousFilePaths: includeNewFiles ? previousFilePaths : nextFilePaths,
    nextFilePaths,
    selectedFolderPaths,
  });

  if (reconciledPaths === null) return scopeFocus;

  const nextScopeFocus = { ...scopeFocus };
  if (nextFilePaths.length > 0 && reconciledPaths.length >= nextFilePaths.length) {
    delete nextScopeFocus[scopeKey];
  } else {
    nextScopeFocus[scopeKey] = reconciledPaths;
  }
  return nextScopeFocus;
}
