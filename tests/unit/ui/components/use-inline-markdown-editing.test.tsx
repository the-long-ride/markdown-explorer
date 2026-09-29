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

  it('shows a hover tooltip on the edit trigger instead of a native title attribute', () => {
    const body = createBody();
    renderHook(() => useInlineMarkdownEditing({
      enabled: true,
      bodyRef: { current: body },
      source: 'Alpha\n\n> [!NOTE]\n> Nested\n\n| A |\n| - |\n| B |',
      renderVersion: 1,
      editLabel: 'Edit Markdown block',
      onSourceChange: vi.fn(),
    }));

    const trigger = body.querySelector('.mdn-inline-edit-trigger') as HTMLButtonElement;
    expect(trigger.hasAttribute('title')).toBe(false);
    expect(trigger.classList.contains('tooltip-container')).toBe(true);
    const tooltip = trigger.querySelector('.tooltip-text');
    expect(tooltip?.textContent).toBe('Edit Markdown block');

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

  it('opens a block on double-click but ignores interactive content', () => {
    const body = createBody();
    const link = document.createElement('a');
    link.href = '#x';
    link.textContent = 'link';
    const paragraph = body.querySelector('p[data-mdn-source-start="0"]') as HTMLElement;
    paragraph.appendChild(link);
    const { result } = renderHook(() => useInlineMarkdownEditing({
      enabled: true,
      bodyRef: { current: body },
      source: 'Alpha\n\n> [!NOTE]\n> Nested\n\n| A |\n| - |\n| B |',
      renderVersion: 1,
      editLabel: 'Edit Markdown block',
      onSourceChange: vi.fn(),
    }));

    expect(paragraph.querySelector('.mdn-inline-edit-trigger svg')).not.toBeNull();
    act(() => { link.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    expect(result.current.activeTarget).toBeNull();

    const nested = body.querySelector('.mdn-callout-body p') as HTMLElement;
    act(() => { nested.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    expect(result.current.activeTarget).toBe(body.querySelector('.mdn-callout'));

    act(() => result.current.cancel());
    expect(result.current.activeTarget).toBeNull();
    body.remove();
  });

  describe('active editor lifetime across re-renders', () => {
    const SOURCE = 'Alpha\n\n> [!NOTE]\n> Nested\n\n| A |\n| - |\n| B |';

    function setup(overrides: { filePath?: string | null } = {}) {
      const body = createBody();
      const bodyRef = { current: body };
      const base = { enabled: true, bodyRef, source: SOURCE, renderVersion: 1, editLabel: 'Edit Markdown block', onSourceChange: vi.fn(), filePath: overrides.filePath ?? '/docs/a.md' };
      const hook = renderHook((props: typeof base) => useInlineMarkdownEditing(props), { initialProps: base });
      const paragraph = body.querySelector('p[data-mdn-source-start="0"]') as HTMLElement;
      act(() => { (paragraph.querySelector('.mdn-inline-edit-trigger') as HTMLButtonElement).click(); });
      expect(hook.result.current.activeTarget).toBe(paragraph);
      return { body, base, hook, paragraph };
    }

    it('keeps the open editor when a renderVersion bump comes from an edit in another pane of the same file', () => {
      const { body, base, hook, paragraph } = setup();
      // The other pane edited elsewhere in the file: the shared source grew and the version bumped.
      hook.rerender({ ...base, renderVersion: 2, source: `${SOURCE}\n\nAppended in the other pane` });
      expect(hook.result.current.activeTarget).toBe(paragraph);
      // Affordances are re-installed on the still-mounted blocks.
      expect(body.querySelectorAll('.mdn-inline-edit-trigger').length).toBeGreaterThan(0);
      body.remove();
    });

    it('closes the editor when its block is no longer in the document', () => {
      const { body, base, hook, paragraph } = setup();
      paragraph.remove();
      hook.rerender({ ...base, renderVersion: 2 });
      expect(hook.result.current.activeTarget).toBeNull();
      body.remove();
    });

    it('closes the editor when the block source range is gone', () => {
      const { body, base, hook } = setup();
      hook.rerender({ ...base, renderVersion: 2, source: 'Al' });
      expect(hook.result.current.activeTarget).toBeNull();
      body.remove();
    });

    it('closes the editor when the file path changes', () => {
      const { body, base, hook } = setup();
      hook.rerender({ ...base, renderVersion: 2, filePath: '/docs/b.md' });
      expect(hook.result.current.activeTarget).toBeNull();
      body.remove();
    });

    it('closes the editor when inline editing is disabled', () => {
      const { body, base, hook } = setup();
      hook.rerender({ ...base, enabled: false });
      expect(hook.result.current.activeTarget).toBeNull();
      body.remove();
    });
  });
});
