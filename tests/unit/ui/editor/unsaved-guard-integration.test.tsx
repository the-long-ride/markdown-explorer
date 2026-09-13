import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

function createBridge() {
  const listeners = new Set<(message: HostMessage) => void>();
  const emit = (message: HostMessage) => listeners.forEach((listener) => listener(message));
  const bridge = {
    postMessage: vi.fn((message: WebviewMessage) => {
      if (message.command !== 'saveDocument') return;
      queueMicrotask(() => emit({
        command: 'saveDocumentResult',
        requestId: message.requestId,
        filePath: message.filePath,
        ok: true,
        revision: '20:3',
      }));
    }),
    onMessage: vi.fn((handler: (message: HostMessage) => void) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    }),
    getState: vi.fn(() => ({ fileTabs: true })),
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
  } as unknown as PlatformBridge;
  return bridge;
}

let context: ReturnType<typeof useAppState> | null = null;
function Harness() {
  context = useAppState();
  return <div>ready</div>;
}

function renderProvider() {
  const bridge = createBridge();
  render(
    <PlatformProvider bridge={bridge}>
      <AppStateProvider><Harness /></AppStateProvider>
    </PlatformProvider>,
  );
  const filePath = '/docs/a.md';
  act(() => {
    context!.dispatch({
      type: 'RENDER_CONTENT',
      msg: {
        command: 'renderContent', html: '<h1>A</h1>', markdownSource: '# A',
        frontmatter: {}, toc: [], filePath, relativePath: 'a.md', title: 'A',
        fileList: [], previewInfo: null,
        documentWrite: { supported: true, revision: '10:3' },
      },
    });
    context!.setWorkingDocumentSource(filePath, '# B');
  });
  return { bridge, filePath };
}

function guard(filePath: string, commit: () => void, cancel?: () => void) {
  const guarded = context as typeof context & {
    guardUnsavedChanges?: (filePaths: string[], commit: () => void, cancel?: () => void) => void;
  };
  expect(guarded?.guardUnsavedChanges).toBeTypeOf('function');
  guarded?.guardUnsavedChanges?.([filePath], commit, cancel);
}

describe('AppStateProvider unsaved guard flow', () => {
  it('cancels without committing the destructive action', async () => {
    const { filePath } = renderProvider();
    const commit = vi.fn();
    act(() => guard(filePath, commit));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(commit).not.toHaveBeenCalled();
  });

  it('invokes the optional cancellation callback', async () => {
    const { filePath } = renderProvider();
    const commit = vi.fn();
    const cancel = vi.fn();
    act(() => guard(filePath, commit, cancel));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it('discards before committing', async () => {
    const { filePath } = renderProvider();
    const commit = vi.fn();
    act(() => guard(filePath, commit));
    await userEvent.click(screen.getByRole('button', { name: "Don't Save" }));
    expect(context!.state.documentSessions[filePath]?.source).toBe('# A');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('waits for a successful save before committing', async () => {
    const { bridge, filePath } = renderProvider();
    const commit = vi.fn();
    act(() => guard(filePath, commit));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'saveDocument', filePath }));
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
