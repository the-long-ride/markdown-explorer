import { describe, expect, it } from 'vitest';
import { createInitialState, reducer } from '../../../../ui/src/contexts/appStateReducer';

const f = (p: string) => ({ fsPath: p, relativePath: p.slice(1), parts: [p.slice(1)], fileName: p.slice(1), title: p.slice(1), extension: '.md' }) as any;
const base = () => ({ ...createInitialState(), fileList: [f('/a.md'), f('/b.md'), f('/c.md')] }) as any;
const r = (state: any, action: any) => reducer(state, action) as any;

describe('appStateReducer content tab actions', () => {
  it('restores content tabs with and without an active file', () => {
    const empty = createInitialState() as any;
    expect(r(empty, { type: 'RESTORE_CONTENT_TABS', filePaths: ['/a.md'] })).toBe(empty);
    const state = base();
    expect(r(state, { type: 'RESTORE_CONTENT_TABS', filePaths: [] })).toBe(state);
    expect(r(state, { type: 'RESTORE_CONTENT_TABS', filePaths: ['/zz.md'] })).toBe(state);
    expect(r(state, { type: 'RESTORE_CONTENT_TABS', filePaths: ['/a.md'] }).activeContentTabPath).toBe('/a.md');
    const withCurrent = r({ ...state, currentFile: '/c.md' }, { type: 'RESTORE_CONTENT_TABS', filePaths: ['/a.md'] });
    expect(withCurrent.contentTabs.map((t: any) => t.filePath)).toEqual(['/a.md', '/c.md']);
    expect(r({ ...state, currentFile: '/gone.md' }, { type: 'RESTORE_CONTENT_TABS', filePaths: ['/a.md'] }).contentTabs).toHaveLength(1);
    expect(r({ ...state, currentFile: '/a.md' }, { type: 'RESTORE_CONTENT_TABS', filePaths: ['/a.md'] }).contentTabs).toHaveLength(1);
  });

  it('sets and clears html preview overrides', () => {
    const state = { ...base(), currentFile: '/a.md', contentTabs: [{ filePath: '/a.md', htmlPreviewOverride: true }, { filePath: '/b.md' }] };
    expect(r(state, { type: 'SET_CONTENT_TAB_HTML_PREVIEW', filePath: '/zz.md', enabled: true })).toBe(state);
    const cleared = r(state, { type: 'SET_CONTENT_TAB_HTML_PREVIEW', filePath: '/a.md', enabled: undefined });
    expect(cleared.contentTabs[0]).not.toHaveProperty('htmlPreviewOverride');
    const other = r(state, { type: 'SET_CONTENT_TAB_HTML_PREVIEW', filePath: '/b.md', enabled: false });
    expect(other.contentTabs[1].htmlPreviewOverride).toBe(false);
    expect(other.currentHtmlPreviewOverride).toBe(state.currentHtmlPreviewOverride);
  });

  it('closes inactive tabs and tracks current-file and font changes', () => {
    const state = { ...base(), currentFile: '/a.md', activeContentTabPath: '/a.md', contentTabs: [{ filePath: '/a.md' }, { filePath: '/b.md' }] };
    expect(r(state, { type: 'CLOSE_CONTENT_TAB', filePath: '/zz.md' })).toBe(state);
    expect(r(state, { type: 'CLOSE_CONTENT_TAB', filePath: '/b.md' }).contentTabs).toHaveLength(1);
    expect(r(state, { type: 'CURRENT_FILE_CHANGED', filePath: '/b.md' })).toBe(state);
    expect(r(state, { type: 'CURRENT_FILE_CHANGED', filePath: '/A.md' }).staleContentFilePath).toBe('/A.md');
    const fonts = r(state, { type: 'SET_DESKTOP_FONTS', fonts: [], requestId: 'r', importedId: 'i' });
    expect(fonts.desktopFontError).toBeNull();
    expect(r(state, { type: 'SET_DESKTOP_FONTS', fonts: [], error: 'bad' }).desktopFontError).toBe('bad');
  });

  it('restores persisted state while keeping explicit preferences', () => {
    const state = { ...base(), hasThemePreference: true, theme: 'dark', hasSidebarPreference: true, sidebarCollapsed: true, hasSettingsPreference: true, hasThemeStylePreference: true, themeStyle: 'default' };
    const restored = r(state, { type: 'RESTORE_PERSISTED_STATE', persistedState: { theme: 'light', sidebarCollapsed: false } });
    expect(restored.theme).toBe('dark');
    expect(restored.sidebarCollapsed).toBe(true);
    const desktop = r({ ...base(), appRuntime: 'tauri' }, { type: 'RESTORE_PERSISTED_STATE', persistedState: { theme: 'light' } });
    expect(desktop.theme).toBeTruthy();
  });
});
