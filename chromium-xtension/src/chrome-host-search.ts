import type { FolderNode, MdFile } from '../../ui/src/types';
import type { BrowserSearchIndex } from './search-index';
import { writeTextFile } from './file-access';
import { handleChromeExportHostCommand } from './chrome-host-export';
import { filterSearchIndexTabs, isValidExternalUrl, normalizeSearchQuery, resolveWorkspaceTextResourcePath } from './chrome-host-utils';
import { handleBrowserInsightsHostCommand } from './insights-host-router';
import { resolveWorkspaceSearchItems } from './workspace-search-items';
import {
  MAX_WORKSPACE_SEARCH_RESULTS,
  WORKSPACE_SEARCH_BATCH_SIZE,
} from '../../ui/src/constants/limits';

interface ChromeHostSearchContext {
  searchIndex: BrowserSearchIndex | null;
  flatList: MdFile[];
  workspaceTree: FolderNode | null;
  activeWorkspacePath: string;
  activeHandle: FileSystemDirectoryHandle | null;
  send: (message: any) => void;
  readText: (handle: FileSystemDirectoryHandle, path: string) => Promise<string>;
  searchGeneration?: { value: number };
}

export async function handleChromeHostUtilityCommand(message: any, context: ChromeHostSearchContext): Promise<boolean> {
  if (await handleBrowserInsightsHostCommand(message, {
    activeHandle: context.activeHandle,
    send: context.send,
  })) return true;

  if (await handleChromeExportHostCommand(message, {
    activeHandle: context.activeHandle,
    send: context.send,
  })) return true;

  switch (message.command) {
    case 'saveDocument': {
      const requestedPath = String(message.filePath || '');
      const item = context.flatList.find((candidate) => candidate.fsPath === requestedPath || candidate.relativePath === requestedPath);
      let result;
      if (context.activeHandle && item) {
        result = await writeTextFile(
          context.activeHandle,
          item.relativePath,
          String(message.source ?? ''),
          typeof message.expectedRevision === 'string' ? message.expectedRevision : null,
          Boolean(message.force),
        );
      } else {
        result = { ok: false as const, reason: context.activeHandle ? 'outside-workspace' as const : 'read-only' as const };
      }
      context.send({
        command: 'saveDocumentResult',
        requestId: message.requestId,
        filePath: requestedPath,
        ...result,
      });
      return true;
    }
    case 'searchWorkspace': {
      const generation = context.searchGeneration ? ++context.searchGeneration.value : 0;
      const isCurrent = () => !context.searchGeneration || generation === context.searchGeneration.value;
      const requestId = message.requestId;
      const searchIndex = context.searchIndex;
      const searchItems = resolveWorkspaceSearchItems(message.items, context.flatList);

      if (!searchIndex) {
        context.send({ command: 'workspaceSearchResults', requestId, results: [], done: true, total: 0, truncated: false, cancelled: false });
        return true;
      }

      try {
        const summary = await searchIndex.searchIncremental(
          normalizeSearchQuery(message.query, Boolean(message.matchCase)),
          searchItems,
          {
            matchCase: Boolean(message.matchCase),
            limit: MAX_WORKSPACE_SEARCH_RESULTS,
            batchSize: WORKSPACE_SEARCH_BATCH_SIZE,
            shouldCancel: () => !isCurrent(),
            onBatch: results => {
              if (isCurrent()) context.send({ command: 'workspaceSearchResults', requestId, results, done: false });
            },
          },
        );
        if (isCurrent()) context.send({ command: 'workspaceSearchResults', requestId, results: [], done: true, ...summary });
      } catch (error) {
        if (isCurrent()) {
          context.send({
            command: 'workspaceSearchResults',
            requestId,
            results: [],
            done: true,
            total: 0,
            truncated: false,
            cancelled: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return true;
    }
    case 'loadSearchPreview': {
      const item = context.flatList.find((candidate) => candidate.fsPath === String(message.filePath || ''));
      if (!item || !context.searchIndex) {
        context.send({ command: 'searchPreviewResult', requestId: message.requestId, ok: false, filePath: message.filePath, reason: 'outside-workspace' });
        return true;
      }
      const markdownSource = await context.searchIndex.read(item.relativePath);
      context.send(markdownSource === null
        ? { command: 'searchPreviewResult', requestId: message.requestId, ok: false, filePath: item.fsPath, reason: 'missing' }
        : { command: 'searchPreviewResult', requestId: message.requestId, ok: true, filePath: item.fsPath, markdownSource });
      return true;
    }
    case 'loadWorkspaceSearchIndexes': {
      const tabs = filterSearchIndexTabs(message.tabs, context.activeWorkspacePath)
        .map((tab) => ({ ...tab, fileList: context.flatList, tree: context.workspaceTree }));
      if (tabs.length) context.send({ command: 'workspaceSearchIndexLoaded', tabs });
      return true;
    }
    case 'indexWorkspaceSearchItems':
      context.searchIndex?.prime(message.items || []);
      return true;
    case 'readWorkspaceTextResource': {
      const resolvedPath = resolveWorkspaceTextResourcePath(String(message.documentPath || ''), String(message.resourcePath || ''));
      if (!context.activeHandle || !resolvedPath) {
        context.send({ command: 'workspaceTextResourceResult', requestId: message.requestId, ok: false, reason: 'outside-workspace' });
        return true;
      }
      try {
        const content = await context.readText(context.activeHandle, resolvedPath);
        context.send({ command: 'workspaceTextResourceResult', requestId: message.requestId, ok: true, content, resolvedPath });
      } catch {
        context.send({ command: 'workspaceTextResourceResult', requestId: message.requestId, ok: false, reason: 'missing' });
      }
      return true;
    }
    case 'openExternal':
      if (isValidExternalUrl(message.url)) window.open(message.url as string, '_blank');
      return true;
    default:
      return false;
  }
}
