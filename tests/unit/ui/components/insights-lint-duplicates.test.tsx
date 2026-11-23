import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { LintView } from '../../../../ui/src/components/Insights/LintView';
import { DuplicatesView } from '../../../../ui/src/components/Insights/DuplicatesView';
import { INSIGHTS_TRANSLATIONS } from '../../../../ui/src/contexts/insightsTranslations';
import { INSIGHTS_UI_TRANSLATIONS } from '../../../../ui/src/contexts/insightsUiTranslations';

function doc(path: string, source: string) { return analyzeDocument({ path, source, revision: `${path}-1` }); }

describe('Insights Lint and Duplicates views', () => {
  it('displays findings with no line and briefly confirms a successful clipboard copy', async () => {
    const document = doc('guide.md', '# A\n### C\n');
    const finding = { ...document.lint[0], line: undefined };
    const oldClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    vi.useFakeTimers();
    try {
      render(<LintView documents={[{ ...document, lint: [finding] }]} />);
      const row = screen.getByRole('button', { name: / - guide\.md$/ });
      expect(row).toHaveAttribute('data-hover-tooltip', 'guide.md');
      fireEvent.click(row);
      const copy = screen.getByRole('button', { name: /copy prompt for ai agent to fix markdown lint/i });
      await act(async () => { fireEvent.click(copy); });
      expect(writeText).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('guide.md'));
      expect(screen.getByRole('button', { name: 'Copied AI prompt!' })).toBeVisible();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(copy).toHaveAccessibleName('Copy prompt for AI agent to fix markdown lint');
    } finally {
      vi.useRealTimers();
      if (oldClipboard) Object.defineProperty(navigator, 'clipboard', oldClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

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

  it('combines severity and rule filters, then restores controlled path, rule, and finding suppressions', () => {
    const labels = INSIGHTS_UI_TRANSLATIONS.en;
    const first = doc('guide.md', '# A\n### C\n');
    const second = doc('other.md', '# A\n### C\n');
    const finding = first.lint.find(({ ruleId }) => ruleId === 'heading/skipped-level')!;
    const next = vi.fn();
    const documents = [first, second];
    const { rerender } = render(<LintView documents={documents} suppressions={[]} onSuppressionsChange={next} />);
    const select = (name: string, option: string) => {
      fireEvent.click(screen.getByRole('button', { name }));
      fireEvent.click(screen.getByRole('option', { name: option }));
    };
    select(labels.severity, labels[finding.severity]);
    select(labels.rule, labels.presentation.lintRules['heading/skipped-level']);
    expect(screen.getByTestId('lint-findings-count')).toHaveTextContent('2');
    const guide = screen.getByRole('button', { name: /guide\.md/ }).closest('li')!;
    const pathRule = { scope: 'path-rule', path: finding.path, ruleId: finding.ruleId } as const;
    const rule = { scope: 'rule', ruleId: finding.ruleId } as const;
    const one = { scope: 'finding', findingId: finding.id } as const;
    fireEvent.click(within(guide).getByRole('button', { name: labels.suppressPath }));
    expect(next).toHaveBeenLastCalledWith([pathRule]);
    fireEvent.click(within(guide).getByRole('button', { name: labels.suppressRule }));
    expect(next).toHaveBeenLastCalledWith([rule]);
    rerender(<LintView documents={documents} suppressions={[one, pathRule, rule]} onSuppressionsChange={next} />);
    expect(screen.getByTestId('lint-findings-count')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', { name: labels.showSuppressed }));
    const suppressed = screen.getByRole('button', { name: /guide\.md/ }).closest('li')!;
    fireEvent.click(within(suppressed).getByRole('button', { name: labels.restoreFinding }));
    expect(next).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole('button', { name: labels.hideSuppressed }));
    expect(screen.getByText(labels.noLintFindings)).toBeInTheDocument();
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

  it('reports sufficiently long repeated sections and restores a controlled suppression', () => {
    const body = 'First verify the requested resource is available. Then record the expected outcome before making changes, repeat the verification afterward, and document the result for the next reviewer.';
    const documents = [
      doc('a.md', `# Install\n\nPlatform notes.\n\n## Verification\n\n${body}`),
      doc('b.md', `# Update\n\nMigration notes.\n\n## Verification\n\n${body}`),
    ];
    const onSuppressionsChange = vi.fn();
    const labels = INSIGHTS_TRANSLATIONS.en;
    const view = (suppressions: string[]) => <DuplicatesView documents={documents} threshold={1} suppressions={suppressions} onSuppressionsChange={onSuppressionsChange} />;
    const { rerender } = render(view([]));
    expect(screen.getByText(labels.repeatedSection)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: `${labels.suppress} ${labels.duplicates}` }));
    expect(onSuppressionsChange).toHaveBeenLastCalledWith([expect.stringMatching(/^section:/)]);
    rerender(view(onSuppressionsChange.mock.lastCall![0]));
    expect(screen.getByText(labels.noDuplicateGroups)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: labels.showSuppressed }));
    fireEvent.click(screen.getByRole('button', { name: labels.restoreGroup }));
    expect(onSuppressionsChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole('button', { name: labels.hideSuppressed }));
    expect(screen.getByText(labels.noDuplicateGroups)).toBeVisible();
  });

  it('calls onSelectFinding with location when a lint finding target is clicked', async () => {
    const document = doc('guide.md', '# A  \n### C\n# A\n');
    const onSelectFinding = vi.fn();
    const user = userEvent.setup();
    render(<LintView documents={[document]} onSelectFinding={onSelectFinding} />);
    const targets = screen.getAllByRole('button', { name: /guide\.md/i });
    expect(targets.length).toBeGreaterThan(0);
    await user.click(targets[0]);
    expect(onSelectFinding).toHaveBeenCalledWith(expect.objectContaining({ path: 'guide.md' }));
  });

  it('copies AI prompt to fix markdown lint issues', async () => {
    const document = doc('guide.md', '# A  \n### C\n# A\n');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });
    render(<LintView documents={[document]} />);
    const copyBtn = screen.getByRole('button', { name: /copy prompt for ai agent to fix markdown lint/i });
    expect(copyBtn).toBeVisible();
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalledOnce();
    const copiedText = writeText.mock.calls[0][0];
    expect(copiedText).toContain('guide.md');
    expect(copiedText).toContain('Instructions:');
  });

  it('copies AI prompt to review and fix duplicates', async () => {
    const exactA = doc('a.md', '# Same\nUseful duplicate body with enough repeated terminology here.\n');
    const exactB = doc('b.md', '# Same  \r\nUseful duplicate body with enough repeated terminology here.');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });
    render(<DuplicatesView documents={[exactA, exactB]} threshold={0.8} />);
    const copyBtn = screen.getByRole('button', { name: /copy prompt for ai agent to review and fix duplicates/i });
    expect(copyBtn).toBeVisible();
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalledOnce();
    const copiedText = writeText.mock.calls[0][0];
    expect(copiedText).toContain('Exact Duplicates');
    expect(copiedText).toContain('a.md');
    expect(copiedText).toContain('b.md');
    expect(copiedText).toContain('Double-check and brainstorm');
  });
});
