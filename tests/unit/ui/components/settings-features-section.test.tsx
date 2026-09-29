import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SettingsFeaturesSection,
  getVisibleFeatureGroups,
} from '../../../../ui/src/components/Settings/SettingsFeaturesSection';
import { FEATURE_SETTINGS_TRANSLATIONS } from '../../../../ui/src/contexts/featureSettingsTranslations';

const t = {
  sidebarLabels: 'Sidebar File Labels',
  sidebarLabelsDesc: 'Show document titles instead of file names.',
  fileTabs: 'Open Files in Tabs',
  fileTabsDesc: 'Opening a file creates or activates a tab.',
  bookmarksEnabled: 'Enable Bookmark feature',
  bookmarksEnabledDesc: 'Show the Bookmarks tab.',
  insightsEnabled: 'Enable Workspace Insights feature',
  insightsEnabledDesc: 'Show workspace insights.',
  documentConversion: 'Read DOCX/PDF/Office and text files',
  documentConversionDesc: 'Convert office documents for reading.',
  htmlPreview: 'Default HTML Preview',
  htmlPreviewDesc: 'Open HTML files as previews {shortcut}.',
  allowUpstreamHtmlPreview: 'Allow upstream CDN & Javascript in HTML preview',
  allowUpstreamHtmlPreviewDesc: 'Allow remote styles, scripts, and script network requests in HTML document previews. Markdown Explorer cannot protect you from malware or viruses.',
  htmlCodeBlockPreview: 'Default HTML Code Block Preview',
  htmlCodeBlockPreviewDesc: 'Render HTML code blocks as previews.',
  csvPreview: 'Default CSV Code Block View',
  csvPreviewDesc: 'Render CSV code blocks as tables.',
  maxPinnedItems: 'Maximum pinned items',
  maxPinnedItemsDesc: 'Limit pinned files and folders.',
};

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    appRuntime: 'desktop',
    settings: {
      language: 'en',
      showTitle: false,
      fileTabs: true,
      bookmarksEnabled: false,
      insightsEnabled: false,
      historySidebarEnabled: true,
      markdownEditingEnabled: false,
      documentConversion: false,
      defaultHtmlPreview: true,
      allowUpstreamHtmlPreview: false,
      defaultHtmlCodeBlockPreview: true,
      defaultCsvPreview: false,
      maxPinnedItems: 5,
      keybindings: {},
    },
    ...overrides,
  } as any;
}

function renderSection({ isDesktop = true, state = makeState() } = {}) {
  const updateSettings = vi.fn();
  render(<SettingsFeaturesSection state={state} t={t} isDesktop={isDesktop} updateSettings={updateSettings} />);
  return { updateSettings };
}

const groupTitles = FEATURE_SETTINGS_TRANSLATIONS.en;

describe('SettingsFeaturesSection', () => {
  afterEach(() => {
    delete (window as any).__webDemoBus;
  });

  it('renders grouped sections with real headings in order', () => {
    renderSection();
    expect(screen.getByRole('heading', { level: 3, name: 'Features' })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent);
    expect(headings).toEqual([groupTitles.groupNavigation, groupTitles.groupTools, groupTitles.groupPreviews]);
    for (const title of headings) {
      expect(screen.getByRole('region', { name: title! })).toBeInTheDocument();
    }
  });

  it('places each setting in its section', () => {
    renderSection();
    const navigation = screen.getByRole('region', { name: groupTitles.groupNavigation });
    const tools = screen.getByRole('region', { name: groupTitles.groupTools });
    const previews = screen.getByRole('region', { name: groupTitles.groupPreviews });
    expect(within(navigation).getByRole('checkbox', { name: t.sidebarLabels })).toBeInTheDocument();
    expect(within(navigation).getByRole('checkbox', { name: t.fileTabs })).toBeInTheDocument();
    expect(within(navigation).getByRole('checkbox', { name: groupTitles.historySidebarEnabled })).toBeInTheDocument();
    expect(within(navigation).getByRole('spinbutton', { name: t.maxPinnedItems })).toBeInTheDocument();
    expect(within(tools).getByRole('checkbox', { name: t.bookmarksEnabled })).toBeInTheDocument();
    expect(within(tools).getByRole('checkbox', { name: t.insightsEnabled })).toBeInTheDocument();
    expect(within(tools).getByRole('checkbox', { name: groupTitles.markdownEditingEnabled })).toBeInTheDocument();
    expect(within(tools).getByRole('checkbox', { name: t.documentConversion })).toBeInTheDocument();
    expect(within(previews).getByRole('checkbox', { name: t.htmlPreview })).toBeInTheDocument();
    expect(within(previews).getByRole('checkbox', { name: t.allowUpstreamHtmlPreview })).toBeInTheDocument();
    expect(within(previews).getByRole('checkbox', { name: t.htmlCodeBlockPreview })).toBeInTheDocument();
    expect(within(previews).getByRole('checkbox', { name: t.csvPreview })).toBeInTheDocument();
  });

  it('exposes the description as the accessible description of each control', () => {
    renderSection();
    expect(screen.getByRole('checkbox', { name: t.fileTabs })).toHaveAccessibleDescription(t.fileTabsDesc);
    expect(screen.getByRole('checkbox', { name: t.csvPreview })).toHaveAccessibleDescription(t.csvPreviewDesc);
    expect(screen.getByRole('checkbox', { name: t.allowUpstreamHtmlPreview })).toHaveAccessibleDescription(t.allowUpstreamHtmlPreviewDesc);
    expect(screen.getByRole('spinbutton', { name: t.maxPinnedItems })).toHaveAccessibleDescription(t.maxPinnedItemsDesc);
    expect(screen.getByText(t.bookmarksEnabledDesc)).toBeVisible();
  });

  it('fills the HTML preview shortcut into its description', () => {
    renderSection({ state: makeState({ settings: { ...makeState().settings, keybindings: { toggleHtmlPreview: 'Ctrl+Alt+H' } } }) });
    const description = screen.getByRole('checkbox', { name: t.htmlPreview }).getAttribute('aria-describedby');
    expect(document.getElementById(description!)?.textContent).toContain('Ctrl');
  });

  it('hides runtime-specific rows in VS Code without leaving empty sections', () => {
    renderSection({ isDesktop: false, state: makeState({ appRuntime: 'vscode' }) });
    expect(screen.queryByRole('checkbox', { name: t.insightsEnabled })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: t.documentConversion })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(3);
    for (const region of screen.getAllByRole('region')) {
      expect(region.querySelectorAll('.settings-feature-row').length).toBeGreaterThan(0);
    }
  });

  it('hides Workspace Insights in the website demo runtime', () => {
    (window as any).__webDemoBus = new EventTarget();
    renderSection({ isDesktop: false, state: makeState({ appRuntime: 'chrome' }) });
    expect(screen.queryByRole('checkbox', { name: t.insightsEnabled })).not.toBeInTheDocument();
  });

  it('toggles and number input still update settings', () => {
    const { updateSettings } = renderSection();
    fireEvent.click(screen.getByRole('checkbox', { name: t.fileTabs }));
    expect(updateSettings).toHaveBeenLastCalledWith({ fileTabs: false });
    fireEvent.click(screen.getByRole('checkbox', { name: t.bookmarksEnabled }));
    expect(updateSettings).toHaveBeenLastCalledWith({ bookmarksEnabled: true });
    fireEvent.click(screen.getByRole('checkbox', { name: groupTitles.markdownEditingEnabled }));
    expect(updateSettings).toHaveBeenLastCalledWith({ markdownEditingEnabled: true });
    fireEvent.click(screen.getByRole('checkbox', { name: t.csvPreview }));
    expect(updateSettings).toHaveBeenLastCalledWith({ defaultCsvPreview: true });
    fireEvent.click(screen.getByRole('checkbox', { name: t.allowUpstreamHtmlPreview }));
    expect(updateSettings).toHaveBeenLastCalledWith({ allowUpstreamHtmlPreview: true });
    fireEvent.click(screen.getByText(t.sidebarLabels));
    expect(updateSettings).toHaveBeenLastCalledWith({ showTitle: true });
    fireEvent.change(screen.getByRole('spinbutton', { name: t.maxPinnedItems }), { target: { value: '8' } });
    expect(updateSettings).toHaveBeenLastCalledWith({ maxPinnedItems: 8 });
  });

  it('focuses and highlights the bookmark switch on focus-bookmark-setting', () => {
    renderSection();
    act(() => {
      window.dispatchEvent(new Event('focus-bookmark-setting'));
    });
    const checkbox = screen.getByRole('checkbox', { name: t.bookmarksEnabled });
    expect(checkbox).toHaveFocus();
    expect(checkbox.closest('.settings-feature-row')).toHaveClass('is-attention');
  });
});

describe('getVisibleFeatureGroups', () => {
  it('drops unavailable rows and omits groups that end up empty', () => {
    const groups = getVisibleFeatureGroups([
      { id: 'a', title: 'A', rows: [<span key="1">one</span>, false] },
      { id: 'b', title: 'B', rows: [false, null, undefined] },
      { id: 'c', title: 'C', rows: [] },
    ]);
    expect(groups.map((group) => group.id)).toEqual(['a']);
    expect(groups[0].rows).toHaveLength(1);
  });
});

describe('feature settings translations', () => {
  it('provides every key for all supported languages', () => {
    const keys = Object.keys(FEATURE_SETTINGS_TRANSLATIONS.en);
    for (const language of ['en', 'vi', 'fr', 'es', 'zh', 'no', 'ja', 'ko', 'ru']) {
      const entry = FEATURE_SETTINGS_TRANSLATIONS[language] as unknown as Record<string, string>;
      expect(entry, language).toBeDefined();
      for (const key of keys) expect(entry[key]?.trim(), `${language}.${key}`).toBeTruthy();
    }
  });
});
