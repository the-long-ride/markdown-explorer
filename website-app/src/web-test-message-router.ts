import type { MdFile } from '../../ui/src/types';
import { searchVirtualFilesIncremental } from './web-test-search';
import { getVirtualContent, setVirtualContent } from './virtual-workspace';
import { handleWebDemoEntryMessage } from './web-demo-entry-router';
import { handleWebInsightsHostCommand } from './web-insights-host';
import { executeWebNavigation } from './web-navigation';
import {
  MAX_WORKSPACE_SEARCH_RESULTS,
  WORKSPACE_SEARCH_BATCH_SIZE,
} from '../../ui/src/constants/limits';

interface TestMessageRouterDeps {
  getReadyHandled: () => boolean;
  setReadyHandled: (value: boolean) => void;
  setCurrentFile: (path: string | null) => void;
  getCurrentFile: () => string | null;
  getFlatList: () => MdFile[];
  send: (message: unknown) => void;
  sendTestReady: () => Promise<void>;
  sendTestContent: (path: string) => Promise<void>;
  refreshTestWorkspace: () => Promise<void>;
  searchGeneration?: { value: number };
  getDocumentConversionEnabled?: () => boolean;
  setDocumentConversionEnabled?: (enabled: boolean) => void;
}

export async function handleWebTestMessage(msg: any, deps: TestMessageRouterDeps): Promise<void> {
  if (await handleWebDemoEntryMessage(msg, deps)) return;
  if (await handleWebInsightsHostCommand(msg, {
    getFlatList: deps.getFlatList,
    getFileContent: (path) => getVirtualContent(path),
    send: deps.send,
  })) return;
  switch (msg.command) {
    case 'ready': {
      if (typeof msg.documentConversion === 'boolean' && deps.setDocumentConversionEnabled) {
        deps.setDocumentConversionEnabled(msg.documentConversion);
      }
      if (deps.getReadyHandled()) return;
      deps.setReadyHandled(true);
      await deps.sendTestReady();
      break;
    }
    case 'setDocumentConversion': {
      if (deps.setDocumentConversionEnabled) {
        deps.setDocumentConversionEnabled(Boolean(msg.enabled));
      }
      await deps.refreshTestWorkspace();
      break;
    }
    case 'navigate': {
      await executeWebNavigation(msg.path, deps.getCurrentFile(), deps.getFlatList(), {
        setCurrentFile: deps.setCurrentFile,
        send: deps.send,
        openFile: deps.sendTestContent,
      });
      break;
    }
    case 'refresh':
      await deps.sendTestReady();
      break;
    case 'searchWorkspace': {
      const query = String(msg.query || '').trim();
      const generation = deps.searchGeneration ? ++deps.searchGeneration.value : 0;
      const isCurrent = () => !deps.searchGeneration || generation === deps.searchGeneration.value;
      const summary = await searchVirtualFilesIncremental(query, {
        matchCase: msg.matchCase === true,
        limit: MAX_WORKSPACE_SEARCH_RESULTS,
        batchSize: WORKSPACE_SEARCH_BATCH_SIZE,
        shouldCancel: () => !isCurrent(),
        onBatch: results => {
          if (isCurrent()) deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results, done: false });
        },
      });
      if (isCurrent()) deps.send({ command: 'workspaceSearchResults', requestId: msg.requestId, results: [], done: true, ...summary });
      break;
    }
    case 'loadSearchPreview': {
      const item = deps.getFlatList().find((candidate) => candidate.fsPath === String(msg.filePath || ''));
      const markdownSource = item ? getVirtualContent(item.relativePath) : null;
      deps.send(markdownSource === null
        ? { command: 'searchPreviewResult', requestId: msg.requestId, ok: false, filePath: msg.filePath, reason: 'outside-workspace' }
        : { command: 'searchPreviewResult', requestId: msg.requestId, ok: true, filePath: item!.fsPath, markdownSource });
      break;
    }
    case 'saveDocument': {
      const requestedPath = String(msg.filePath || '');
      const source = String(msg.source ?? '');
      setVirtualContent(requestedPath, source);
      await deps.refreshTestWorkspace();
      deps.send({
        command: 'saveDocumentResult',
        requestId: msg.requestId,
        filePath: requestedPath,
        ok: true,
        revision: String(source.length),
      });
      break;
    }
    case 'activateWorkspace': {
      if (msg.filePath) {
        deps.setCurrentFile(String(msg.filePath));
      }
      await deps.sendTestReady();
      break;
    }
    case 'closeWorkspace':
      deps.setReadyHandled(false);
      deps.setCurrentFile(null);
      deps.send({
        command: 'readyAck',
        fileList: [],
        tree: null,
        theme: 'dark',
        themeStyle: 'default',
        defaultExpanded: true,
        workspaceName: '',
        workspacePath: undefined,
        recentWorkspaces: [],
        documentConversionEnabled: Boolean(deps.getDocumentConversionEnabled?.()),
      });
      break;
    case 'readWorkspaceTextResource':
      deps.send({
        command: 'workspaceTextResourceResult',
        requestId: msg.requestId,
        ok: false,
        reason: 'unsupported',
      });
      break;
    case 'openExternal':
      if (typeof msg.url === 'string' && /^(?:https?|file):\/\//i.test(msg.url)) {
        window.open(msg.url, '_blank');
      }
      break;
    default:
      break;
  }
}
