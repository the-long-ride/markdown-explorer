import { render, screen } from '@testing-library/react';
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
});
