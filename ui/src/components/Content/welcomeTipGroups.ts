import type { AppSettings } from '../../types';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';
import { formatShortcutLabel, getEnabledShortcut } from '../../utils/shortcuts';
import { TIP_GROUP_LABELS, TIPS_CONTENT, type TipGroupId, type TipItem } from './welcomeTipsContent';

export type WelcomeTipGroup = {
  id: TipGroupId;
  title: string;
  items: TipItem[];
};

type WelcomeTipsTranslations = ReturnType<typeof getWelcomeTranslations>['tips'];

export function buildWelcomeTipGroups(
  currentLang: string,
  settings: AppSettings,
  tips: WelcomeTipsTranslations,
): WelcomeTipGroup[] {
  const shortcut = (action: string) =>
    formatShortcutLabel(getEnabledShortcut(settings, action as keyof AppSettings['keybindings']) || '');
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
  return (Object.keys(groups) as TipGroupId[]).map((id) => ({ id, title: labels[id], items: groups[id] }));
}
