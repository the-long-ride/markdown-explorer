import { describe, expect, it } from 'vitest';
import {
  closeSplit,
  createSplitViewState,
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
    expect(next.activePane).toBe('secondary');
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

  it('swaps complete pane view state', () => {
    let state = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    state = setPaneFile(state, 'secondary', '/docs/c.md');
    state = setPaneMode(state, 'secondary', 'plain');
    const next = swapPanes(state);
    expect(next.primary.filePath).toBe('/docs/c.md');
    expect(next.primary.mode).toBe('plain');
    expect(next.secondary.filePath).toBe('/docs/a.md');
  });

  it('closing split promotes the active secondary pane', () => {
    const opened = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    const state = setActivePane(opened, 'secondary');
    const next = closeSplit(state);
    expect(next.enabled).toBe(false);
    expect(next.activePane).toBe('primary');
    expect(next.primary.filePath).toBe('/docs/b.md');
    expect(next.secondary.filePath).toBeNull();
  });

  it('clamps split ratios to 25 through 75 percent', () => {
    const state = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    expect(setSplitRatio(state, 0.1).ratio).toBe(0.25);
    expect(setSplitRatio(state, 0.62).ratio).toBe(0.62);
    expect(setSplitRatio(state, 0.95).ratio).toBe(0.75);
  });
});
