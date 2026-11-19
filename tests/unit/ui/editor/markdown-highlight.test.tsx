import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownSourceEditor } from '../../../../ui/src/components/Content/MarkdownSourceEditor';
import { markdownHighlighting, markdownHighlightStyle } from '../../../../ui/src/editor/markdownHighlight';

describe('markdownHighlightStyle', () => {
  it('exports a theme-token highlight style and extension', () => {
    expect(markdownHighlightStyle.module).not.toBeNull();
    expect(markdownHighlighting).toBeTruthy();
  });

  it('highlights Markdown tokens in the plain source editor', () => {
    const { container } = render(
      <MarkdownSourceEditor
        value={'# Title\n\nUse `code` here'}
        disabled={false}
        ariaLabel="Markdown source"
        language="en"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />,
    );

    const code = container.querySelector('.cm-md-code');
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain('code');
    const headingLine = container.querySelector('.cm-line');
    expect(headingLine?.querySelector('span[class]')).not.toBeNull();
  });

  it('highlights list markers with high-contrast readable styling', () => {
    const { container } = render(
      <MarkdownSourceEditor
        value={'1. Numbered item\n- Bullet item'}
        disabled={false}
        ariaLabel="Markdown source"
        language="en"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />,
    );

    const marks = container.querySelectorAll('.cm-md-list-mark');
    expect(marks.length).toBeGreaterThanOrEqual(2);
    expect(marks[0].textContent).toBe('1.');
    expect(marks[1].textContent).toBe('-');
  });
});
