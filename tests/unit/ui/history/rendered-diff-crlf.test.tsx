import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RenderedDiffView } from '../../../../ui/src/components/History/RenderedDiffView';

function paragraphs(count: number, changed: string): string[] {
  return Array.from({ length: count }, (_, index) => (index === count - 1 ? changed : `Paragraph number ${index}`));
}

function changedTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('.is-diff-changed')].map((element) => element.textContent ?? '');
}

describe('rendered diff highlights with CRLF sources', () => {
  it('highlights only the changed block when both sources use CRLF', () => {
    const left = paragraphs(40, 'old ending').join('\r\n\r\n');
    const right = paragraphs(40, 'new ending').join('\r\n\r\n');
    const { container } = render(<RenderedDiffView leftSource={left} rightSource={right} />);

    const [leftPane, rightPane] = [...container.querySelectorAll<HTMLElement>('.rendered-diff-view__body')];
    expect(changedTexts(leftPane).filter((text) => text.includes('old ending'))).toHaveLength(1);
    expect(changedTexts(leftPane).filter((text) => !text.includes('old ending'))).toEqual([]);
    expect(changedTexts(rightPane).filter((text) => text.includes('new ending'))).toHaveLength(1);
    expect(changedTexts(rightPane).filter((text) => !text.includes('new ending'))).toEqual([]);
  });

  it('highlights the same blocks for CRLF and LF variants of the same content', () => {
    const lf = paragraphs(40, 'edited ending').join('\n\n');
    const baseLf = paragraphs(40, 'original ending').join('\n\n');
    const { container } = render(<RenderedDiffView leftSource={baseLf.replace(/\n/g, '\r\n')} rightSource={lf} />);
    const [leftPane, rightPane] = [...container.querySelectorAll<HTMLElement>('.rendered-diff-view__body')];
    expect(changedTexts(leftPane)).toEqual(['original ending']);
    expect(changedTexts(rightPane)).toEqual(['edited ending']);
  });
});
