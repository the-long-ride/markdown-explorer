import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppState } from '../../../../ui/src/contexts/appStateModel';
import { SplitContentView } from '../../../../ui/src/components/Content/SplitContent';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';
import { beginSplitPointerDrag, resolveTabDropIndex } from '../../../../ui/src/split-view/splitPointerDrag';

const originalElementFromPoint = document.elementFromPoint;

afterEach(async () => {
  document.elementFromPoint = originalElementFromPoint;
  // Let the post-drag click guard expire so it cannot leak into the next test.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

function state(primaryTabs: string[], secondaryTabs: string[]): AppState {
  const split = createSplitViewState(primaryTabs[0]);
  const paths = [...new Set([...primaryTabs, ...secondaryTabs])];
  return {
    ...initialState,
    settings: { ...initialState.settings, fileTabs: true, language: 'en' },
    contentTabs: paths.map((filePath) => {
      const fileName = filePath.split('/').pop()!;
      return { filePath, fileName, relativePath: fileName, title: fileName.replace('.md', '').toUpperCase() };
    }),
    splitView: {
      ...split,
      enabled: true,
      primary: { ...split.primary, filePath: primaryTabs[0], tabs: primaryTabs, activeTabPath: primaryTabs[0] },
      secondary: { ...split.secondary, filePath: secondaryTabs[0] ?? null, tabs: secondaryTabs, activeTabPath: secondaryTabs[0] ?? null },
    },
  } as AppState;
}

function renderSplit(appState: AppState, actions: Record<string, ReturnType<typeof vi.fn>> = {}) {
  return render(
    <SplitContentView
      state={appState}
      onActivatePane={vi.fn()}
      onRatioChange={vi.fn()}
      onModeChange={vi.fn()}
      onSourceChange={vi.fn()}
      onSave={vi.fn()}
      onScrollChange={vi.fn()}
      onTabActivate={actions.onTabActivate}
      onMoveTab={actions.onMoveTab}
      onOpenDocument={actions.onOpenDocument}
      onSwapPanes={actions.onSwapPanes}
    />,
  );
}

function pointer(type: string, x: number, y = 5) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
}

// Real pointer sequence: press on the source, move past the threshold, release over the target.
function drag(source: Element, target: Element, x = 80) {
  document.elementFromPoint = vi.fn(() => target);
  source.dispatchEvent(pointer('pointerdown', 0));
  window.dispatchEvent(pointer('pointermove', x));
  window.dispatchEvent(pointer('pointerup', x));
}

function tabRect(left: number) {
  return { x: left, y: 0, left, top: 0, right: left + 100, bottom: 30, width: 100, height: 30, toJSON: () => ({}) };
}

describe('split view pointer drag', () => {
  it('reorders tabs within the same pane', () => {
    const onMoveTab = vi.fn();
    renderSplit(state(['/docs/a.md', '/docs/b.md', '/docs/c.md'], ['/docs/d.md']), { onMoveTab });
    const target = screen.getByRole('tab', { name: 'C' });
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(tabRect(200));

    drag(screen.getByRole('tab', { name: 'A' }), target, 290);

    expect(onMoveTab).toHaveBeenCalledWith('primary', 'primary', '/docs/a.md', 2);
  });

  it('moves a tab before the hovered tab of the other pane', () => {
    const onMoveTab = vi.fn();
    renderSplit(state(['/docs/a.md'], ['/docs/b.md', '/docs/c.md']), { onMoveTab });
    const target = screen.getByRole('tab', { name: 'C' });
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(tabRect(100));

    drag(screen.getByRole('tab', { name: 'A' }), target, 110);

    expect(onMoveTab).toHaveBeenCalledWith('primary', 'secondary', '/docs/a.md', 1);
  });

  it('moves a tab to the end of the other pane when dropped on its body', () => {
    const onMoveTab = vi.fn();
    renderSplit(state(['/docs/a.md'], ['/docs/b.md']), { onMoveTab });

    drag(screen.getByRole('tab', { name: 'A' }), screen.getByTestId('split-pane-scroll-secondary'));

    expect(onMoveTab).toHaveBeenCalledWith('primary', 'secondary', '/docs/a.md', 1);
  });

  it('ignores a tab dropped back onto its own pane body', () => {
    const onMoveTab = vi.fn();
    renderSplit(state(['/docs/a.md'], ['/docs/b.md']), { onMoveTab });

    drag(screen.getByRole('tab', { name: 'A' }), screen.getByTestId('split-pane-scroll-primary'));

    expect(onMoveTab).not.toHaveBeenCalled();
  });

  it('swaps panes when a header is dragged onto the other pane', () => {
    const onSwapPanes = vi.fn();
    renderSplit(state(['/docs/a.md'], ['/docs/b.md']), { onSwapPanes });
    const headers = document.querySelectorAll('.split-document-pane__header');

    drag(headers[0], headers[1]);

    expect(onSwapPanes).toHaveBeenCalledTimes(1);
  });

  it('does not swap when a header drag starts on a tab', () => {
    const onSwapPanes = vi.fn();
    const onMoveTab = vi.fn();
    renderSplit(state(['/docs/a.md'], ['/docs/b.md']), { onSwapPanes, onMoveTab });
    const headers = document.querySelectorAll('.split-document-pane__header');

    drag(screen.getByRole('tab', { name: 'A' }), headers[1]);

    expect(onSwapPanes).not.toHaveBeenCalled();
    expect(onMoveTab).toHaveBeenCalledWith('primary', 'secondary', '/docs/a.md', 1);
  });

  it('opens a sidebar document at the tab position it is dropped on', () => {
    const onOpenDocument = vi.fn();
    renderSplit(state(['/docs/a.md', '/docs/b.md'], ['/docs/c.md']), { onOpenDocument });
    const target = screen.getByRole('tab', { name: 'B' });
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(tabRect(100));
    const row = document.createElement('div');
    document.body.appendChild(row);
    document.elementFromPoint = vi.fn(() => target);

    beginSplitPointerDrag({ button: 0, clientX: 0, clientY: 5 }, { kind: 'document', filePath: '/docs/z.md' }, { label: 'z.md', source: row });
    window.dispatchEvent(pointer('pointermove', 110));
    window.dispatchEvent(pointer('pointerup', 110));

    expect(onOpenDocument).toHaveBeenCalledWith('primary', '/docs/z.md', 1);
    row.remove();
  });

  it('keeps a plain click as tab activation and swallows the click after a drag', () => {
    const onTabActivate = vi.fn();
    const onMoveTab = vi.fn();
    renderSplit(state(['/docs/a.md'], ['/docs/b.md']), { onTabActivate, onMoveTab });
    const tab = screen.getByRole('tab', { name: 'A' });

    fireEvent.click(tab);
    expect(onTabActivate).toHaveBeenCalledTimes(1);

    drag(tab, screen.getByTestId('split-pane-scroll-secondary'));
    fireEvent.click(tab);
    expect(onTabActivate).toHaveBeenCalledTimes(1);
  });

  it('does not start a drag below the movement threshold', () => {
    const onMoveTab = vi.fn();
    renderSplit(state(['/docs/a.md'], ['/docs/b.md']), { onMoveTab });

    drag(screen.getByRole('tab', { name: 'A' }), screen.getByTestId('split-pane-scroll-secondary'), 2);

    expect(onMoveTab).not.toHaveBeenCalled();
  });

  it('shows a drop marker and ghost while dragging, and clears them on release', () => {
    renderSplit(state(['/docs/a.md', '/docs/b.md'], ['/docs/c.md']), { onMoveTab: vi.fn() });
    const target = screen.getByRole('tab', { name: 'B' });
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(tabRect(100));
    document.elementFromPoint = vi.fn(() => target);

    screen.getByRole('tab', { name: 'A' }).dispatchEvent(pointer('pointerdown', 0));
    window.dispatchEvent(pointer('pointermove', 190));
    expect(target.classList.contains('is-drop-after')).toBe(true);
    expect(document.querySelector('.tab-drag-ghost')).not.toBeNull();

    window.dispatchEvent(pointer('pointerup', 190));
    expect(target.classList.contains('is-drop-after')).toBe(false);
    expect(document.querySelector('.tab-drag-ghost')).toBeNull();
  });
});

describe('resolveTabDropIndex', () => {
  it('accounts for the dragged tab being removed from the same strip', () => {
    expect(resolveTabDropIndex(['a', 'b', 'c'], 2, 'after', 'a')).toBe(2);
    expect(resolveTabDropIndex(['a', 'b', 'c'], 0, 'before', 'c')).toBe(0);
    expect(resolveTabDropIndex(['b', 'c'], 1, 'after', 'a')).toBe(2);
  });
});
