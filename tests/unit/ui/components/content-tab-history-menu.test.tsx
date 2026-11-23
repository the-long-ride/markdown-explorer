import { describe, expect, it } from 'vitest';
import { buildContentTabContextMenuItems } from '../../../../ui/src/components/Content/contentTabContextMenuItems';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { getTranslations } from '../../../../ui/src/contexts/translations';

const state = {
  ...initialState,
  contentTabs: [{ filePath: '/workspace/notes.md', fileName: 'notes.md', relativePath: 'notes.md' }],
};

describe('document tab Revision (Git) action', () => {
  it('is always offered; the history view explains when Git cannot help', () => {
    const item = buildContentTabContextMenuItems(state as typeof initialState, getTranslations('en'), 0)
      .find((entry) => entry.action === 'history');
    expect(item).toMatchObject({ label: 'Revision (Git)' });
    expect(item?.disabled).toBeFalsy();
  });

  it('offers revision and HTML actions for an uncached split tab, including in web mode', () => {
    const path = '/workspace/archive.html';
    const translations = getTranslations('en');
    const items = buildContentTabContextMenuItems({ ...initialState, appRuntime: 'web' }, translations, -1, {
      paneId: 'secondary', paneTabs: [path], targetFilePath: path,
    });
    expect(items.map(item => item.action)).toContain('history');
    expect(items.map(item => item.action)).toContain('toggleHtmlDocumentView');
    expect(items.map(item => item.action)).not.toContain('openInBrowser');
    expect(items.map(item => item.action)).not.toContain('openLocation');
    expect(items.find(item => item.action === 'closeThisTab')?.disabled).toBe(false);
  });

  it('has no actions for a missing indexed tab or an absent split target', () => {
    const translations = getTranslations('en');
    expect(buildContentTabContextMenuItems(initialState, translations, 4)).toEqual([]);
    expect(buildContentTabContextMenuItems(initialState, translations, -1)).toEqual([]);
  });
});
