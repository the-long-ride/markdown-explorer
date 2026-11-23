import { describe, it, expect } from 'vitest';
import { buildWelcomeTipGroups } from '../../../../ui/src/components/Content/welcomeTipGroups';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { getWelcomeTranslations } from '../../../../ui/src/contexts/welcomeTranslations';

function cleanTitle(text: string): string {
  if (!text) return '';
  return text.replace(/^[✨⌨️🔒💡🔍🛠️📁📊📋🎨🖼️🐞🌐]\s*/u, '').replace(/\s*→\s*$/, '').trim();
}

describe('buildWelcomeTipGroups', () => {
  it('uses configured shortcuts in both general tips and translated feature tips', () => {
    const tips = getWelcomeTranslations('en').tips;
    const groups = buildWelcomeTipGroups('en', {
      ...initialState.settings,
      keybindings: {
        quickSearch: 'alt+q', searchAllTabs: 'alt+shift+q', findInFile: 'shift+g',
        toggleFocusMode: 'alt+v', toggleWorkspaceModal: 'alt+w',
        editMarkdown: 'alt+e', editPlainMarkdown: 'alt+shift+e', saveDocument: 'alt+s', toggleTheme: 'alt+t',
        toggleDesktopViewMode: 'alt+d', toggleHtmlPreview: 'alt+h', openCurrentDocumentLocation: 'alt+r',
      },
    }, tips);
    const descriptions = groups.flatMap((group) => group.items.map((item) => item.desc)).join('\n');
    for (const shortcut of ['Alt+Q', 'Alt+Shift+Q', 'Shift+G', 'Alt+V', 'Alt+W', 'Alt+D', 'Alt+H', 'Alt+R']) {
      expect(descriptions).toContain(`(${shortcut})`);
    }
    expect(descriptions).not.toContain('{shortcut}');
    expect(groups.find((group) => group.id === 'previewStructuredContent')?.items).toContainEqual({
      ...tips.tipToggleHtmlPreview, desc: tips.tipToggleHtmlPreview.desc.replace('{shortcut}', '(Alt+H)'),
    });
  });

  it('falls back to English groups and only fills enabled shortcut placeholders', () => {
    const tips = getWelcomeTranslations('en').tips;
    const groups = buildWelcomeTipGroups('unsupported-language', {
      ...initialState.settings, keybindings: {},
      disabledKeybindings: { toggleDesktopViewMode: true },
    }, tips);
    const items = groups.flatMap((group) => group.items);
    expect(items.find((item) => item.title === tips.tipToggleDesktopView.title)?.desc).toBe(
      tips.tipToggleDesktopView.desc.replace('{shortcut} ', ''),
    );
    expect(items.find((item) => item.title === tips.tipToggleHtmlPreview.title)?.desc).toContain('(Ctrl+Alt+H)');
    expect(items.find((item) => item.title === tips.tipOpenContainingFolder.title)?.desc).toContain('(Shift+Alt+R)');
    expect(groups.map((group) => group.title)).toEqual(buildWelcomeTipGroups('en', initialState.settings, undefined).map((group) => group.title));
  });
});

describe('WelcomePage pure functions', () => {
  describe('cleanTitle', () => {
    it('returns empty string for falsy input', () => {
      expect(cleanTitle('')).toBe('');
    });

    it('strips leading emoji', () => {
      expect(cleanTitle('✨ Features')).toBe('Features');
    });

    it('strips trailing arrow', () => {
      expect(cleanTitle('Navigate →')).toBe('Navigate');
    });

    it('strips both emoji and arrow', () => {
      expect(cleanTitle('🔍 Search →')).toBe('Search');
    });

    it('leaves plain text untouched', () => {
      expect(cleanTitle('Hello World')).toBe('Hello World');
    });

    it('trims whitespace after stripping', () => {
      expect(cleanTitle('✨ Hello →  ')).toBe('Hello');
    });

    it('does not strip emoji preceded by whitespace (regex anchored to start)', () => {
      expect(cleanTitle('  ✨ Hello')).toBe('✨ Hello');
    });

    it('handles multiple emoji characters at start (strips first only)', () => {
      expect(cleanTitle('🔒 Privacy')).toBe('Privacy');
    });
  });
});
