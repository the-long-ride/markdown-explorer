import { describe, expect, it } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { reduceSplitViewAction, retainSplitPaneContentTabs } from '../../../../ui/src/split-view/splitViewReducer';

const tab = (filePath: string) => ({ filePath, fileName: filePath, html: `<p>${filePath}</p>`, toc: [], markdownSource: '' }) as any;

function base(fileTabs: boolean) {
  return { ...initialState, currentFile: '/w/a.md', settings: { ...initialState.settings, fileTabs }, contentTabs: [tab('/w/a.md'), tab('/w/b.md')] } as any;
}

describe('split reducer edge cases', () => {
  it('returns no retained tabs when split view is closed and keeps other tabs when no tab is given', () => {
    expect(retainSplitPaneContentTabs(base(true), null)).toEqual([]);
    const opened = reduceSplitViewAction(base(true), { type: 'OPEN_SPLIT_VIEW', filePath: '/w/b.md' })!;
    expect(retainSplitPaneContentTabs(opened, null).map((t) => t.filePath)).toEqual(['/w/a.md', '/w/b.md']);
  });

  it('collapses to the remaining pane with and without file tabs', () => {
    for (const fileTabs of [true, false]) {
      const opened = reduceSplitViewAction(base(fileTabs), { type: 'OPEN_SPLIT_VIEW', filePath: '/w/b.md' })!;
      expect(opened.splitView.enabled).toBe(true);
      const closedSecondary = reduceSplitViewAction(opened, { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'secondary', filePath: '/w/b.md' })!;
      expect(closedSecondary.splitView.enabled).toBe(false);
      if (!fileTabs) expect(closedSecondary.activeContentTabPath).toBeNull();
      const reopened = reduceSplitViewAction({ ...base(fileTabs), contentTabs: [tab('/w/a.md')] }, { type: 'OPEN_SPLIT_VIEW', filePath: '/w/b.md' })!;
      const closedPrimary = reduceSplitViewAction({ ...reopened, contentTabs: [] }, { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'primary', filePath: '/w/a.md' })!;
      expect(closedPrimary.splitView.enabled).toBe(false);
    }
  });

  it('handles pane modes, unknown actions and moving the last tab out of a pane', () => {
    const opened = reduceSplitViewAction(base(true), { type: 'OPEN_SPLIT_VIEW', filePath: '/w/b.md' })!;
    expect(reduceSplitViewAction(opened, { type: 'SET_SPLIT_PANE_MODE', paneId: 'primary', mode: 'nonsense' })).toBeTruthy();
    expect(reduceSplitViewAction(opened, { type: 'UNKNOWN' })).toBeNull();
    const moved = reduceSplitViewAction(opened, { type: 'MOVE_SPLIT_TAB', sourcePaneId: 'secondary', targetPaneId: 'primary', filePath: '/w/b.md' })!;
    expect(moved).toBeTruthy();
    const closed = reduceSplitViewAction(base(false), { type: 'CLOSE_SPLIT_VIEW' })!;
    expect(closed.contentTabs).toEqual([]);
  });
});
