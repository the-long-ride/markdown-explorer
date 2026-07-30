import type { MdFile } from '../../ui/src/types';
import { searchVirtualFiles } from './web-test-search';

interface TestMessageRouterDeps {
  getReadyHandled: () => boolean;
  setReadyHandled: (value: boolean) => void;
  setCurrentFile: (path: string | null) => void;
  getFlatList: () => MdFile[];
  send: (message: unknown) => void;
  sendTestReady: () => Promise<void>;
  sendTestContent: (path: string) => Promise<void>;
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
      const query = String(msg.query || '').trim().toLowerCase();
      deps.send({
        command: 'workspaceSearchResults',
        requestId: msg.requestId,
        results: searchVirtualFiles(query),
      });
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
