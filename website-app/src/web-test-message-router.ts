import type { MdFile } from '../../ui/src/types';
import { searchVirtualFilesIncremental } from './web-test-search';
import { getVirtualContent } from './virtual-workspace';
import {
  MAX_WORKSPACE_SEARCH_RESULTS,
  WORKSPACE_SEARCH_BATCH_SIZE,
} from '../../ui/src/constants/limits';

interface TestMessageRouterDeps {
  getReadyHandled: () => boolean;
  setReadyHandled: (value: boolean) => void;
  setCurrentFile: (path: string | null) => void;
  getFlatList: () => MdFile[];
  send: (message: unknown) => void;
  sendTestReady: () => Promise<void>;
  sendTestContent: (path: string) => Promise<void>;
  searchGeneration?: { value: number };
}

export async function handleWebTestMessage(msg: any, deps: TestMessageRouterDeps): Promise<void> {
  switch (msg.command) {
    case 'ready': {
      if (deps.getReadyHandled()) return;
      deps.setReadyHandled(true);
      await deps.sendTestReady();
      break;
    }
    case 'navigate': {
      const path = msg.path;
      if (!path) {
        deps.send({
          command: 'renderContent',
          html: '',
          markdownSource: '',
          frontmatter: {},
          toc: [],
          filePath: '',
          relativePath: 'Welcome Page',
          title: 'Welcome',
          fileList: deps.getFlatList(),
          previewInfo: null,
        });
        return;
      }
      deps.setCurrentFile(path);
      await deps.sendTestContent(path);
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
    case 'closeWorkspace':
      deps.setReadyHandled(false);
      await deps.sendTestReady();
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
