import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceInsightsPanel } from '../../../../ui/src/components/Insights/WorkspaceInsightsPanel';
import { WorkspaceInsightsEntry } from '../../../../ui/src/components/Insights/WorkspaceInsightsEntry';
import { WORKSPACE_INSIGHTS_TOGGLE_EVENT } from '../../../../ui/src/components/shared/ToolbarActionMenu';
import { AppStateContext } from '../../../../ui/src/contexts/AppStateContext';
import { PlatformContext } from '../../../../ui/src/contexts/PlatformContext';
import { INSIGHTS_TRANSLATIONS } from '../../../../ui/src/contexts/insightsTranslations';
import type { WorkspaceInsightsSessionViewModel } from '../../../../ui/src/insights/useWorkspaceInsights';

function session(overrides: Partial<WorkspaceInsightsSessionViewModel> = {}): WorkspaceInsightsSessionViewModel {
  return {
    panelOpen: true,
    status: 'indexing',
    snapshot: { documents: new Map(), outboundLinks: new Map(), backlinks: new Map(), brokenLinks: [], tags: new Map(), headings: new Map(), titles: new Map(), revision: 0 },
    progress: { completed: 2, total: 5, provisional: true },
    warnings: [],
    workerMode: 'worker',
    externalResults: new Map(),
    approvedPrivateOrigins: new Set(),
    open: vi.fn(async () => {}),
    closePanel: vi.fn(),
    refreshLocal: vi.fn(async () => {}),
    pause: vi.fn(),
    dispose: vi.fn(),
    applyActiveOverlay: vi.fn(async () => {}),
    clearActiveOverlay: vi.fn(async () => {}),
    checkExternalLinks: vi.fn(async () => []),
    cancelExternalChecks: vi.fn(),
    approvePrivateOrigin: vi.fn(),
    getWikiResolverContext: vi.fn(async sourceDocumentPath => ({ sourceDocumentPath, documents: [] })),
    ...overrides,
  };
}

describe('WorkspaceInsightsPanel', () => {
  it('renders the six tools in a dedicated region and defaults to Gallery', () => {
    render(<WorkspaceInsightsPanel session={session()} />);
    expect(screen.getByRole('region', { name: INSIGHTS_TRANSLATIONS.en.title })).toBeVisible();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getByRole('tab', { name: INSIGHTS_TRANSLATIONS.en.gallery })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/indexing 2 of 5/i)).toBeVisible();
  });

  it('consumes the active Insights locale instead of rendering English literals', () => {
    render(<WorkspaceInsightsPanel session={session()} labels={INSIGHTS_TRANSLATIONS.vi} />);
    expect(screen.getByRole('region', { name: INSIGHTS_TRANSLATIONS.vi.title })).toBeVisible();
    expect(screen.getByRole('tab', { name: INSIGHTS_TRANSLATIONS.vi.gallery })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: INSIGHTS_TRANSLATIONS.vi.links })).toBeVisible();
    expect(screen.getByText(/Đang lập chỉ mục 2\/5/)).toBeVisible();
    expect(screen.queryByText('Gallery')).not.toBeInTheDocument();
  });

  it('switches views and exposes refresh, settings, cancel, and close actions', async () => {
    const user = userEvent.setup();
    const value = session();
    render(<WorkspaceInsightsPanel session={value} />);
    await user.click(screen.getByRole('tab', { name: INSIGHTS_TRANSLATIONS.en.links }));
    expect(screen.getByRole('tab', { name: INSIGHTS_TRANSLATIONS.en.links })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: `${INSIGHTS_TRANSLATIONS.en.refresh} ${INSIGHTS_TRANSLATIONS.en.entry}` }));
    expect(value.refreshLocal).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: `${INSIGHTS_TRANSLATIONS.en.entry} ${INSIGHTS_TRANSLATIONS.en.settings}` }));
    expect(screen.getByRole('region', { name: `${INSIGHTS_TRANSLATIONS.en.entry} ${INSIGHTS_TRANSLATIONS.en.settings}` })).toBeVisible();
    await user.click(screen.getByRole('button', { name: `${INSIGHTS_TRANSLATIONS.en.cancel} ${INSIGHTS_TRANSLATIONS.en.title}` }));
    expect(value.pause).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: INSIGHTS_TRANSLATIONS.en.close }));
    expect(value.closePanel).toHaveBeenCalled();
  });

  it('supports keyboard resizing through the existing resize hook contract', () => {
    render(<div><div id="insightsResize" role="separator" tabIndex={0} /><WorkspaceInsightsPanel session={session()} /></div>);
    const separator = screen.getByRole('separator');
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(document.documentElement.style.getPropertyValue('--insights-width')).not.toBe('');
  });

  it('applies is-collapsed and inert when panel is not open', () => {
    const value = session({ panelOpen: false });
    const { container } = render(<WorkspaceInsightsPanel session={value} />);
    const panel = container.querySelector('#workspaceInsightsPanel');
    expect(panel).toHaveClass('workspace-insights');
    expect(panel).toHaveClass('is-collapsed');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel).toHaveAttribute('inert');
  });

  it.each(['paused', 'error', 'indexing'] as const)('shows %s without a provisional label when indexing is not provisional', (status) => {
    const labels = INSIGHTS_TRANSLATIONS.en;
    render(<WorkspaceInsightsPanel session={session({ status, progress: { completed: 6, total: 5, provisional: false } })} />);
    const statusLabel = status === 'paused' ? labels.paused : status === 'error' ? labels.errorState : labels.indexing.replace('{done}', '6').replace('{total}', '6');
    expect(screen.getByText(statusLabel)).toHaveAttribute('role', 'status');
  });

  it('closes panel when Escape is pressed while panel is open', () => {
    const value = session({ panelOpen: true });
    render(<WorkspaceInsightsPanel session={value} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(value.closePanel).toHaveBeenCalled();
  });

  it('renders descriptive hover tooltips with count badges on tabs across locales', () => {
    const customSession = session({
      snapshot: {
        documents: new Map([
          ['doc1.md', {
            path: 'doc1.md',
            revision: '1',
            title: 'Doc 1',
            aliases: [],
            tags: [],
            anchors: new Set(),
            headings: [],
            references: [],
            dynamicReferences: [],
            sections: [],
            diagrams: [],
            exactFingerprint: '',
            terminology: [],
            terminologySignatures: [],
            lint: [{ rule: 'MD001', line: 1, message: 'Header issue', severity: 'warning' } as any],
          } as any],
        ]),
        outboundLinks: new Map(),
        backlinks: new Map(),
        brokenLinks: [{ sourcePath: 'doc1.md', targetUrl: 'https://broken.link', error: '404' } as any],
        tags: new Map(),
        headings: new Map(),
        titles: new Map(),
        revision: 1,
      },
    });
    render(<WorkspaceInsightsPanel session={customSession} labels={INSIGHTS_TRANSLATIONS.vi} />);

    const galleryTab = screen.getByRole('tab', { name: INSIGHTS_TRANSLATIONS.vi.gallery });
    expect(galleryTab).toHaveAttribute('data-hover-tooltip', INSIGHTS_TRANSLATIONS.vi.galleryTooltip);
    expect(galleryTab).toHaveAttribute('data-hover-tooltip-pos', 'bottom');

    const linksTab = screen.getByRole('tab', { name: INSIGHTS_TRANSLATIONS.vi.links });
    expect(linksTab).toHaveAttribute('data-hover-tooltip', `${INSIGHTS_TRANSLATIONS.vi.linksTooltip} (1)`);

    const lintTab = screen.getByRole('tab', { name: INSIGHTS_TRANSLATIONS.vi.lint });
    expect(lintTab).toHaveAttribute('data-hover-tooltip', `${INSIGHTS_TRANSLATIONS.vi.lintTooltip} (1)`);
  });

  it('toggles WorkspaceInsightsEntry open and closed via WORKSPACE_INSIGHTS_TOGGLE_EVENT', async () => {
    const mockAppState = {
      state: {
        workspacePath: 'test-ws',
        workspaceName: 'Test Workspace',
        settings: { insightsEnabled: true, language: 'en' },
        fileList: [],
      },
      navigate: vi.fn(),
    };
    const mockPlatform = {
      onMessage: vi.fn(() => () => {}),
      postMessage: vi.fn(),
    };

    render(
      <AppStateContext.Provider value={mockAppState as any}>
        <PlatformContext.Provider value={mockPlatform as any}>
          <div className="body">
            <WorkspaceInsightsEntry />
          </div>
        </PlatformContext.Provider>
      </AppStateContext.Provider>
    );

    // Initially collapsed / closed
    const panel = document.getElementById('workspaceInsightsPanel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass('is-collapsed');

    // Dispatch toggle event to open
    window.dispatchEvent(new Event(WORKSPACE_INSIGHTS_TOGGLE_EVENT));
    await waitFor(() => {
      expect(document.getElementById('workspaceInsightsPanel')).not.toHaveClass('is-collapsed');
    });

    // Dispatch toggle event to close
    window.dispatchEvent(new Event(WORKSPACE_INSIGHTS_TOGGLE_EVENT));
    await waitFor(() => {
      expect(document.getElementById('workspaceInsightsPanel')).toHaveClass('is-collapsed');
    });
  });

  it('uses a workspace name as the settings key and keeps global defaults separate from workspace overrides', async () => {
    const mockAppState = {
      state: { workspacePath: '', workspaceName: 'Named workspace', settings: { insightsEnabled: true, language: '' }, fileList: [] },
      navigate: vi.fn(),
    };
    const mockPlatform = { onMessage: vi.fn(() => () => {}), postMessage: vi.fn() };
    const labels = INSIGHTS_TRANSLATIONS.en;
    const user = userEvent.setup();
    const onPanelOpenChange = vi.fn();
    const saved = { ...localStorage };
    try {
      render(
        <AppStateContext.Provider value={mockAppState as any}>
          <PlatformContext.Provider value={mockPlatform as any}>
            <div className="body"><WorkspaceInsightsEntry onPanelOpenChange={onPanelOpenChange} /></div>
          </PlatformContext.Provider>
        </AppStateContext.Provider>,
      );
      expect(onPanelOpenChange).toHaveBeenCalledWith(false);
      fireEvent(window, new Event(WORKSPACE_INSIGHTS_TOGGLE_EVENT));
      await user.click(await screen.findByRole('button', { name: `${labels.entry} ${labels.settings}` }));
      expect(onPanelOpenChange).toHaveBeenLastCalledWith(true);
      const cap = screen.getByRole('spinbutton', { name: labels.graphNodeCap });
      const scope = screen.getByRole('combobox', { name: labels.settingsScope });
      fireEvent.change(cap, { target: { value: '125' } });
      expect(cap).toHaveValue(125);
      await user.selectOptions(scope, 'global');
      fireEvent.change(cap, { target: { value: '175' } });
      expect(cap).toHaveValue(175);
      await user.selectOptions(scope, 'workspace');
      expect(cap).toHaveValue(125);
      await user.click(screen.getByRole('button', { name: labels.resetWorkspace }));
      expect(cap).toHaveValue(175);
    } finally {
      localStorage.clear();
      for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value);
    }
  });

  it('updates portalTarget when .body is added after initial mount and handles dynamic DOM replacement', async () => {
    const mockAppState = {
      state: {
        workspacePath: 'test-ws',
        workspaceName: 'Test Workspace',
        settings: { insightsEnabled: true, language: 'en' },
        fileList: [],
      },
      navigate: vi.fn(),
    };
    const mockPlatform = {
      onMessage: vi.fn(() => () => {}),
      postMessage: vi.fn(),
    };

    const { container, unmount } = render(
      <AppStateContext.Provider value={mockAppState as any}>
        <PlatformContext.Provider value={mockPlatform as any}>
          <div data-testid="wrapper" />
        </PlatformContext.Provider>
      </AppStateContext.Provider>
    );

    // Mount WorkspaceInsightsEntry without .body in DOM initially
    const { rerender } = render(
      <AppStateContext.Provider value={mockAppState as any}>
        <PlatformContext.Provider value={mockPlatform as any}>
          <WorkspaceInsightsEntry />
        </PlatformContext.Provider>
      </AppStateContext.Provider>
    );

    expect(document.getElementById('workspaceInsightsPanel')).not.toBeInTheDocument();

    // Now append .body element to container
    const newBody = document.createElement('div');
    newBody.className = 'body';
    container.appendChild(newBody);

    // Verify MutationObserver detects .body and ports into it, opening successfully
    window.dispatchEvent(new Event(WORKSPACE_INSIGHTS_TOGGLE_EVENT));
    await waitFor(() => {
      const panel = document.getElementById('workspaceInsightsPanel');
      expect(panel).toBeInTheDocument();
      expect(panel).not.toHaveClass('is-collapsed');
      expect(newBody.contains(panel)).toBe(true);
    });

    unmount();
  });

  it('does not attach MutationObserver when .body already exists and disconnects immediately once .body appears', async () => {
    const mockAppState = {
      state: {
        workspacePath: 'test-ws',
        workspaceName: 'Test Workspace',
        settings: { insightsEnabled: true, language: 'en' },
        fileList: [],
      },
      navigate: vi.fn(),
    };
    const mockPlatform = {
      onMessage: vi.fn(() => () => {}),
      postMessage: vi.fn(),
    };

    const OriginalMutationObserver = globalThis.MutationObserver;
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();
    let capturedCallback: MutationCallback | null = null;

    class SpyMutationObserver {
      constructor(cb: MutationCallback) {
        capturedCallback = cb;
      }
      observe = observeSpy;
      disconnect = disconnectSpy;
      takeRecords = () => [];
    }

    vi.stubGlobal('MutationObserver', SpyMutationObserver);

    // Case 1: .body already connected on mount -> WorkspaceInsightsEntry does NOT attach an observer
    // (only the mounted WorkspaceInsightsPanel's useResize hook attaches 1 observer, not 2)
    const existingBody = document.createElement('div');
    existingBody.className = 'body';
    document.body.appendChild(existingBody);

    const firstRender = render(
      <AppStateContext.Provider value={mockAppState as any}>
        <PlatformContext.Provider value={mockPlatform as any}>
          <WorkspaceInsightsEntry />
        </PlatformContext.Provider>
      </AppStateContext.Provider>
    );

    expect(observeSpy).toHaveBeenCalledTimes(1);
    firstRender.unmount();
    existingBody.remove();

    // Case 2: .body missing initially -> WorkspaceInsightsEntry observes once, then disconnects immediately once .body appears
    observeSpy.mockClear();
    disconnectSpy.mockClear();
    capturedCallback = null;

    const secondRender = render(
      <AppStateContext.Provider value={mockAppState as any}>
        <PlatformContext.Provider value={mockPlatform as any}>
          <WorkspaceInsightsEntry />
        </PlatformContext.Provider>
      </AppStateContext.Provider>
    );

    expect(observeSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).not.toHaveBeenCalled();

    const lateBody = document.createElement('div');
    lateBody.className = 'body';
    document.body.appendChild(lateBody);
    capturedCallback?.([], {} as MutationObserver);

    expect(disconnectSpy).toHaveBeenCalledTimes(1);

    secondRender.unmount();
    lateBody.remove();
    vi.stubGlobal('MutationObserver', OriginalMutationObserver);
  });
});
