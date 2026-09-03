import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { LintView } from '../../../../ui/src/components/Insights/LintView';
import { DuplicatesView } from '../../../../ui/src/components/Insights/DuplicatesView';
import { INSIGHTS_TRANSLATIONS } from '../../../../ui/src/contexts/insightsTranslations';
import { INSIGHTS_UI_TRANSLATIONS } from '../../../../ui/src/contexts/insightsUiTranslations';

function doc(path: string, source: string) { return analyzeDocument({ path, source, revision: `${path}-1` }); }

describe('Insights Lint and Duplicates views', () => {
  it('filters lint findings and supports reversible finding suppression', async () => {
    const document = doc('guide.md', '# A  \n### C\n# A\n');
    const user = userEvent.setup();
    render(<LintView documents={[document]} />);
    expect(screen.getAllByText(INSIGHTS_UI_TRANSLATIONS.en.presentation.lintRules['heading/skipped-level']).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: INSIGHTS_TRANSLATIONS.en.suppress })[0]);
    expect(screen.getByRole('button', { name: INSIGHTS_TRANSLATIONS.en.showSuppressed })).toBeVisible();
    await user.click(screen.getByRole('button', { name: INSIGHTS_TRANSLATIONS.en.showSuppressed }));
    expect(screen.getByText(INSIGHTS_TRANSLATIONS.en.suppressed)).toBeVisible();
  });

  it('shows exact and near duplicate groups and reversible suppression', async () => {
    const exactA = doc('a.md', '# Same\nUseful duplicate body with enough repeated terminology here.\n');
    const exactB = doc('b.md', '# Same  \r\nUseful duplicate body with enough repeated terminology here.');
    const nearA = doc('near-a.md', '# Auth\nRefresh token rotation access token session authentication policy behavior.');
    const nearB = doc('near-b.md', '# Auth guide\nRefresh token rotation access token session authentication policy behavior details.');
    const user = userEvent.setup();
    render(<DuplicatesView documents={[exactA, exactB, nearA, nearB]} threshold={0.8} />);
    expect(screen.getByText(INSIGHTS_TRANSLATIONS.en.exactDuplicate)).toBeVisible();
    expect(screen.getByText(INSIGHTS_TRANSLATIONS.en.nearDuplicate)).toBeVisible();
    await user.click(screen.getAllByRole('button', { name: `${INSIGHTS_TRANSLATIONS.en.suppress} ${INSIGHTS_TRANSLATIONS.en.duplicates}` })[0]);
    expect(screen.getByRole('button', { name: INSIGHTS_TRANSLATIONS.en.showSuppressed })).toBeVisible();
    await user.click(screen.getByRole('button', { name: INSIGHTS_TRANSLATIONS.en.showSuppressed }));
    expect(screen.getByText(INSIGHTS_TRANSLATIONS.en.suppressed)).toBeVisible();
  });
});
