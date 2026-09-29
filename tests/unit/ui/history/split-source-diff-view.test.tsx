import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RenderedDiffView } from '../../../../ui/src/components/History/RenderedDiffView';
import { SplitSourceDiffView } from '../../../../ui/src/components/History/SplitSourceDiffView';

describe('SplitSourceDiffView', () => {
  it('renders old lines on the left and new lines on the right with diff types', () => {
    render(<SplitSourceDiffView leftSource={'a\nb\nc'} rightSource={'a\nB\nX\nc'} leftLabel="abc1234 · old" rightLabel="def5678 · new" language="en" />);

    expect(screen.getByText(/abc1234 · old/)).toBeInTheDocument();
    expect(screen.getByText(/def5678 · new/)).toBeInTheDocument();
    const rows = Array.from(document.querySelectorAll('.split-source-diff-view__row'));
    expect(rows).toHaveLength(4);
    const cells = (index: number) => Array.from(rows[index].querySelectorAll('[data-diff-type]')).map((cell) => cell.getAttribute('data-diff-type'));
    expect(cells(0)).toEqual(['context', 'context']);
    expect(cells(1)).toEqual(['remove', 'add']);
    expect(cells(2)).toEqual(['empty', 'add']);
    expect(rows[2].textContent).toContain('X');
  });

  it('shows a hunk separator between distant changes', () => {
    const left = Array.from({ length: 20 }, (_, index) => `line ${index}`).join('\n');
    const right = left.replace('line 1', 'line one').replace('line 18', 'line eighteen');
    render(<SplitSourceDiffView leftSource={left} rightSource={right} language="en" />);

    expect(document.querySelectorAll('.split-source-diff-view__separator')).toHaveLength(1);
  });
});

describe('RenderedDiffView scroll sync', () => {
  it('scrolls the right pane proportionally when the left pane scrolls', () => {
    render(<RenderedDiffView leftSource={'# Old\n\ntext'} rightSource={'# New\n\ntext'} language="en" />);
    const [left, right] = Array.from(document.querySelectorAll<HTMLElement>('.rendered-diff-view__pane'));
    Object.defineProperties(left, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
    Object.defineProperties(right, { scrollHeight: { value: 2200 }, clientHeight: { value: 200 } });

    left.scrollTop = 400;
    fireEvent.scroll(left);

    expect(right.scrollTop).toBe(1000);
  });
});
