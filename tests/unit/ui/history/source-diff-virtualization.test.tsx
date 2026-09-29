import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DIFF_ROW_HEIGHT } from '../../../../ui/src/components/History/diffVirtualRows';
import { RenderedDiffView } from '../../../../ui/src/components/History/RenderedDiffView';
import { HISTORY_TRANSLATIONS } from '../../../../ui/src/contexts/historyTranslations';
import { SourceDiffView } from '../../../../ui/src/components/History/SourceDiffView';
import { SplitSourceDiffView } from '../../../../ui/src/components/History/SplitSourceDiffView';

const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

function mockScrollContainerHeight(height: number) {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() { return (this as HTMLElement).classList.contains('file-history__diff-body') ? height : 0; },
  });
}

/** Every line differs, so the diff is a whole-file replacement: 10k removals then 10k additions. */
const reformattedLeft = Array.from({ length: 10_000 }, (_, index) => `old-${index}`).join('\n');
const reformattedRight = Array.from({ length: 10_000 }, (_, index) => `new-${index}`).join('\n');

/** Every tenth line edited: many separate hunks. */
const scatteredLeft = Array.from({ length: 15_000 }, (_, index) => `line-${index}`);
const scatteredRight = scatteredLeft.map((line, index) => (index % 10 === 5 ? `edited-${index}` : line));

afterEach(() => {
  if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
});

describe('SourceDiffView virtualization', () => {
  it('mounts only a window of rows for a 20k-row diff and shows the too-different notice', () => {
    render(<SourceDiffView leftSource={reformattedLeft} rightSource={reformattedRight} language="en" hideLabels />);

    const rows = document.querySelectorAll('.source-diff-view__table tbody tr[data-diff-type]');
    expect(rows.length).toBe(60);
    expect(screen.getByText('old-0')).toBeInTheDocument();
    expect(screen.queryByText('old-100')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('File too different to diff line by line; showing whole-file replacement.');
    const after = document.querySelector('.source-diff-view__spacer--after');
    expect(after).toHaveAttribute('aria-hidden', 'true');
    const table = document.querySelector<HTMLElement>('.source-diff-view__table');
    expect(table?.style.getPropertyValue('--source-diff-rows-after')).toBe(`${(20_000 - 60) * DIFF_ROW_HEIGHT}px`);
    expect(document.querySelector('.source-diff-view__spacer--before')).toBeNull();
  });

  it('renders the rows near the scroll position of the diff body', () => {
    mockScrollContainerHeight(400);
    render(
      <div className="file-history__diff-body" data-testid="body">
        <SourceDiffView leftSource={reformattedLeft} rightSource={reformattedRight} language="en" hideLabels />
      </div>,
    );
    expect(screen.getByText('old-0')).toBeInTheDocument();

    const body = screen.getByTestId('body');
    act(() => {
      body.scrollTop = 5_000 * DIFF_ROW_HEIGHT;
      fireEvent.scroll(body);
    });

    const rows = document.querySelectorAll('.source-diff-view__table tbody tr[data-diff-type]');
    expect(rows.length).toBeLessThanOrEqual(80);
    expect(screen.queryByText('old-0')).toBeNull();
    expect(screen.getByText('old-5000')).toBeInTheDocument();
    expect(screen.getByText('old-5019')).toBeInTheDocument();
    const table = document.querySelector<HTMLElement>('.source-diff-view__table');
    const before = Number.parseInt(table?.style.getPropertyValue('--source-diff-rows-before') ?? '', 10);
    const firstText = rows[0].querySelector('code')?.textContent ?? '';
    expect(before).toBe(Number(firstText.replace('old-', '')) * DIFF_ROW_HEIGHT);
    expect(document.querySelector('.source-diff-view__spacer--before')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('too-different notice', () => {
  it('is shown by the rendered diff when every line differs', () => {
    render(<RenderedDiffView leftSource={reformattedLeft} rightSource={reformattedRight} language="en" />);
    expect(screen.getByRole('status')).toHaveTextContent('File too different to diff line by line; showing whole-file replacement.');
  });

  it('is translated for every language', () => {
    render(<SplitSourceDiffView leftSource={reformattedLeft} rightSource={reformattedRight} language="no" hideLabels />);
    expect(screen.getByRole('status')).toHaveTextContent(HISTORY_TRANSLATIONS.no.diffTooDifferent);
  });
});

describe('SplitSourceDiffView virtualization', () => {
  it('mounts only a window of rows and hunk separators for a large diff', () => {
    render(<SplitSourceDiffView leftSource={scatteredLeft.join('\n')} rightSource={scatteredRight.join('\n')} language="en" hideLabels />);

    const rows = document.querySelectorAll('.split-source-diff-view__row');
    const separators = document.querySelectorAll('.split-source-diff-view__separator');
    expect(rows.length + separators.length).toBe(60);
    expect(separators.length).toBeGreaterThan(0);
    expect(screen.queryByRole('status')).toBeNull();
    const table = document.querySelector<HTMLElement>('.split-source-diff-view__table');
    const after = Number.parseInt(table?.style.getPropertyValue('--split-source-diff-rows-after') ?? '', 10);
    // 1,500 hunks of 7 rows plus 1,499 separators, minus the 60 rendered.
    expect(after).toBe((1_500 * 7 + 1_499 - 60) * DIFF_ROW_HEIGHT);
  });

  it('keeps separators in the fixed-height row index while scrolling', () => {
    mockScrollContainerHeight(400);
    render(
      <div className="file-history__diff-body" data-testid="body">
        <SplitSourceDiffView leftSource={scatteredLeft.join('\n')} rightSource={scatteredRight.join('\n')} language="en" hideLabels />
      </div>,
    );
    const body = screen.getByTestId('body');
    // Each hunk plus its separator is 8 rows; hunk 1000 starts at row 8000.
    act(() => {
      body.scrollTop = 8_000 * DIFF_ROW_HEIGHT;
      fireEvent.scroll(body);
    });

    expect(screen.queryByText('line-2')).toBeNull();
    expect(screen.getByText('edited-10005')).toBeInTheDocument();
    const rows = document.querySelectorAll('.split-source-diff-view__row');
    expect(rows.length).toBeLessThanOrEqual(80);
  });
});
