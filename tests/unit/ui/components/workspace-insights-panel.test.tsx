import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceInsightsPanel } from '../../../../ui/src/components/Insights/WorkspaceInsightsPanel';
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
});
