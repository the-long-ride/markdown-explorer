import type { AppSettings } from '../../types';
import { formatShortcutLabel, getEnabledShortcut } from '../../utils/shortcuts';
import { TIP_GROUP_LABELS, TIPS_CONTENT, type TipGroupId, type TipItem } from './welcomeTipsContent';

export type WelcomeTipGroup = {
  id: TipGroupId;
  title: string;
  items: TipItem[];
};

type WelcomeTipsTranslations = any;

function syncTipShortcuts(item: TipItem, settings: AppSettings): TipItem {
  if (!item || !item.desc) return item;

  const getBinding = (actionId: string) => {
    const bound = getEnabledShortcut(settings, actionId);
    return bound ? formatShortcutLabel(bound) : '';
  };

  let desc = item.desc;
  const qs = getBinding('quickSearch');
  const sat = getBinding('searchAllTabs');
  const fif = getBinding('findInFile');
  const fm = getBinding('toggleFocusMode');
  const sw = getBinding('toggleWorkspaceModal');

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

  return { ...item, desc };
}

export function buildWelcomeTipGroups(
  currentLang: string,
  settings: AppSettings,
  tips: WelcomeTipsTranslations,
): WelcomeTipGroup[] {
  const shortcut = (action: string) =>
    formatShortcutLabel(getEnabledShortcut(settings, action) || '');
  const replaceShortcut = (value: string | undefined, action: string) =>
    value ? value.replace('{shortcut}', shortcut(action)) : '';

  const base = TIPS_CONTENT[currentLang] || TIPS_CONTENT.en;
  const labels = TIP_GROUP_LABELS[currentLang] || TIP_GROUP_LABELS.en;

  const groups: Record<TipGroupId, TipItem[]> = {
    navigateAndOrganize: [
      base[0], base[2], base[5], base[6], base[8],
      tips?.tipToggleDesktopView ? { ...tips.tipToggleDesktopView, desc: replaceShortcut(tips.tipToggleDesktopView.desc, 'toggleDesktopViewMode') } : undefined,
      tips?.tipOpenContainingFolder ? { ...tips.tipOpenContainingFolder, desc: replaceShortcut(tips.tipOpenContainingFolder.desc, 'openCurrentDocumentLocation') } : undefined,
      tips?.tipSidebarActions,
      tips?.tipWorkspaceRecovery,
    ].filter(Boolean) as TipItem[],
    previewStructuredContent: [
      base[1], base[3],
      tips?.tipToggleHtmlPreview ? { ...tips.tipToggleHtmlPreview, desc: replaceShortcut(tips.tipToggleHtmlPreview.desc, 'toggleHtmlPreview') } : undefined,
      tips?.tipCsvPreview,
      tips?.tipHtmlDocuments,
    ].filter(Boolean) as TipItem[],
    workWithRichDocuments: [base[4], tips?.tipOpenHtmlBrowser, tips?.tipImageRows].filter(Boolean) as TipItem[],
    personalizeMarkdownExplorer: [base[7]].filter(Boolean) as TipItem[],
  };

  return (Object.keys(groups) as TipGroupId[]).map((id) => ({
    id,
    title: labels[id],
    items: groups[id].map((item) => syncTipShortcuts(item, settings)),
  }));
}
