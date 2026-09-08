import { describe, expect, it } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { reduceSplitViewAction } from '../../../../ui/src/split-view/splitViewReducer';

describe('split view reducer integration', () => {
  it('opens, activates, resizes, and closes the split view', () => {
    let state = { ...initialState, currentFile: '/docs/a.md' };
    state = reduceSplitViewAction(state, { type: 'OPEN_SPLIT_VIEW', filePath: '/docs/b.md' })!;
    expect(state.splitView.enabled).toBe(true);
    expect(state.splitView.primary.filePath).toBe('/docs/a.md');
    expect(state.splitView.secondary.filePath).toBe('/docs/b.md');

    state = reduceSplitViewAction(state, { type: 'SET_SPLIT_RATIO', ratio: 0.7 })!;
    expect(state.splitView.ratio).toBe(0.7);
    state = reduceSplitViewAction(state, { type: 'ACTIVATE_SPLIT_PANE', paneId: 'primary' })!;
    expect(state.splitView.activePane).toBe('primary');
    state = reduceSplitViewAction(state, { type: 'CLOSE_SPLIT_VIEW' })!;
    expect(state.splitView.enabled).toBe(false);
  });

  it('keeps pane modes independent', () => {
    let state = { ...initialState, currentFile: '/docs/a.md' };
    state = reduceSplitViewAction(state, { type: 'OPEN_SPLIT_VIEW', filePath: '/docs/b.md' })!;
    state = reduceSplitViewAction(state, { type: 'SET_SPLIT_PANE_MODE', paneId: 'primary', mode: 'plain' })!;
    state = reduceSplitViewAction(state, { type: 'SET_SPLIT_PANE_MODE', paneId: 'secondary', mode: 'inline-edit' })!;
    expect(state.splitView.primary.mode).toBe('plain');
    expect(state.splitView.secondary.mode).toBe('inline-edit');
  });

  it('returns null for unrelated actions', () => {
    expect(reduceSplitViewAction(initialState, { type: 'SET_LOADING' } as any)).toBeNull();
  });
});
