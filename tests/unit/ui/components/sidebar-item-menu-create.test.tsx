import { describe, expect, it, vi } from 'vitest';
import { buildSidebarItemMenuItems } from '../../../../ui/src/components/Sidebar/sidebarItemMenuItems';
import { getTranslations } from '../../../../ui/src/contexts/translations';

const anchor = null as unknown as HTMLElement;
const baseOptions = {
  state: { settings: { language: 'en' } } as any,
  canOpenHtmlInBrowser: false,
  canOpenItemLocations: false,
  translations: getTranslations('en'),
  bridge: {} as any,
  navigate: vi.fn(),
  isPinned: false,
  pinLimitReached: false,
  onTogglePin: vi.fn(),
};

describe('buildSidebarItemMenuItems create entries', () => {
  it('adds New File… and New Folder… first for folders only', () => {
    const onCreateEntry = vi.fn();
    const folderItems = buildSidebarItemMenuItems({ ...baseOptions, target: { kind: 'folder', path: 'docs', anchor }, onCreateEntry });
    expect(folderItems.slice(0, 2).map((item) => item.label)).toEqual(['New File…', 'New Folder…']);
    expect(folderItems[2].dividerBefore).toBe(true);
    folderItems[0].onSelect();
    folderItems[1].onSelect();
    expect(onCreateEntry.mock.calls).toEqual([['file', 'docs'], ['folder', 'docs']]);
    const fileItems = buildSidebarItemMenuItems({ ...baseOptions, target: { kind: 'file', path: 'C:\\ws\\a.md', anchor }, onCreateEntry });
    expect(fileItems.some((item) => item.id === 'new-file')).toBe(false);
    const noCreate = buildSidebarItemMenuItems({ ...baseOptions, target: { kind: 'folder', path: 'docs', anchor } });
    expect(noCreate.some((item) => item.id === 'new-file')).toBe(false);
    expect(noCreate[0].dividerBefore).toBeFalsy();
  });
});
