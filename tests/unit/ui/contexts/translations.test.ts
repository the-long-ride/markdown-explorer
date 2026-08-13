import { describe, expect, test, vi } from 'vitest';

import {
  getTranslations,
  LANGUAGE_OPTIONS,
} from '../../../../ui/src/contexts/translations';
import type { Translations } from '../../../../ui/src/contexts/translations';
import { TRANSLATIONS } from '../../../../ui/src/contexts/translationsData';

describe('translations', () => {
  test('getTranslations("en") returns English translations with all required keys', () => {
    const t = getTranslations('en');
    expect(t.settings).toBe('Settings');
    expect(t.appearance).toBe('Appearance');
    expect(t.shortcuts).toBe('Keyboard Shortcuts');
    expect(t.themeStyles.defaultLabel).toBe('Default');
    expect(t.actions.searchCurrent).toBe('Search current workspace');
    expect(t.topbar.home).toBe('Home');
    expect(t.tooltips.switchLanguage).toBe('Switch Language');
    expect(t.tabContextMenu.closeThisTab).toBe('Close this tab');
    expect(t.documentPreview.convertedTitle).toBe('Converted {sourceLabel} preview');
    expect(t.recentWorkspaces.title).toBe('Recent Workspaces');
    expect(t.sidebar.files).toBe('Files');
    expect(t.toc.onThisPage).toBe('On This Page');
    expect(t.update.availableTitle).toBe('New version {version} available');
    expect(t.bannedShortcutTitle).toBe('Banned Shortcut');
  });

  test('getTranslations("") falls back to English', async () => {
    vi.resetModules();
    const mod = await import('../../../../ui/src/contexts/translations');
    const t = mod.getTranslations('');
    expect(t.settings).toBe('Settings');
  });

  test('getTranslations("unknown-code") falls back to English', () => {
    const t = getTranslations('unknown-code');
    expect(t.settings).toBe('Settings');
  });

  test('LANGUAGE_OPTIONS has exactly 9 entries', () => {
    expect(LANGUAGE_OPTIONS).toHaveLength(9);
  });

  test.each(LANGUAGE_OPTIONS)('LANGUAGE_OPTIONS entry $id has id and label strings', (option) => {
    expect(typeof option.id).toBe('string');
    expect(typeof option.label).toBe('string');
    expect(option.id.length).toBeGreaterThan(0);
    expect(option.label.length).toBeGreaterThan(0);
  });

  test('English translations have all required top-level keys matching Translations interface', () => {
    const t = getTranslations('en');
    const requiredKeys: (keyof Translations)[] = [
      'settings', 'subtitle', 'appearance', 'colorMode', 'colorModeDesc',
      'auto', 'light', 'dark', 'themeStyle', 'themeStyleDesc',
      'desktopView', 'desktopViewDesc', 'focus', 'tabs',
      'sidebarLabels', 'sidebarLabelsDesc', 'fileTabs', 'fileTabsDesc',
      'documentConversion', 'documentConversionDesc', 'htmlPreview', 'htmlPreviewDesc',
      'shortcuts', 'shortcutsHint', 'resetShortcuts', 'closeSettings',
      'themeStyles', 'actions', 'topbar', 'tooltips', 'previewActions', 'tabContextMenu',
      'documentPreview', 'recentWorkspaces', 'sidebar', 'toc', 'update',
      'bannedShortcutTitle', 'bannedShortcutDismiss', 'bannedShortcutImeMessage',
    ];
    for (const key of requiredKeys) {
      expect(t[key]).toBeDefined();
    }
  });


  test('all supported languages contain every preview action translation', () => {
    const keys = [
      'openInBrowser', 'openAsModal', 'showCode', 'showPreview', 'copyCode',
      'modalTitle', 'closeModal', 'openError', 'linkMenu', 'copyLink',
      'linkCopied', 'unableToOpenLink', 'copyFailed',
      'csvMalformedQuote', 'csvPreviewTitle', 'csvUnevenRows', 'plainText', 'tsvPreviewTitle',
    ];
    for (const option of LANGUAGE_OPTIONS) {
      const group = TRANSLATIONS[option.id].previewActions as Record<string, string>;
      expect(Object.keys(group).sort()).toEqual([...keys].sort());
      for (const key of keys) expect(group[key].trim()).not.toBe('');
    }
  });


  test('all supported languages match the English theme and preview translation shapes', () => {
    const english = TRANSLATIONS.en;
    const themeKeys = Object.keys(english.themeStyles).sort();
    const previewKeys = Object.keys(english.documentPreview).sort();

    for (const option of LANGUAGE_OPTIONS) {
      const locale = TRANSLATIONS[option.id];
      expect(Object.keys(locale.themeStyles).sort()).toEqual(themeKeys);
      expect(Object.keys(locale.documentPreview).sort()).toEqual(previewKeys);
      for (const value of Object.values(locale.themeStyles)) expect(value.trim()).not.toBe('');
      for (const value of Object.values(locale.documentPreview)) expect(value.trim()).not.toBe('');
    }
  });

  test('AppLanguage type is derived from LANGUAGE_OPTIONS ids', () => {
    const ids = LANGUAGE_OPTIONS.map(o => o.id);
    expect(ids).toEqual(['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru']);
  });
});
