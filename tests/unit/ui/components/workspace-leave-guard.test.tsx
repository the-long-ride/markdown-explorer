import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSelection } from '../../../../ui/src/components/Workspace/WorkspaceSelection';
import { WorkspaceWindowControls } from '../../../../ui/src/components/Workspace/WorkspaceWindowControls';
import { AppStateProvider, useAppState } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformProvider } from '../../../../ui/src/contexts/PlatformContext';
import { useDirtyDocumentsGuard, useRequestWindowClose } from '../../../../ui/src/hooks/useDirtyDocumentsGuard';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';

vi.mock('../../../../ui/src/components/shared/InteractiveBackground', () => ({
  InteractiveBackground: () => null,
}));

function createBridge() {
  const listeners = new Set<(message: HostMessage) => void>();
  const bridge = {
    postMessage: vi.fn((message: WebviewMessage) => {
      if (message.command !== 'saveDocument') return;
      queueMicrotask(() => listeners.forEach((listener) => listener({
        command: 'saveDocumentResult', requestId: message.requestId, filePath: message.filePath, ok: true, revision: '2:3',
      })));
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
function Capture() {
  context = useAppState();
  return null;
}

function commandsPosted(bridge: PlatformBridge, command: string) {
  return (bridge.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(([message]) => message.command === command);
}

/** Mounts the real provider, opens a document, edits it, then leaves the workspace behind (host-initiated). */
function renderWithDirtyDocument(children: React.ReactNode) {
  const bridge = createBridge();
  render(
    <PlatformProvider bridge={bridge}>
      <AppStateProvider>
        <Capture />
        {children}
      </AppStateProvider>
    </PlatformProvider>,
  );
  act(() => {
    context!.dispatch({
      type: 'RENDER_CONTENT',
      msg: {
        command: 'renderContent', html: '<h1>A</h1>', markdownSource: '# A', frontmatter: {}, toc: [],
        filePath: '/docs/a.md', relativePath: 'a.md', title: 'A', fileList: [], previewInfo: null,
        documentWrite: { supported: true, revision: '1:3' },
      },
    });
    context!.updateSettings({ markdownEditingEnabled: true });
    context!.setWorkingDocumentSource('/docs/a.md', '# A edited');
  });
  return bridge;
}

describe('leaving the workspace with unsaved edits', () => {
  beforeEach(() => {
    vi.stubGlobal('electronAPI', {});
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    context = null;
  });

  it('prompts before Open Folder replaces a workspace that still has unsaved edits', async () => {
    const bridge = renderWithDirtyDocument(<WorkspaceSelection />);
    expect(context!.state.documentSessions['/docs/a.md']?.source).toBe('# A edited');

    await userEvent.click(screen.getByRole('button', { name: /open folder/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent('a.md');
    expect(commandsPosted(bridge, 'openFolder')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: "Don't Save & Leave" }));
    expect(commandsPosted(bridge, 'openFolder')).toHaveLength(1);
    expect(context!.state.documentSessions['/docs/a.md']?.source).toBe('# A');
  });

  it('does not open anything when the prompt is cancelled', async () => {
    const bridge = renderWithDirtyDocument(<WorkspaceSelection />);
    await userEvent.click(screen.getByRole('button', { name: /open folder/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(commandsPosted(bridge, 'openFolder')).toHaveLength(0);
    expect(context!.state.documentSessions['/docs/a.md']?.source).toBe('# A edited');
  });

  it('opens a recent workspace after saving through the prompt', async () => {
    const bridge = renderWithDirtyDocument(<WorkspaceSelection />);
    act(() => {
      context!.dispatch({
        type: 'READY_ACK', fileList: [], tree: null, theme: 'light', themeStyle: 'default', defaultExpanded: true,
        workspaceName: '', recentWorkspaces: [{ name: 'proj', path: '/proj', lastOpened: 1 }],
      });
    });
    // The workspace was dropped by the host, but the unsaved edit was not.
    expect(context!.state.documentSessions['/docs/a.md']?.source).toBe('# A edited');

    await userEvent.click(screen.getByText('proj'));
    expect(commandsPosted(bridge, 'openRecentWorkspace')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(commandsPosted(bridge, 'saveDocument')).toHaveLength(1);
    expect(commandsPosted(bridge, 'openRecentWorkspace')).toEqual([[{ command: 'openRecentWorkspace', path: '/proj', openFirstFile: false }]]);
  });

  it('prompts before the workspace-selection window close button closes the window', async () => {
    const bridge = renderWithDirtyDocument(
      <WorkspaceWindowControls embeddedInTabs={false} theme="light" isMaximized={false} onToggleTheme={vi.fn()} />,
    );
    const closeButton = document.querySelector<HTMLElement>('.window-control-btn--close')!;
    await userEvent.click(closeButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(commandsPosted(bridge, 'window-close')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: "Don't Save & Leave" }));
    expect(commandsPosted(bridge, 'window-close')).toHaveLength(1);
  });

  it('exposes one stable guard that commits immediately when nothing is dirty', () => {
    const bridge = createBridge();
    const seen: Array<ReturnType<typeof useDirtyDocumentsGuard>> = [];
    let requestClose: (() => void) | null = null;
    function Probe() {
      seen.push(useDirtyDocumentsGuard());
      requestClose = useRequestWindowClose();
      return null;
    }
    render(
      <PlatformProvider bridge={bridge}>
        <AppStateProvider><Capture /><Probe /></AppStateProvider>
      </PlatformProvider>,
    );
    const commit = vi.fn();
    act(() => seen[seen.length - 1](commit));
    expect(commit).toHaveBeenCalledTimes(1);

    act(() => context!.updateSettings({ markdownEditingEnabled: true }));
    expect(new Set(seen).size).toBe(1);

    act(() => requestClose?.());
    expect(commandsPosted(bridge, 'window-close')).toHaveLength(1);
  });
});
