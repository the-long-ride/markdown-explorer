import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GalleryView } from '../../../../ui/src/components/Insights/GalleryView';
import { InsightsSettings } from '../../../../ui/src/components/Insights/InsightsSettings';
import { LinksView } from '../../../../ui/src/components/Insights/LinksView';
import { LintView } from '../../../../ui/src/components/Insights/LintView';
import { RelatedView } from '../../../../ui/src/components/Insights/RelatedView';
import { INSIGHTS_UI_TRANSLATIONS } from '../../../../ui/src/contexts/insightsUiTranslations';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { normalizeInsightsSettings } from '../../../../ui/src/insights/config';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';

function doc(path: string, source: string) {
  return analyzeDocument({ path, source, revision: `${path}-1` });
}

const labels = INSIGHTS_UI_TRANSLATIONS.vi;
afterEach(() => cleanup());

describe('Workspace Insights presentation localization', () => {
  it('localizes Gallery categories and resource statuses', async () => {
    const probeResource = vi.fn(async () => ({ status: 'exists' as const, kind: 'file' as const }));
    const document = doc('guide.md', ['# Guide', '![Local](image.png)', '```mermaid', 'not a declaration', '```'].join('\n'));
    render(<GalleryView documents={[document]} labels={labels} probeResource={probeResource} />);
    expect(screen.getByText(`${labels.presentation.galleryCategories.diagram} · ${labels.presentation.statuses.invalid}`)).toBeVisible();
    await waitFor(() => expect(screen.getByText(labels.presentation.statuses.exists)).toBeVisible());
    expect(screen.queryByText(/diagram · invalid/i)).toBeNull();
  });

  it('localizes Links machine statuses', () => {
    const index = new WorkspaceInsightsIndex();
    const source = doc('docs/source.md', ['# Source', '[[Missing]]', '[remote](https://example.test)', '<a href={dynamicTarget}>Dynamic</a>'].join('\n'));
    index.applyDocument(source);
    render(<LinksView snapshot={index.snapshot()} documents={[source]} labels={labels} externalResults={new Map()} />);
    expect(screen.getByText(labels.presentation.statuses.missing)).toBeVisible();
    expect(screen.getByText(labels.presentation.statuses.dynamic)).toBeVisible();
    expect(screen.getByText(labels.presentation.statuses.unchecked)).toBeVisible();
    expect(screen.queryByText('missing')).toBeNull();
    expect(screen.queryByText('dynamic')).toBeNull();
    expect(screen.queryByText('unchecked')).toBeNull();
  });

  it('localizes lint finding text, rule names, severities, and relationship preset labels', () => {
    const lintDocument = doc('guide.md', '# A\n### C\n');
    render(<LintView documents={[lintDocument]} labels={labels} />);
    const skipped = labels.presentation.lintRules['heading/skipped-level'];
    expect(screen.getAllByText(skipped).length).toBeGreaterThan(0);
    expect(screen.getAllByText(labels.warning).length).toBeGreaterThan(0);
    expect(screen.queryByText(/heading level jumps/i)).toBeNull();
    expect(screen.queryByText('heading/skipped-level')).toBeNull();
    cleanup();
    render(<RelatedView documents={[doc('note.md', '# Note')]} labels={labels} preset="default" />);
    expect(screen.getByText(new RegExp(labels.presentation.relationshipPresets.default))).toBeVisible();
    expect(screen.queryByText(/default ranking/i)).toBeNull();
  });

  it('localizes relationship preset options and lint rule labels in settings', () => {
    const settings = normalizeInsightsSettings({ relationshipPreset: 'default' });
    render(<InsightsSettings session={{ approvedPrivateOrigins: new Set() } as any} labels={labels} settings={settings} onSettingsChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: labels.presentation.relationshipPresets.default })).toBeVisible();
    expect(screen.getByText(labels.presentation.lintRules['heading/duplicate'])).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Default' })).toBeNull();
    expect(screen.queryByText('heading/duplicate')).toBeNull();
  });
});
