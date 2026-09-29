import type { AppState } from '../../contexts/appStateModel';
import { normalizePathKey } from '../../contexts/appStateModel';
import { getHistoryAvailabilityCopy } from '../../history/historyAvailability';
import { getSplitViewTranslations } from '../../contexts/splitViewTranslations';
import type { Translations } from '../../contexts/translations';
import { getShellLocationLabel, supportsShellLocation } from '../../desktop/shellLocation';
import { supportsLocalFileBrowserOpen } from '../../dom/localFileBrowserSupport';
import { getEnabledShortcut } from '../../utils/shortcuts';
import type { TabContextMenuItem } from '../shared/TabContextMenu';
import { CloseAllIcon, CloseOthersIcon, CloseRightIcon, CloseTabIcon, HistoryIcon, HtmlPreviewIcon, InternetIcon, MarkdownViewIcon, OpenFolderLocationIcon, SplitViewIcon } from '../shared/icons';
import { isHtmlDocumentPath } from './HtmlDocumentView';
import type { PaneId } from '../../split-view/paneState';

export interface ContentTabContextMenuOptions {
  paneId?: PaneId;
  paneTabs?: readonly string[];
  targetFilePath?: string;
}

export function buildContentTabContextMenuItems(
  state: AppState,
  translations: Translations,
  tabIndex: number,
  options?: ContentTabContextMenuOptions,
): readonly TabContextMenuItem[] {
  const filePath = options?.targetFilePath ?? (tabIndex >= 0 ? state.contentTabs[tabIndex]?.filePath : null);
  if (!filePath && tabIndex < 0) return [];

  const tab = (filePath ? state.contentTabs.find((item) => normalizePathKey(item.filePath) === normalizePathKey(filePath)) : null)
    ?? (tabIndex >= 0 ? state.contentTabs[tabIndex] : null)
    ?? (filePath ? { filePath, fileName: filePath.split(/[\\/]/).pop() ?? filePath, relativePath: filePath, htmlPreviewOverride: undefined } : null);

  if (!tab) return [];
  const isHtml = isHtmlDocumentPath(tab.filePath);
  const htmlPreview = tab.htmlPreviewOverride ?? state.settings.defaultHtmlPreview;
  const toggleHtmlPreviewShortcut = getEnabledShortcut(state.settings, 'toggleHtmlPreview');
  const splitT = getSplitViewTranslations(state.settings.language);
  const revisionLabel = getHistoryAvailabilityCopy(state.settings.language).revision;
  const splitView = state.splitView;
  const splitActive = Boolean(splitView?.enabled);

  const totalTabs = options?.paneTabs ? options.paneTabs.length : state.contentTabs.length;
  const resolvedIndex = options?.paneTabs
    ? options.paneTabs.findIndex((path) => normalizePathKey(path) === normalizePathKey(tab.filePath))
    : tabIndex;

  const targetPaneId = options?.paneId;
  const isTargetAlreadyInOppositePane = splitActive && (
    targetPaneId === 'secondary'
      ? splitView?.primary.filePath === tab.filePath
      : splitView?.secondary.filePath === tab.filePath
  );

  return [
    ...(isHtml && supportsLocalFileBrowserOpen(state.appRuntime)
      ? [{ action: 'openInBrowser' as const, label: translations.openInBrowser, icon: <InternetIcon /> }]
      : []),
    ...(isHtml ? [{ action: 'toggleHtmlDocumentView' as const, label: htmlPreview ? translations.showMarkdownView : translations.showHtmlPreview,
      icon: htmlPreview ? <MarkdownViewIcon /> : <HtmlPreviewIcon />, shortcut: toggleHtmlPreviewShortcut }] : []),
    ...(supportsShellLocation(state.appRuntime) ? [{ action: 'openLocation' as const,
      label: getShellLocationLabel(translations, state.hostPlatform, 'folder'), icon: <OpenFolderLocationIcon />,
      shortcut: getEnabledShortcut(state.settings, 'openCurrentDocumentLocation'), dividerBefore: isHtml }] : []),
    {
      action: 'openInSplit',
      label: splitT.openInSplit,
      icon: <SplitViewIcon size={14} />,
      dividerBefore: true,
      disabled: isTargetAlreadyInOppositePane,
    },

    {
      action: 'history',
      label: revisionLabel,
      icon: <HistoryIcon size={14} />,
    },

    { action: 'closeThisTab', label: translations.tabContextMenu.closeThisTab, icon: <CloseTabIcon />, shortcut: getEnabledShortcut(state.settings, 'closeContentTab'), primary: true, disabled: resolvedIndex === -1, dividerBefore: true },
    { action: 'closeTabsToRight', label: translations.tabContextMenu.closeTabsToRight, icon: <CloseRightIcon />, shortcut: getEnabledShortcut(state.settings, 'closeContentTabsToRight'), disabled: resolvedIndex >= totalTabs - 1 },
    { action: 'closeOtherTabs', label: translations.tabContextMenu.closeOtherTabs, icon: <CloseOthersIcon />, shortcut: getEnabledShortcut(state.settings, 'closeOtherContentTabs'), disabled: totalTabs <= 1 },
    { action: 'closeAllTabs', label: translations.tabContextMenu.closeAllTabs, icon: <CloseAllIcon />, shortcut: getEnabledShortcut(state.settings, 'closeAllContentTabs'), disabled: totalTabs === 0 },
  ];
}


export function buildSplitHeaderContextMenuItems(splitT: ReturnType<typeof getSplitViewTranslations>): TabContextMenuItem[] {
  return [
    { action: 'swapPanes', label: splitT.swapPanes, icon: <SplitViewIcon size={14} />, primary: true },
    { action: 'closeSplit', label: splitT.closeSplit, icon: <CloseTabIcon />, dividerBefore: true },
  ];
}
