import { describe, expect, it } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { reduceSettingsUiAction } from '../../../../ui/src/contexts/reducers/settingsUiReducer';

describe('reduceSettingsUiAction UPDATE_SETTINGS edges', () => {
  it('turns off markdown editing across sessions and panes', () => {
    const next = reduceSettingsUiAction({ ...initialState, documentSessions: {} } as any, { type: 'UPDATE_SETTINGS', settings: { markdownEditingEnabled: false } } as any);
    expect(next?.settings.markdownEditingEnabled).toBe(false);
    expect(next?.splitView.primary.mode).not.toMatch(/edit|source|split/);
  });

  it('rerenders only tabs with markdown source when preview defaults change', () => {
    const tabNoSource = { id: 't1', filePath: 'a.md', markdownSource: '', contentHtml: 'keep' };
    const tabWithSource = { id: 't2', filePath: 'b.mdx', markdownSource: '# B', contentHtml: '' };
    const state = { ...initialState, currentFile: null, markdownSource: '# Root', contentTabs: [tabNoSource, tabWithSource] } as any;
    const next = reduceSettingsUiAction(state, { type: 'UPDATE_SETTINGS', settings: { defaultCsvPreview: 'table' } } as any) as any;
    expect(next.contentTabs[0]).toBe(tabNoSource);
    expect(next.contentTabs[1].contentHtml).toContain('B');
    expect(next.contentHtml).toContain('Root');
  });
});
