import { describe, expect, it } from 'vitest';
import { reducer } from '../../../../ui/src/contexts/appStateReducer';
import { initialState } from '../../../../ui/src/contexts/appStateModel';

describe('main app reducer split routing', () => {
  it('routes split actions through the shared reducer', () => {
    const base = { ...initialState, currentFile: '/docs/a.md' };
    const opened = reducer(base, { type: 'OPEN_SPLIT_VIEW', filePath: '/docs/b.md' } as any);
    expect(opened.splitView.enabled).toBe(true);
    expect(opened.splitView.primary.filePath).toBe('/docs/a.md');
    expect(opened.splitView.secondary.filePath).toBe('/docs/b.md');

    const resized = reducer(opened, { type: 'SET_SPLIT_RATIO', ratio: 0.64 } as any);
    expect(resized.splitView.ratio).toBe(0.64);
  });
});
