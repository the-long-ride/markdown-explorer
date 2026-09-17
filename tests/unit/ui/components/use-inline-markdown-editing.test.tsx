import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useInlineMarkdownEditing } from '../../../../ui/src/components/Content/useInlineMarkdownEditing';

function createBody() {
  const body = document.createElement('div');
  body.innerHTML = `
    <p data-mdn-source-start="0" data-mdn-source-end="5">Alpha</p>
    <div class="mdn-callout" data-mdn-source-start="7" data-mdn-source-end="28">
      <div class="mdn-callout-body">
        <p data-mdn-source-start="0" data-mdn-source-end="6">Nested</p>
      </div>
    </div>
    <div class="mdn-table-source" data-mdn-source-start="30" data-mdn-source-end="45">Table</div>
    <div class="mdn-math" data-mdn-source-start="47" data-mdn-source-end="55">Math</div>
  `;
  document.body.appendChild(body);
  return body;
}

describe('useInlineMarkdownEditing', () => {
  it('adds edit affordances only to supported top-level source-backed blocks', () => {
    const body = createBody();
    const { unmount } = renderHook(() => useInlineMarkdownEditing({
      enabled: true,
      bodyRef: { current: body },
      source: 'Alpha\n\n> [!NOTE]\n> Nested\n\n| A |\n| - |\n| B |\n\n$$x$$',
      renderVersion: 1,
      editLabel: 'Edit Markdown block',
      onSourceChange: vi.fn(),
    }));

    const triggers = body.querySelectorAll<HTMLButtonElement>('.mdn-inline-edit-trigger');
    expect(triggers).toHaveLength(3);
    expect(body.querySelector('.mdn-callout .mdn-callout-body .mdn-inline-edit-trigger')).toBeNull();
    expect(body.querySelector('.mdn-math .mdn-inline-edit-trigger')).toBeNull();

    unmount();
    expect(body.querySelector('.mdn-inline-edit-trigger')).toBeNull();
    body.remove();
  });

  it('activates a block and applies an exact replacement to the working source', () => {
    const body = createBody();
    const onSourceChange = vi.fn();
    const source = 'Alpha\n\n> [!NOTE]\n> Nested\n\n| A |\n| - |\n| B |';
    const { result } = renderHook(() => useInlineMarkdownEditing({
      enabled: true,
      bodyRef: { current: body },
      source,
      renderVersion: 1,
      editLabel: 'Edit Markdown block',
      onSourceChange,
    }));

    const paragraph = body.querySelector('p[data-mdn-source-start="0"]') as HTMLElement;
    const trigger = paragraph.querySelector('.mdn-inline-edit-trigger') as HTMLButtonElement;
    act(() => trigger.click());
    expect(result.current.activeTarget).toBe(paragraph);

    act(() => result.current.apply('Beta', { start: 0, end: 5 }));
    expect(onSourceChange).toHaveBeenCalledWith('Beta' + source.slice(5));
    expect(result.current.activeTarget).toBeNull();

    body.remove();
  });

  it('does not install affordances when inline mode is disabled', () => {
    const body = createBody();
    renderHook(() => useInlineMarkdownEditing({
      enabled: false,
      bodyRef: { current: body },
      source: 'Alpha',
      renderVersion: 1,
      editLabel: 'Edit Markdown block',
      onSourceChange: vi.fn(),
    }));

    expect(body.querySelector('.mdn-inline-edit-trigger')).toBeNull();
    body.remove();
  });
});
