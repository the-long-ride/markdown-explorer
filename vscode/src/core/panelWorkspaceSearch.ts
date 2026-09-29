import type { MdFile } from '../types';
import { MAX_WORKSPACE_SEARCH_RESULTS, WORKSPACE_SEARCH_BATCH_SIZE } from '../../../ui/src/constants/limits';
import { searchMarkdownItemsIncremental } from './panelSearch';

interface PanelWorkspaceSearchContext {
  panel: { webview: { postMessage: (message: unknown) => Thenable<unknown> | Promise<unknown> } };
  flatList: MdFile[];
  generation: { value: number };
}

export async function handlePanelWorkspaceSearch(message: any, context: PanelWorkspaceSearchContext): Promise<void> {
  const generation = ++context.generation.value;
  const isCurrent = () => generation === context.generation.value;
  try {
    const summary = await searchMarkdownItemsIncremental(message.query, message.items, context.flatList, {
      matchCase: Boolean(message.matchCase),
      limit: MAX_WORKSPACE_SEARCH_RESULTS,
      batchSize: WORKSPACE_SEARCH_BATCH_SIZE,
      shouldCancel: () => !isCurrent(),
      onBatch: results => {
        if (isCurrent()) {
          void context.panel.webview.postMessage({ command: 'workspaceSearchResults', requestId: message.requestId, results, done: false });
        }
      },
    });
    if (isCurrent()) {
      await context.panel.webview.postMessage({ command: 'workspaceSearchResults', requestId: message.requestId, results: [], done: true, ...summary });
    }
  } catch (error) {
    if (isCurrent()) {
      await context.panel.webview.postMessage({
        command: 'workspaceSearchResults', requestId: message.requestId, results: [], done: true,
        total: 0, truncated: false, cancelled: false, error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
