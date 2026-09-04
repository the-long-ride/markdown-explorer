import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceInsightsPanel } from '../../../../ui/src/components/Insights/WorkspaceInsightsPanel';
import { DuplicatesView } from '../../../../ui/src/components/Insights/DuplicatesView';
import { LintView } from '../../../../ui/src/components/Insights/LintView';
import { INSIGHTS_TRANSLATIONS } from '../../../../ui/src/contexts/insightsTranslations';
import { INSIGHTS_UI_TRANSLATIONS } from '../../../../ui/src/contexts/insightsUiTranslations';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { normalizeInsightsSettings } from '../../../../ui/src/insights/config';
import type { WorkspaceInsightsSessionViewModel } from '../../../../ui/src/insights/useWorkspaceInsights';

const MIB = 1024 * 1024;
const uiLabels = INSIGHTS_UI_TRANSLATIONS.en;

function session(): WorkspaceInsightsSessionViewModel {
  return {
    panelOpen: true,
    status: 'ready',
    snapshot: { documents: new Map(), outboundLinks: new Map(), backlinks: new Map(), brokenLinks: [], tags: new Map(), headings: new Map(), titles: new Map(), revision: 1 },
    progress: { completed: 0, total: 0, provisional: false },
    warnings: [], workerMode: 'worker', externalResults: new Map(), approvedPrivateOrigins: new Set(),
    open: vi.fn(async () => {}), closePanel: vi.fn(), refreshLocal: vi.fn(async () => {}), pause: vi.fn(), dispose: vi.fn(),
    applyActiveOverlay: vi.fn(async () => {}), clearActiveOverlay: vi.fn(async () => {}), checkExternalLinks: vi.fn(async () => []),
    cancelExternalChecks: vi.fn(), approvePrivateOrigin: vi.fn(), getWikiResolverContext: vi.fn(async sourceDocumentPath => ({ sourceDocumentPath, documents: [] })),
  };
}
function doc(path: string, source: string) { return analyzeDocument({ path, source, revision: `${path}-1` }); }

describe('Workspace Insights persisted settings UI', () => {
  it('drives panel tools from resolved settings and exposes editable controls', async () => {
    const user = userEvent.setup();
    const settings = normalizeInsightsSettings({ externalLinks: { enabled: true, timeoutMs: 12_000 }, nearDuplicateThreshold: 0.94, graphNodeCap: 175 });
    const onSettingsChange = vi.fn();
    render(<WorkspaceInsightsPanel session={session()} settings={settings} onSettingsChange={onSettingsChange} onResetWorkspaceOverrides={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: `${INSIGHTS_TRANSLATIONS.en.entry} ${INSIGHTS_TRANSLATIONS.en.settings}` }));
    expect(screen.getByRole('switch', { name: INSIGHTS_TRANSLATIONS.en.externalLinksLabel })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('spinbutton', { name: INSIGHTS_TRANSLATIONS.en.externalTimeout })).toHaveValue(12000);
    expect(screen.getByRole('spinbutton', { name: /near-duplicate threshold/i })).toHaveValue(94);
    await user.click(screen.getByRole('tab', { name: INSIGHTS_TRANSLATIONS.en.duplicates }));
    expect(screen.getByText(/near-duplicate threshold: 94%/i)).toBeVisible();
  });

  it('edits global defaults separately from workspace overrides', async () => {
    const user = userEvent.setup();
    const globalSettings = normalizeInsightsSettings({ externalLinks: { enabled: false, timeoutMs: 10_000 }, graphNodeCap: 80 });
    const workspaceSettings = normalizeInsightsSettings({ externalLinks: { enabled: true, timeoutMs: 12_000 }, graphNodeCap: 175 });
    const onGlobalSettingsChange = vi.fn();
    const onSettingsChange = vi.fn();
    render(<WorkspaceInsightsPanel session={session()} labels={INSIGHTS_TRANSLATIONS.en} settings={workspaceSettings} globalSettings={globalSettings} onGlobalSettingsChange={onGlobalSettingsChange} onSettingsChange={onSettingsChange} onResetWorkspaceOverrides={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: `${INSIGHTS_TRANSLATIONS.en.entry} ${INSIGHTS_TRANSLATIONS.en.settings}` }));
    const scope = screen.getByRole('combobox', { name: INSIGHTS_TRANSLATIONS.en.settingsScope });
    expect(scope).toHaveValue('workspace');
    const externalLinksToggle = screen.getByRole('switch', { name: INSIGHTS_TRANSLATIONS.en.externalLinksLabel });
    expect(externalLinksToggle).toHaveAttribute('aria-checked', 'true');
    await user.selectOptions(scope, 'global');
    expect(externalLinksToggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('spinbutton', { name: INSIGHTS_TRANSLATIONS.en.graphNodeCap })).toHaveValue(80);
    await user.click(externalLinksToggle);
    expect(onGlobalSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ externalLinks: { enabled: true } }));
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('exposes custom relationship weights, lint rule severity, and global cache cap', async () => {
    const user = userEvent.setup();
    const settings = normalizeInsightsSettings({ relationshipPreset: 'custom', relationshipWeights: { links: 40, tags: 20, headings: 15, title: 10, terminology: 15 }, lintRules: { 'heading/duplicate': { enabled: true, severity: 'error' } } });
    const onGlobalSettingsChange = vi.fn();
    const onSettingsChange = vi.fn();
    render(<WorkspaceInsightsPanel session={session()} labels={uiLabels} settings={settings} globalSettings={settings} onGlobalSettingsChange={onGlobalSettingsChange} onSettingsChange={onSettingsChange} />);
    await user.click(screen.getByRole('button', { name: `${uiLabels.entry} ${uiLabels.settings}` }));
    expect(screen.getByRole('spinbutton', { name: uiLabels.directLinks })).toHaveValue(40);
    fireEvent.change(screen.getByRole('spinbutton', { name: uiLabels.directLinks }), { target: { value: '55' } });
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ relationshipWeights: expect.objectContaining({ links: 55 }) }));
    const duplicateRule = uiLabels.presentation.lintRules['heading/duplicate'];
    expect(screen.getByRole('switch', { name: `${uiLabels.rule}: ${duplicateRule}` })).toBeChecked();
    expect(screen.getByRole('combobox', { name: `${uiLabels.severity}: ${duplicateRule}` })).toHaveValue('error');
    await user.selectOptions(screen.getByRole('combobox', { name: uiLabels.settingsScope }), 'global');
    expect(screen.getByRole('spinbutton', { name: uiLabels.cacheCap })).toHaveValue(500);
    fireEvent.change(screen.getByRole('spinbutton', { name: uiLabels.cacheCap }), { target: { value: '600' } });
    expect(onGlobalSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ cacheCapBytes: 600 * MIB }));
  });

  it('rejects invalid include/exclude patterns with a visible localized error', async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<WorkspaceInsightsPanel session={session()} labels={INSIGHTS_TRANSLATIONS.en} settings={normalizeInsightsSettings()} onSettingsChange={onSettingsChange} />);
    await user.click(screen.getByRole('button', { name: `${INSIGHTS_TRANSLATIONS.en.entry} ${INSIGHTS_TRANSLATIONS.en.settings}` }));
    const patterns = screen.getByRole('textbox', { name: INSIGHTS_TRANSLATIONS.en.includeExcludePatterns });
    fireEvent.change(patterns, { target: { value: 'docs/[' } });
    expect(screen.getByRole('alert')).toHaveTextContent(INSIGHTS_TRANSLATIONS.en.error);
    expect(onSettingsChange).not.toHaveBeenCalledWith(expect.objectContaining({ userPatterns: ['docs/['] }));
  });

  it('reports duplicate and lint suppression changes to persisted settings callbacks', async () => {
    const user = userEvent.setup();
    const duplicateChange = vi.fn();
    const lintChange = vi.fn();
    const exactA = doc('a.md', '# Same\nUseful duplicate body with enough repeated terminology here.\n');
    const exactB = doc('b.md', '# Same  \r\nUseful duplicate body with enough repeated terminology here.');
    const lintDoc = doc('guide.md', '# A  \n### C\n# A\n');
    const { unmount } = render(<DuplicatesView documents={[exactA, exactB]} threshold={0.9} suppressions={[]} onSuppressionsChange={duplicateChange} />);
    await user.click(screen.getByRole('button', { name: `${INSIGHTS_TRANSLATIONS.en.suppress} ${INSIGHTS_TRANSLATIONS.en.duplicates}` }));
    expect(duplicateChange).toHaveBeenCalledWith(expect.arrayContaining([expect.stringMatching(/^exact:/)]));
    unmount();
    render(<LintView documents={[lintDoc]} suppressions={[]} onSuppressionsChange={lintChange} />);
    await user.click(screen.getAllByRole('button', { name: INSIGHTS_TRANSLATIONS.en.suppress })[0]);
    expect(lintChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ scope: 'finding' })]));
  });
});
