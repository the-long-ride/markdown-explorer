import type { AppSettings } from '../../types';
import { formatShortcutLabel, getEnabledShortcut } from '../../utils/shortcuts';
import { TIP_GROUP_LABELS, TIPS_CONTENT, type TipGroupId, type TipItem } from './welcomeTipsContent';
import { EXTENDED_TIPS_CONTENT } from './welcomeTipsExtended';

export type WelcomeTipGroup = {
  id: TipGroupId;
  title: string;
  items: TipItem[];
};

type WelcomeTipsTranslations = any;

function syncTipShortcuts(item: TipItem, settings: AppSettings): TipItem {
  if (!item || !item.desc) return item;

  const keybindings = (settings as any)?.keybindings || (settings as any)?.settings?.keybindings || (settings as any);
  const getBinding = (actionId: string, fallback = '') => {
    const isExplicitlyDisabled = Boolean((settings as any)?.disabledKeybindings?.[actionId] || (settings as any)?.settings?.disabledKeybindings?.[actionId]);
    if (isExplicitlyDisabled) return '';
    const bound = (settings ? getEnabledShortcut(settings, actionId) : undefined) ??
      ((settings as any)?.settings ? getEnabledShortcut((settings as any).settings, actionId) : undefined) ??
      keybindings?.[actionId] ??
      (settings as any)?.[actionId] ??
      fallback;
    return bound ? formatShortcutLabel(bound) : '';
  };

  let desc = item.desc;
  const qs = getBinding('quickSearch') || getBinding('searchCurrent');
  const sat = getBinding('searchAllTabs');
  const fif = getBinding('findInFile') || getBinding('findCurrentFile');
  const fm = getBinding('toggleFocusMode');
  const sw = getBinding('toggleWorkspaceModal') || getBinding('workspaceSelection');
  const em = getBinding('editMarkdown') || getBinding('editCurrentDocument');
  const epm = getBinding('editPlainMarkdown') || getBinding('plainEditCurrentDocument');
  const sd = getBinding('saveDocument') || getBinding('saveCurrentDocument');
  const tt = getBinding('toggleTheme');
  const dvm = getBinding('toggleDesktopViewMode', 'Ctrl+Alt+T');
  const thp = getBinding('toggleHtmlPreview', 'Ctrl+Alt+H');
  const ocdl = getBinding('openCurrentDocumentLocation', 'Shift+Alt+R');

  if (qs) {
    desc = desc.replace(/\(Ctrl\+F\)|\(Ctrl\+K\)/gi, `(${qs})`);
  }
  if (sat) {
    desc = desc.replace(/\(Ctrl\+Shift\+F\)|\(Ctrl\+Shift\+K\)/gi, `(${sat})`);
  }
  if (fif) {
    desc = desc.replace(/\(F\)|\(K\)/g, `(${fif})`);
  }
  if (fm) {
    desc = desc.replace(/\(Ctrl\+Alt\+F\)/gi, `(${fm})`);
  }
  if (sw) {
    desc = desc.replace(/\(Ctrl\+P\)/gi, `(${sw})`);
  }
  if (em) {
    desc = desc.replace(/\(Ctrl\+E\)/gi, `(${em})`);
  }
  if (epm) {
    desc = desc.replace(/\(Ctrl\+Shift\+E\)/gi, `(${epm})`);
  }
  if (sd) {
    desc = desc.replace(/\(Ctrl\+S\)/gi, `(${sd})`);
  }
  if (tt) {
    desc = desc.replace(/\(Ctrl\+T\)/gi, `(${tt})`);
  }
  if (dvm) {
    desc = desc.replace(/\(Ctrl\+Alt\+T\)/gi, `(${dvm})`);
  }
  if (thp) {
    desc = desc.replace(/\(Ctrl\+Alt\+H\)|\(Ctrl\+Shift\+H\)/gi, `(${thp})`);
  }
  if (ocdl) {
    desc = desc.replace(/\(Shift\+Alt\+R\)|\(Ctrl\+Alt\+O\)/gi, `(${ocdl})`);
  }

  return { ...item, desc };
}

export function buildWelcomeTipGroups(
  currentLang: string,
  settings: AppSettings,
  tips: WelcomeTipsTranslations,
): WelcomeTipGroup[] {
  const keybindings = (settings as any)?.keybindings || (settings as any)?.settings?.keybindings || (settings as any);
  const getActionShortcut = (action: string, fallback = '') => {
    const isExplicitlyDisabled = Boolean((settings as any)?.disabledKeybindings?.[action] || (settings as any)?.settings?.disabledKeybindings?.[action]);
    if (isExplicitlyDisabled) return '';
    const bound = (settings ? getEnabledShortcut(settings, action) : undefined) ??
      ((settings as any)?.settings ? getEnabledShortcut((settings as any).settings, action) : undefined) ??
      keybindings?.[action] ??
      (settings as any)?.[action] ??
      fallback;
    return bound ? formatShortcutLabel(bound) : '';
  };

  const shortcut = (action: string, fallback = '') => getActionShortcut(action, fallback);
  const replaceShortcut = (value: string | undefined, action: string, fallback = '') => {
    if (!value) return '';
    const sc = shortcut(action, fallback);
    return sc ? value.replace('{shortcut}', `(${sc})`) : value.replace('{shortcut}', '').replace(/\s{2,}/g, ' ');
  };

  const base = TIPS_CONTENT[currentLang] || TIPS_CONTENT.en;
  const ext = EXTENDED_TIPS_CONTENT[currentLang] || EXTENDED_TIPS_CONTENT.en;
  const labels = TIP_GROUP_LABELS[currentLang] || TIP_GROUP_LABELS.en;

  const groups: Record<TipGroupId, TipItem[]> = {
    navigateAndOrganize: [
      base[0], base[2], base[5], base[6], base[8],
      ext.bookmarks,
      ext.tocAndSections,
      tips?.tipToggleDesktopView ? { ...tips.tipToggleDesktopView, desc: replaceShortcut(tips.tipToggleDesktopView.desc, 'toggleDesktopViewMode', 'Ctrl+Alt+T') } : undefined,
      tips?.tipSidebarActions,
      tips?.tipOpenContainingFolder ? { ...tips.tipOpenContainingFolder, desc: replaceShortcut(tips.tipOpenContainingFolder.desc, 'openCurrentDocumentLocation', 'Shift+Alt+R') } : undefined,
      tips?.tipWorkspaceRecovery,
    ].filter(Boolean) as TipItem[],
    authoringAndHistory: [
      ext.liveAndSourceEditor,
      ext.splitPaneView,
      ext.fileRevisionHistory,
      ext.gitRepoHistory,
    ].filter(Boolean) as TipItem[],
    previewStructuredContent: [
      base[3],
      ext.codeBlocksSelection,
      base[1],
      tips?.tipToggleHtmlPreview ? { ...tips.tipToggleHtmlPreview, desc: replaceShortcut(tips.tipToggleHtmlPreview.desc, 'toggleHtmlPreview', 'Ctrl+Alt+H') } : undefined,
      tips?.tipCsvPreview,
      tips?.tipHtmlDocuments,
    ].filter(Boolean) as TipItem[],
    workWithRichDocuments: [
      ext.mermaidAndMath,
      base[4],
      ext.docConversion,
      tips?.tipImageRows,
      tips?.tipOpenHtmlBrowser,
    ].filter(Boolean) as TipItem[],
    insightsAndExport: [
      ext.knowledgeGraph,
      ext.insightsSuite,
      ext.exportCenter,
      ext.aiManualPrompt,
    ].filter(Boolean) as TipItem[],
    personalizeMarkdownExplorer: [
      ext.visualThemeStyles,
      base[7],
      ext.tourAndKeybindings,
    ].filter(Boolean) as TipItem[],
  };

  return (Object.keys(groups) as TipGroupId[]).map((id) => ({
    id,
    title: labels[id],
    items: groups[id].map((item) => syncTipShortcuts(item, settings)),
  }));
}
