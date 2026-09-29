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
});
