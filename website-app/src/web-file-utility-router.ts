import type { MdFile, FolderNode } from '../../ui/src/types';
import { normalizeForSearch, prepareHaystack } from '../../ui/src/utils/unicodeSearch';
import type { BrowserSearchIndex } from '../../chromium-xtension/src/search-index';
import { readTextFile } from '../../chromium-xtension/src/file-access';
import { resolveWorkspaceTextResourcePath } from '../../chromium-xtension/src/chrome-host-utils';
import { makeExcerpt } from './web-test-search';

interface FileUtilityRouterDeps {
  getSearchIndex: () => BrowserSearchIndex | null;
  getSingleFileHandle: () => FileSystemFileHandle | null;
  getFlatList: () => MdFile[];
  getActiveWorkspacePath: () => string;
  getWorkspaceTree: () => FolderNode | null;
  getActiveHandle: () => FileSystemDirectoryHandle | null;
  send: (message: unknown) => void;
}

async function searchSingleFile(
  query: string,
  handle: FileSystemFileHandle,
  item: MdFile,
  matchCase = false,
): Promise<unknown[]> {
  const file = await handle.getFile();
  const raw = await file.text();
  const haystack = prepareHaystack(raw);
  const results: unknown[] = [];
  const title = item.title;
  const fileName = item.fileName;
  const relativePath = item.relativePath;
  const includesNeedle = (value: string) => matchCase
    ? value.includes(query)
    : normalizeForSearch(value).includes(query);
  const titleScore = includesNeedle(title) ? 5 : 0;
  const fileNameScore = includesNeedle(fileName) ? 4 : 0;
  const baseScore = titleScore + fileNameScore;
  let nextSearchIndex = 0;
  let ordinal = 0;

  while (results.length < 8) {
    const rawIndex = matchCase ? raw.indexOf(query, nextSearchIndex) : -1;
    const normalizedResult = matchCase ? null : haystack.indexOfNormalized(query, nextSearchIndex);
    if (matchCase ? rawIndex === -1 : !normalizedResult) break;
    const matchIndex = matchCase ? rawIndex : normalizedResult!.match.index;
    const matchLength = matchCase ? query.length : normalizedResult!.match.matchLength;
    results.push({
      ...item,
      title,
      fileName,
      relativePath,
      excerpt: makeExcerpt(raw, matchIndex, matchLength),
      matchIndex,
      matchOrdinal: ordinal,
      matchLength,
    });
    ordinal += 1;
    nextSearchIndex = matchCase ? matchIndex + matchLength : normalizedResult!.nextNormIndex;
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
  return results;
}

export async function handleWebFileUtilityMessage(
  msg: any,
  deps: FileUtilityRouterDeps,
): Promise<boolean> {
  const flatList = deps.getFlatList();

  switch (msg.command) {
    case 'searchWorkspace': {
      const rawQuery = String(msg.query || '').trim();
      const matchCase = Boolean(msg.matchCase);
      const query = matchCase ? rawQuery : normalizeForSearch(rawQuery);
      const searchIndex = deps.getSearchIndex();
      const singleFileHandle = deps.getSingleFileHandle();
      if (searchIndex) {
        const results = await searchIndex.search(query, flatList, 80, { matchCase });
        deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results });
      } else if (singleFileHandle && flatList.length > 0) {
        try {
          const results = await searchSingleFile(query, singleFileHandle, flatList[0], matchCase);
          deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results });
        } catch (error) {
          console.error('Failed to search single file:', error);
          deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results: [] });
        }
      } else {
        deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results: [] });
      }
      return true;
    }
    case 'loadSearchPreview': {
      const item = flatList.find((candidate) => candidate.fsPath === String(msg.filePath || ''));
      if (!item) {
        deps.send({ command: 'searchPreviewResult', requestId: msg.requestId, ok: false, filePath: msg.filePath, reason: 'outside-workspace' });
        return true;
      }
      try {
        const searchIndex = deps.getSearchIndex();
        const singleFileHandle = deps.getSingleFileHandle();
        const markdownSource = searchIndex
          ? await searchIndex.read(item.relativePath)
          : singleFileHandle && flatList[0]?.fsPath === item.fsPath
            ? await (await singleFileHandle.getFile()).text()
            : null;
        deps.send(markdownSource === null
          ? { command: 'searchPreviewResult', requestId: msg.requestId, ok: false, filePath: item.fsPath, reason: 'missing' }
          : { command: 'searchPreviewResult', requestId: msg.requestId, ok: true, filePath: item.fsPath, markdownSource });
      } catch {
        deps.send({ command: 'searchPreviewResult', requestId: msg.requestId, ok: false, filePath: item.fsPath, reason: 'missing' });
      }
      return true;
    }
    case 'loadWorkspaceSearchIndexes': {
      const activeWorkspacePath = deps.getActiveWorkspacePath();
      const tabs = (Array.isArray(msg.tabs) ? msg.tabs : []).flatMap((tab: any) => {
        const tabId = String(tab?.tabId || '');
        const workspacePath = String(tab?.workspacePath || '');
        if (!tabId || !workspacePath || workspacePath !== activeWorkspacePath) return [];
        return [{
          tabId,
          workspacePath: activeWorkspacePath,
          fileList: flatList,
          tree: deps.getWorkspaceTree(),
        }];
      });
      if (tabs.length > 0) deps.send({ command: 'workspaceSearchIndexLoaded', tabs });
      return true;
    }
    case 'indexWorkspaceSearchItems':
      deps.getSearchIndex()?.prime(msg.items || []);
      return true;
    case 'readWorkspaceTextResource': {
      const resolvedPath = resolveWorkspaceTextResourcePath(
        String(msg.documentPath || ''),
        String(msg.resourcePath || ''),
      );
      const activeHandle = deps.getActiveHandle();
      if (!activeHandle || !resolvedPath) {
        deps.send({
          command: 'workspaceTextResourceResult',
          requestId: msg.requestId,
          ok: false,
          reason: 'outside-workspace',
        });
        return true;
      }
      try {
        const content = await readTextFile(activeHandle, resolvedPath);
        deps.send({
          command: 'workspaceTextResourceResult',
          requestId: msg.requestId,
          ok: true,
          content,
          resolvedPath,
        });
      } catch {
        deps.send({
          command: 'workspaceTextResourceResult',
          requestId: msg.requestId,
          ok: false,
          reason: 'missing',
        });
      }
      return true;
    }
    case 'openExternal':
      if (typeof msg.url === 'string' && /^(?:https?|file):\/\//i.test(msg.url)) {
        window.open(msg.url, '_blank');
      }
      return true;
    default:
      return false;
  }
}
