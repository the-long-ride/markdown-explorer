import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContentTabItem } from '../../../../ui/src/components/Content/ContentTabItem';

function makeProps() {
  return {
    tab: {
      filePath: '/docs/a.md',
      relativePath: 'docs/a.md',
      fileName: 'a.md',
      title: 'A',
      contentHtml: '<h1>A</h1>',
      markdownSource: '# A',
      sourceDocumentText: null,
      frontmatter: {},
      toc: [],
      previewInfo: null,
    } as any,
    active: true,
    label: 'a.md',
    closePhaseClass: '',
    dragged: false,
    closeLabel: 'Close tab',
    dirty: true,
    dirtyLabel: 'Unsaved changes',
    draggedTabPathRef: { current: null },
    didDragRef: { current: false },
    ghostRef: { current: null },
    tabElementsRef: { current: new Map<string, HTMLDivElement>() },
    onSetDraggedPath: vi.fn(),
    onSetGhostLabel: vi.fn(),
    onReorder: vi.fn(),
    onActivate: vi.fn(),
    onOpenContextMenu: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('ContentTabItem dirty state', () => {
  it('shows a visible dot with an accessible unsaved label', () => {
    render(<ContentTabItem {...makeProps()} />);

    const indicator = screen.getByLabelText('Unsaved changes');
    expect(indicator).toHaveTextContent('●');
    expect(indicator).toBeVisible();
  });

  it('does not show the dirty indicator for a persisted tab', () => {
    render(<ContentTabItem {...makeProps()} dirty={false} />);

    expect(screen.queryByLabelText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('handles activation keys and ignores unrelated keys and secondary clicks', () => {
    const props = makeProps();
    render(<ContentTabItem {...props} />);
    const tab = screen.getByRole('tab');
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(props.onActivate).not.toHaveBeenCalled();
    fireEvent.keyDown(tab, { key: 'Enter' });
    fireEvent.keyDown(tab, { key: ' ' });
    expect(props.onActivate.mock.calls).toEqual([['/docs/a.md'], ['/docs/a.md']]);
    fireEvent(tab, new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent(tab, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(props.onClose).toHaveBeenCalledExactlyOnceWith('/docs/a.md');
  });

  it('ignores close-button drags and cleans up a drag even if its ghost has not mounted', () => {
    const props = makeProps();
    render(<ContentTabItem {...props} />);
    const tab = screen.getByRole('tab');
    const close = screen.getByRole('button', { name: 'Close tab' });
    fireEvent.pointerDown(close, { button: 0 });
    expect(props.onSetDraggedPath).not.toHaveBeenCalled();
    fireEvent.pointerDown(tab, { button: 0 });
    fireEvent.pointerEnter(tab);
    fireEvent.pointerMove(document, { clientX: 80, clientY: 90 });
    fireEvent.pointerCancel(document);
    expect(props.onReorder).not.toHaveBeenCalled();
    expect(props.onSetDraggedPath).toHaveBeenCalledExactlyOnceWith('/docs/a.md');
    expect(props.onSetGhostLabel).toHaveBeenCalledExactlyOnceWith('a.md');
  });
});
