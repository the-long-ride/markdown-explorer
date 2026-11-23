import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_ALIASES_STORAGE_KEY } from '../../../../ui/src/constants/storage';
import { createEmptyTab, readWorkspaceAliases, reorderDesktopTabs } from '../../../../ui/src/desktop/desktopTabs';

afterEach(() => localStorage.clear());

describe('reorderDesktopTabs', () => {
  const tabs = [createEmptyTab('h', 'home' as any), createEmptyTab('a', 'workspace' as any), createEmptyTab('b', 'workspace' as any), createEmptyTab('c', 'workspace' as any)];
  it('moves a tab before its target', () => {
    expect(reorderDesktopTabs(tabs, 'c', 'a').map((t) => t.id)).toEqual(['h', 'c', 'a', 'b']);
    expect(reorderDesktopTabs(tabs, 'a', 'c').map((t) => t.id)).toEqual(['h', 'b', 'a', 'c']);
  });
  it('returns the same tabs for home, missing or identical ids', () => {
    expect(reorderDesktopTabs(tabs, 'h', 'a')).toBe(tabs);
    expect(reorderDesktopTabs(tabs, 'a', 'missing')).toBe(tabs);
    expect(reorderDesktopTabs(tabs, 'a', 'a')).toBe(tabs);
  });
});

describe('readWorkspaceAliases', () => {
  it('ignores non-object stored values', () => {
    for (const value of ['null', '"text"', '{bad']) {
      localStorage.setItem(WORKSPACE_ALIASES_STORAGE_KEY, value);
      expect(readWorkspaceAliases()).toEqual({});
    }
  });
});
