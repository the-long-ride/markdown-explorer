import type { MdFile, FolderNode } from '../../ui/src/types';
import { normalizeForSearch, prepareHaystack } from '../../ui/src/utils/unicodeSearch';
import type { BrowserSearchIndex } from './search-index';
import { readTextFile, writeFileHandle, writeTextFile } from './file-access';
import { resolveWorkspaceTextResourcePath } from './browser-host-utils';
import { makeExcerpt, searchVirtualFilesIncremental } from './web-test-search';
import { handleBrowserWorkspaceEntryCommand } from './workspace-entries';
import { resolveWorkspaceSearchItems } from './workspace-search-items';
import {
  MAX_WORKSPACE_SEARCH_RESULTS,
  WORKSPACE_SEARCH_BATCH_SIZE,
} from '../../ui/src/constants/limits';
import {
  isVirtualWorkspacePath,
  getVirtualWorkspaceEntryStore,
  getVirtualWorkspaceFileContent,
  setVirtualWorkspaceFileContent,
  renameVirtualWorkspaceContent,
  deleteVirtualWorkspaceContent,
} from './user-virtual-workspaces';
import { DemoEntryError } from './demo-entry-store';
import { handleWebInsightsHostCommand } from './web-insights-host';

interface FileUtilityRouterDeps {
  getSearchIndex: () => BrowserSearchIndex | null;
  getSingleFileHandle: () => FileSystemFileHandle | null;
  getFlatList: () => MdFile[];
  getActiveWorkspacePath: () => string;
  getWorkspaceTree: () => FolderNode | null;
  getActiveHandle: () => FileSystemDirectoryHandle | null;
  send: (message: unknown) => void;
  onRename?: (oldPath: string, newPath: string, origin: FileSystemDirectoryHandle | null) => void;
  refreshWorkspace: () => Promise<void>;
  searchGeneration?: { value: number };
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

function protocolWriteResult(result: Awaited<ReturnType<typeof writeTextFile>>) {
  return result.reason === 'io-error'
    ? { ...result, reason: 'write-failed' as const }
    : result;
}

export async function handleWebFileUtilityMessage(
  msg: any,
  deps: FileUtilityRouterDeps,
): Promise<boolean> {
  const activeWorkspacePath = deps.getActiveWorkspacePath();

  if (isVirtualWorkspacePath(activeWorkspacePath)) {
    if (await handleWebInsightsHostCommand(msg, {
      activeWorkspacePath,
      getFlatList: deps.getFlatList,
      getFileContent: (path) => getVirtualWorkspaceFileContent(activeWorkspacePath, path),
      send: deps.send,
    })) return true;

    switch (msg.command) {
      case 'createWorkspaceEntry': {
        const store = getVirtualWorkspaceEntryStore(activeWorkspacePath);
        try {
          const createdPath = store.create(msg.parentPath, msg.name, msg.kind);
          if (msg.kind === 'file') {
            setVirtualWorkspaceFileContent(activeWorkspacePath, createdPath, '');
          }
          await deps.refreshWorkspace();
          deps.send({ command: 'createWorkspaceEntryResult', requestId: msg.requestId, ok: true, path: createdPath, kind: msg.kind });
        } catch (error) {
          deps.send({ command: 'createWorkspaceEntryResult', requestId: msg.requestId, ok: false, reason: error instanceof DemoEntryError ? error.reason : 'failed' });
        }
        return true;
      }
      case 'renameWorkspaceEntry': {
        const store = getVirtualWorkspaceEntryStore(activeWorkspacePath);
        try {
          const newPath = store.rename(msg.path, msg.name, msg.kind);
          renameVirtualWorkspaceContent(activeWorkspacePath, msg.path, newPath);
          deps.onRename?.(msg.path, newPath, null);
          await deps.refreshWorkspace();
          deps.send({ command: 'renameWorkspaceEntryResult', requestId: msg.requestId, ok: true, path: newPath, oldPath: msg.path, kind: msg.kind });
        } catch (error) {
          deps.send({ command: 'renameWorkspaceEntryResult', requestId: msg.requestId, ok: false, reason: error instanceof DemoEntryError ? error.reason : 'failed' });
        }
        return true;
      }
      case 'deleteWorkspaceEntries': {
        const store = getVirtualWorkspaceEntryStore(activeWorkspacePath);
        const deleted: string[] = [];
        const failed: { path: string; reason: any }[] = [];
        for (const path of Array.isArray(msg.paths) ? msg.paths : []) {
          try {
            deleted.push(store.delete(path));
          } catch (error) {
            failed.push({ path: String(path), reason: error instanceof DemoEntryError ? error.reason : 'failed' });
          }
        }
        deleteVirtualWorkspaceContent(activeWorkspacePath, deleted);
        if (deleted.length > 0) {
          await deps.refreshWorkspace();
        }
        deps.send({ command: 'deleteWorkspaceEntriesResult', requestId: msg.requestId, mode: 'permanent', deleted, failed });
        return true;
      }
      case 'saveDocument': {
        const requestedPath = String(msg.filePath || '');
        const source = String(msg.source ?? '');
        setVirtualWorkspaceFileContent(activeWorkspacePath, requestedPath, source);
        await deps.refreshWorkspace();
        deps.send({
          command: 'saveDocumentResult',
          requestId: msg.requestId,
          filePath: requestedPath,
          ok: true,
          revision: String(source.length),
        });
        return true;
      }
      case 'searchWorkspace': {
        const rawQuery = String(msg.query || '').trim();
        const generation = deps.searchGeneration ? ++deps.searchGeneration.value : 0;
        const isCurrent = () => !deps.searchGeneration || generation === deps.searchGeneration.value;
        const summary = await searchVirtualFilesIncremental(rawQuery, {
          matchCase: Boolean(msg.matchCase),
          limit: MAX_WORKSPACE_SEARCH_RESULTS,
          batchSize: WORKSPACE_SEARCH_BATCH_SIZE,
          files: deps.getFlatList(),
          getContent: (path) => getVirtualWorkspaceFileContent(activeWorkspacePath, path),
          shouldCancel: () => !isCurrent(),
          onBatch: (results) => {
            if (isCurrent()) deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results, done: false });
          },
        });
        if (isCurrent()) deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results: [], done: true, ...summary });
        return true;
      }
      case 'loadSearchPreview': {
        const item = deps.getFlatList().find((candidate) => candidate.fsPath === String(msg.filePath || ''));
        const markdownSource = item ? getVirtualWorkspaceFileContent(activeWorkspacePath, item.relativePath) : null;
        deps.send(markdownSource === null
          ? { command: 'searchPreviewResult', requestId: msg.requestId, ok: false, filePath: msg.filePath, reason: 'outside-workspace' }
          : { command: 'searchPreviewResult', requestId: msg.requestId, ok: true, filePath: item!.fsPath, markdownSource });
        return true;
      }
      case 'readWorkspaceTextResource': {
        const resolvedPath = resolveWorkspaceTextResourcePath(
          String(msg.documentPath || ''),
          String(msg.resourcePath || ''),
        );
        const content = resolvedPath ? getVirtualWorkspaceFileContent(activeWorkspacePath, resolvedPath) : null;
        if (content !== null) {
          deps.send({ command: 'workspaceTextResourceResult', requestId: msg.requestId, ok: true, content, resolvedPath });
        } else {
          deps.send({ command: 'workspaceTextResourceResult', requestId: msg.requestId, ok: false, reason: 'missing' });
        }
        return true;
      }
      default:
        break;
    }
  }

  if (await handleBrowserWorkspaceEntryCommand(msg, {
    activeHandle: deps.getActiveHandle(),
    send: deps.send,
    onRename: deps.onRename,
    refreshWorkspace: deps.refreshWorkspace,
  })) return true;

  if (await handleWebInsightsHostCommand(msg, {
    activeHandle: deps.getActiveHandle(),
    singleFileHandle: deps.getSingleFileHandle(),
    activeWorkspacePath,
    getFlatList: deps.getFlatList,
    send: deps.send,
  })) return true;

  const flatList = deps.getFlatList();

  switch (msg.command) {
    case 'saveDocument': {
      const requestedPath = String(msg.filePath || '');
      const source = String(msg.source ?? '');
      const expectedRevision = typeof msg.expectedRevision === 'string' ? msg.expectedRevision : null;
      const force = Boolean(msg.force);
      const singleFileHandle = deps.getSingleFileHandle();
      const activeHandle = deps.getActiveHandle();
      const item = flatList.find((candidate) => candidate.fsPath === requestedPath || candidate.relativePath === requestedPath);
      let result;
      if (singleFileHandle && item && (singleFileHandle.name === item.fileName || flatList.length === 1)) {
        result = await writeFileHandle(singleFileHandle, source, expectedRevision, force);
      } else if (activeHandle && item) {
        result = await writeTextFile(activeHandle, item.relativePath, source, expectedRevision, force);
      } else {
        result = { ok: false as const, reason: activeHandle || singleFileHandle ? 'outside-workspace' as const : 'read-only' as const };
      }
      deps.send({
        command: 'saveDocumentResult',
        requestId: msg.requestId,
        filePath: requestedPath,
        ...protocolWriteResult(result as Awaited<ReturnType<typeof writeTextFile>>),
      });
      return true;
    }
    case 'searchWorkspace': {
      const rawQuery = String(msg.query || '').trim();
      const matchCase = Boolean(msg.matchCase);
      const query = matchCase ? rawQuery : normalizeForSearch(rawQuery);
      const searchIndex = deps.getSearchIndex();
      const searchItems = resolveWorkspaceSearchItems(msg.items, flatList);
      const singleFileHandle = deps.getSingleFileHandle();
      const generation = deps.searchGeneration ? ++deps.searchGeneration.value : 0;
      const isCurrent = () => !deps.searchGeneration || generation === deps.searchGeneration.value;
      if (searchIndex) {
        try {
          const summary = await searchIndex.searchIncremental(query, searchItems, {
            matchCase,
            limit: MAX_WORKSPACE_SEARCH_RESULTS,
            batchSize: WORKSPACE_SEARCH_BATCH_SIZE,
            shouldCancel: () => !isCurrent(),
            onBatch: results => {
              if (isCurrent()) deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results, done: false });
            },
          });
          if (isCurrent()) deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results: [], done: true, ...summary });
        } catch (error) {
          if (isCurrent()) deps.send({
            command: 'workspaceSearchResults',
            requestId: msg.requestId,
            results: [],
            done: true,
            total: 0,
            truncated: false,
            cancelled: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (singleFileHandle && searchItems.length > 0) {
        try {
          const results = await searchSingleFile(query, singleFileHandle, searchItems[0], matchCase);
          if (isCurrent()) deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results, done: true, total: results.length, truncated: false, cancelled: false });
        } catch (error) {
          console.error('Failed to search single file:', error);
          if (isCurrent()) deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results: [], done: true, total: 0, truncated: false, cancelled: false });
        }
      } else {
        if (isCurrent()) deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results: [], done: true, total: 0, truncated: false, cancelled: false });
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
