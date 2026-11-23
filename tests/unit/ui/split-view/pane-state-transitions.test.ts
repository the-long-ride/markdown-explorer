import { describe, expect, it } from 'vitest';
import {
  activatePaneTab,
  closePaneTab,
  createSplitViewState,
  movePaneTab,
  openPaneDocument,
  setPaneFile,
  setPaneTabs,
} from '../../../../ui/src/split-view/paneState';

const base = () => setPaneTabs(createSplitViewState('a.md'), 'primary', ['a.md', 'B.md', 'c.md'], 'a.md');

describe('split pane state transitions', () => {
  it('dedupes tabs and resolves requested and fallback active tabs', () => {
    const state = setPaneTabs(createSplitViewState(), 'primary', ['a.md', 'A.MD', '', 'dir\\b.md'], 'DIR/B.md');
    expect(state.primary.tabs).toEqual(['a.md', 'dir\\b.md']);
    expect(state.primary.activeTabPath).toBe('dir\\b.md');
    expect(setPaneTabs(state, 'primary', ['x.md'], 'missing.md').primary.activeTabPath).toBe('x.md');
    expect(setPaneTabs(state, 'primary', [], null).primary.activeTabPath).toBeNull();
  });

  it('opens documents with and without tabs', () => {
    const state = base();
    expect(openPaneDocument(state, 'primary', null, true).primary).toMatchObject({ filePath: null, tabs: state.primary.tabs });
    expect(openPaneDocument(state, 'primary', null, false).primary.tabs).toEqual([]);
    expect(openPaneDocument(state, 'primary', 'b.md', true).primary.filePath).toBe('B.md');
    expect(openPaneDocument(state, 'primary', 'new.md', true, 0).primary.tabs[0]).toBe('new.md');
    expect(openPaneDocument(state, 'secondary', 'z.md', false).secondary.tabs).toEqual(['z.md']);
  });

  it('activates and closes tabs', () => {
    const state = base();
    expect(activatePaneTab(state, 'primary', 'missing.md')).toBe(state);
    expect(activatePaneTab(state, 'primary', 'b.md').primary.activeTabPath).toBe('B.md');
    expect(closePaneTab(state, 'primary', 'nope.md')).toBe(state);
    const closedActive = closePaneTab(state, 'primary', 'a.md');
    expect(closedActive.primary.activeTabPath).toBe('B.md');
    expect(closedActive.primary.mode).toBe('rendered');
    const closedOther = closePaneTab(state, 'primary', 'c.md');
    expect(closedOther.primary.activeTabPath).toBe('a.md');
    expect(setPaneFile(state, 'primary', null).primary.filePath).toBeNull();
    expect(setPaneFile(state, 'primary', 'C.MD').primary.filePath).toBe('c.md');
  });

  it('moves tabs within and across panes', () => {
    const state = base();
    expect(movePaneTab(state, 'primary', 'primary', 'zzz.md', 0)).toBe(state);
    expect(movePaneTab(state, 'primary', 'primary', 'c.md', 0).primary.tabs[0]).toBe('c.md');
    expect(movePaneTab(state, 'primary', 'primary', 'a.md').primary.tabs.at(-1)).toBe('a.md');
    expect(movePaneTab(state, 'primary', 'secondary', 'zzz.md')).toBe(state);
    const moved = movePaneTab(state, 'primary', 'secondary', 'a.md', 0);
    expect(moved.secondary.tabs).toContain('a.md');
    expect(moved.primary.tabs).not.toContain('a.md');
    expect(moved.primary.activeTabPath).toBe('B.md');
    const movedOther = movePaneTab(state, 'primary', 'secondary', 'c.md');
    expect(movedOther.primary.activeTabPath).toBe('a.md');
  });
});
