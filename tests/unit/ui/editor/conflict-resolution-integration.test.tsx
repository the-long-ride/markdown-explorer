import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

function createConflictBridge() {
  const listeners = new Set<(message: HostMessage) => void>();
  const emit = (message: HostMessage) => listeners.forEach((listener) => listener(message));
  const bridge = {
    postMessage: vi.fn((message: WebviewMessage) => {
      if (message.command !== 'saveDocument') return;
      queueMicrotask(() => emit(message.force ? {
        command: 'saveDocumentResult', requestId: message.requestId, filePath: message.filePath,
        ok: true, revision: '30:6',
      } : {
        command: 'saveDocumentResult', requestId: message.requestId, filePath: message.filePath,
        ok: false, reason: 'conflict', diskSource: '# Disk', diskRevision: '20:6',
      }));
    }),
    onMessage: vi.fn((handler: (message: HostMessage) => void) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    }),
    getState: vi.fn(() => ({ fileTabs: true })), setState: vi.fn(), copyToClipboard: vi.fn(),
  } as unknown as PlatformBridge;
  return bridge;
}

let context: ReturnType<typeof useAppState> | null = null;
function Harness() {
  context = useAppState();
  return <div>ready</div>;
}

function renderConflictProvider() {
  const bridge = createConflictBridge();
  render(<PlatformProvider bridge={bridge}><AppStateProvider><Harness /></AppStateProvider></PlatformProvider>);
  const filePath = '/docs/a.md';
  act(() => {
    context!.dispatch({ type: 'RENDER_CONTENT', msg: {
      command: 'renderContent', html: '<h1>A</h1>', markdownSource: '# A', frontmatter: {}, toc: [],
      filePath, relativePath: 'a.md', title: 'A', fileList: [], previewInfo: null,
      documentWrite: { supported: true, revision: '10:3' },
    }});
    context!.setWorkingDocumentSource(filePath, '# Mine');
  });
  return { bridge, filePath };
}

async function triggerConflict(filePath: string) {
  await act(async () => { await context!.saveDocument(filePath); });
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
}

function countSaveRequests(bridge: PlatformBridge): number {
  return (bridge.postMessage as ReturnType<typeof vi.fn>).mock.calls
    .filter(([message]) => (message as WebviewMessage).command === 'saveDocument')
    .length;
}

describe('live document conflict resolution', () => {
  it('reloads the disk version into source and persisted state', async () => {
    const { filePath } = renderConflictProvider();
    await triggerConflict(filePath);

    await userEvent.click(screen.getByRole('button', { name: /reload disk version/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const session = context!.state.documentSessions[filePath];
    expect(session.source).toBe('# Disk');
    expect(session.persistedSource).toBe('# Disk');
    expect(session.revision).toBe('20:6');
    expect(session.conflict).toBeNull();
  });

  it('force saves mine against the observed disk revision', async () => {
    const { bridge, filePath } = renderConflictProvider();
    await triggerConflict(filePath);

    await userEvent.click(screen.getByRole('button', { name: /keep my edit/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bridge.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      command: 'saveDocument', filePath, force: true, expectedRevision: '20:6',
    }));
    expect(context!.state.documentSessions[filePath].persistedSource).toBe('# Mine');
  });

  it('emits a local compare request without saving', async () => {
    const { bridge, filePath } = renderConflictProvider();
    await triggerConflict(filePath);
    const saveCountBeforeCompare = countSaveRequests(bridge);
    const compare = vi.fn();
    window.addEventListener('markdown-explorer-document-compare-request', compare);

    await userEvent.click(screen.getByRole('button', { name: /compare changes/i }));

    expect(compare).toHaveBeenCalledTimes(1);
    const detail = (compare.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toMatchObject({ filePath, leftSource: '# Disk', rightSource: '# Mine' });
    expect(countSaveRequests(bridge)).toBe(saveCountBeforeCompare);
    window.removeEventListener('markdown-explorer-document-compare-request', compare);
  });
});
