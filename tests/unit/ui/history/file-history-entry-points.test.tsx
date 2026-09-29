import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DOCUMENT_HISTORY_OPEN_EVENT, requestOpenDocumentHistory } from '../../../../ui/src/components/shared/ToolbarActionMenu';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { HistoryProvider, useHistory } from '../../../../ui/src/contexts/HistoryContext';
import type { HistoryClient } from '../../../../ui/src/history/historyClient';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

function createBridge(): PlatformBridge {
  return {
    postMessage: vi.fn(),
    onMessage: vi.fn(() => () => undefined),
    getState: vi.fn(() => ({})),
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
  } as unknown as PlatformBridge;
}

function SidebarTabProbe() {
  const { state } = useAppState();
  return <span data-testid="sidebar-tab">{state.sidebarActiveTab}</span>;
}

function renderProviders(bridge = createBridge()) {
  render(
    <PlatformProvider bridge={bridge}>
      <AppStateProvider>
        <HistoryProvider><SidebarTabProbe /></HistoryProvider>
      </AppStateProvider>
    </PlatformProvider>,
  );
  return bridge;
}

describe('document History entry points', () => {
  it('opens the file history modal instead of the drawer and loads immediately', () => {
    const bridge = renderProviders();

    act(() => requestOpenDocumentHistory('docs/a.md'));

    expect(screen.getByRole('dialog', { name: /file history — a\.md/i })).toBeInTheDocument();
    expect(document.querySelector('.document-history-panel')).toBeNull();
    expect(bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'listDocumentHistory' }));
  });

  it('keeps a live History client under StrictMode effect replays', () => {
    let latest: HistoryClient | null = null;
    function ClientProbe() {
      latest = useHistory().client;
      return null;
    }
    const bridge = createBridge();
    render(
      <StrictMode>
        <PlatformProvider bridge={bridge}>
          <AppStateProvider>
            <HistoryProvider><ClientProbe /></HistoryProvider>
          </AppStateProvider>
        </PlatformProvider>
      </StrictMode>,
    );

    expect(latest!.isDisposed()).toBe(false);
    void latest!.listRepositoryHistory({ limit: 1 }).catch(() => undefined);
    expect(bridge.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'listRepositoryHistory' }));
  });

  it('closes the modal from its close button', () => {
    renderProviders();
    act(() => requestOpenDocumentHistory('docs/a.md'));

    act(() => screen.getByRole('button', { name: /close/i }).click());

    expect(screen.queryByRole('dialog', { name: /file history/i })).toBeNull();
  });

  it('routes to the repository history sidebar when opened without a file path', () => {
    renderProviders();

    act(() => { window.dispatchEvent(new Event(DOCUMENT_HISTORY_OPEN_EVENT)); });

    expect(screen.getByTestId('sidebar-tab')).toHaveTextContent('history');
    expect(screen.queryByRole('dialog', { name: /file history/i })).toBeNull();
  });
});
