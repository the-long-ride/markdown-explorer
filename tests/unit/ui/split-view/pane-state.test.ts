import { describe, expect, it } from 'vitest';
import {
  closePaneTab,
  closeSplit,
  createSplitViewState,
  openPaneDocument,
  openSplit,
  setActivePane,
  setPaneFile,
  setPaneMode,
  setPaneScrollTop,
  setSplitRatio,
  swapPanes,
} from '../../../../ui/src/split-view/paneState';

describe('split pane state', () => {
  it('opens a secondary pane without changing the primary file', () => {
    const initial = createSplitViewState('/docs/a.md');
    const next = openSplit(initial, '/docs/b.md');
    expect(next.enabled).toBe(true);
    expect(next.primary.filePath).toBe('/docs/a.md');
    expect(next.secondary.filePath).toBe('/docs/b.md');
    expect(next.primary.tabs).toEqual(['/docs/a.md']);
    expect(next.secondary.tabs).toEqual(['/docs/b.md']);
    expect(next.activePane).toBe('secondary');
  });

  it('owns tabs independently per pane and activates newly opened documents only in the target pane', () => {
    let state = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    state = openPaneDocument(state, 'primary', '/docs/c.md', true);
    state = openPaneDocument(state, 'primary', '/docs/d.md', true);
    expect(state.primary.tabs).toEqual(['/docs/a.md', '/docs/c.md', '/docs/d.md']);
    expect(state.primary.activeTabPath).toBe('/docs/d.md');
    expect(state.primary.filePath).toBe('/docs/d.md');
    expect(state.secondary.tabs).toEqual(['/docs/b.md']);
    expect(state.secondary.activeTabPath).toBe('/docs/b.md');
  });

  it('replaces only the target pane when document tabs are disabled', () => {
    let state = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    state = openPaneDocument(state, 'secondary', '/docs/c.md', false);
    expect(state.secondary.tabs).toEqual(['/docs/c.md']);
    expect(state.secondary.filePath).toBe('/docs/c.md');
    expect(state.primary.tabs).toEqual(['/docs/a.md']);
  });

  it('closes pane tabs without changing the other pane', () => {
    let state = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    state = openPaneDocument(state, 'primary', '/docs/c.md', true);
    state = closePaneTab(state, 'primary', '/docs/c.md');
    expect(state.primary.tabs).toEqual(['/docs/a.md']);
    expect(state.primary.activeTabPath).toBe('/docs/a.md');
    expect(state.secondary.tabs).toEqual(['/docs/b.md']);
  });

  it('keeps independent pane modes and scroll positions', () => {
    let state = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    state = setPaneMode(state, 'primary', 'plain');
    state = setPaneMode(state, 'secondary', 'inline-edit');
    state = setPaneScrollTop(state, 'primary', 120);
    state = setPaneScrollTop(state, 'secondary', 640);
    expect(state.primary.mode).toBe('plain');
    expect(state.secondary.mode).toBe('inline-edit');
    expect(state.primary.scrollTop).toBe(120);
    expect(state.secondary.scrollTop).toBe(640);
  });

  it('swaps complete pane view state including tabs', () => {
    let state = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    state = openPaneDocument(state, 'secondary', '/docs/c.md', true);
    state = setPaneFile(state, 'secondary', '/docs/c.md');
    state = setPaneMode(state, 'secondary', 'plain');
    const next = swapPanes(state);
    expect(next.primary.filePath).toBe('/docs/c.md');
    expect(next.primary.mode).toBe('plain');
    expect(next.primary.tabs).toEqual(['/docs/b.md', '/docs/c.md']);
    expect(next.secondary.filePath).toBe('/docs/a.md');
  });

  it('closing split keeps only the active pane workspace', () => {
    let opened = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    opened = openPaneDocument(opened, 'secondary', '/docs/c.md', true);
    const state = setActivePane(opened, 'secondary');
    const next = closeSplit(state);
    expect(next.enabled).toBe(false);
    expect(next.activePane).toBe('primary');
    expect(next.primary.filePath).toBe('/docs/c.md');
    expect(next.primary.tabs).toEqual(['/docs/b.md', '/docs/c.md']);
    expect(next.primary.activeTabPath).toBe('/docs/c.md');
    expect(next.secondary.filePath).toBeNull();
    expect(next.secondary.tabs).toEqual([]);
  });

  it('clamps split ratios to 25 through 75 percent', () => {
    const state = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    expect(setSplitRatio(state, 0.1).ratio).toBe(0.25);
    expect(setSplitRatio(state, 0.62).ratio).toBe(0.62);
    expect(setSplitRatio(state, 0.95).ratio).toBe(0.75);
  });
});
