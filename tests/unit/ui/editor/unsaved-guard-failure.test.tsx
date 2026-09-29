import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

type SaveReply = (message: Extract<WebviewMessage, { command: 'saveDocument' }>) => HostMessage | null;

function createBridge(reply: SaveReply) {
  const listeners = new Set<(message: HostMessage) => void>();
  const emit = (message: HostMessage) => listeners.forEach((listener) => listener(message));
  const bridge = {
    postMessage: vi.fn((message: WebviewMessage) => {
      if (message.command !== 'saveDocument') return;
      const response = reply(message);
      if (response) queueMicrotask(() => emit(response));
    }),
    onMessage: vi.fn((handler: (message: HostMessage) => void) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    }),
    getState: vi.fn(() => ({ fileTabs: true })),
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
  } as unknown as PlatformBridge;
  return { bridge, emit };
}

let context: ReturnType<typeof useAppState> | null = null;
function Harness() {
  context = useAppState();
  return <div>ready</div>;
}

function renderProvider(reply: SaveReply) {
  const { bridge, emit } = createBridge(reply);
  render(
    <PlatformProvider bridge={bridge}>
      <AppStateProvider><Harness /></AppStateProvider>
    </PlatformProvider>,
  );
  for (const filePath of ['/docs/a.md', '/docs/b.md']) {
    act(() => {
      context!.dispatch({
        type: 'RENDER_CONTENT',
        msg: {
          command: 'renderContent', html: '<h1>A</h1>', markdownSource: '# A',
          frontmatter: {}, toc: [], filePath, relativePath: filePath.slice(1), title: 'A',
          fileList: [], previewInfo: null,
          documentWrite: { supported: true, revision: '10:3' },
        },
      });
      context!.updateSettings({ markdownEditingEnabled: true });
      context!.setWorkingDocumentSource(filePath, '# B');
    });
  }
  return { bridge, emit };
}

const failWith = (reason: 'read-only' | 'permission-denied' | 'write-failed'): SaveReply => (message) => ({
  command: 'saveDocumentResult', requestId: message.requestId, filePath: message.filePath, ok: false, reason,
});

describe('unsaved changes guard: interruptions and failures', () => {
  it('cancels the previous pending guard when a new one replaces it', async () => {
    renderProvider(failWith('write-failed'));
    const firstCommit = vi.fn();
    const firstCancel = vi.fn();
    const secondCommit = vi.fn();
    act(() => context!.guardUnsavedChanges(['/docs/a.md'], firstCommit, firstCancel));
    act(() => context!.guardUnsavedChanges(['/docs/b.md'], secondCommit));

    expect(firstCancel).toHaveBeenCalledTimes(1);
    expect(firstCommit).not.toHaveBeenCalled();
    expect(screen.getByText('b.md')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Don't Save & Leave" }));
    expect(secondCommit).toHaveBeenCalledTimes(1);
    expect(firstCancel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['read-only', 'The file is read-only.'],
    ['permission-denied', 'Permission denied.'],
    ['write-failed', 'Writing to the file failed.'],
  ] as const)('shows the %s save failure and keeps the modal open without committing', async (reason, text) => {
    renderProvider(failWith(reason));
    const commit = vi.fn();
    act(() => context!.guardUnsavedChanges(['/docs/a.md'], commit));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not save the file.');
    expect(alert).toHaveTextContent(text);
    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('disables the choices while a save is in flight', async () => {
    let reply: (() => void) | null = null;
    const { emit } = renderProvider((message) => {
      reply = () => emit({
        command: 'saveDocumentResult', requestId: message.requestId, filePath: message.filePath, ok: true, revision: '20:3',
      });
      return null;
    });
    const commit = vi.fn();
    act(() => context!.guardUnsavedChanges(['/docs/a.md'], commit));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: "Don't Save & Leave" })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await act(async () => { reply?.(); });
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
  });

  it('closes the modal and cancels the action on a save conflict so the conflict modal takes over', async () => {
    renderProvider((message) => ({
      command: 'saveDocumentResult', requestId: message.requestId, filePath: message.filePath, ok: false,
      reason: 'conflict', diskSource: '# Disk', diskRevision: '30:5',
    }));
    const commit = vi.fn();
    const cancel = vi.fn();
    act(() => context!.guardUnsavedChanges(['/docs/a.md'], commit, cancel));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    expect(commit).not.toHaveBeenCalled();
    expect(screen.queryByText('The following file has not been saved:')).not.toBeInTheDocument();
    expect(context!.state.documentSessions['/docs/a.md']?.saveState).toBe('conflict');
    expect(screen.getByRole('dialog')).toHaveTextContent('changed on disk');
  });
});
