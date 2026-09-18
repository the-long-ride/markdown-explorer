import type { AppState } from '../../contexts/appStateModel';
import { getSplitViewTranslations } from '../../contexts/splitViewTranslations';
import type { Translations } from '../../contexts/translations';
import { getShellLocationLabel, supportsShellLocation } from '../../desktop/shellLocation';
import { supportsLocalFileBrowserOpen } from '../../dom/localFileBrowserSupport';
import { getEnabledShortcut } from '../../utils/shortcuts';
import type { TabContextMenuItem } from '../shared/TabContextMenu';
import { CloseAllIcon, CloseOthersIcon, CloseRightIcon, CloseTabIcon, HtmlPreviewIcon, InternetIcon, MarkdownViewIcon, OpenFolderLocationIcon } from '../shared/icons';
import { isHtmlDocumentPath } from './HtmlDocumentView';

export function buildContentTabContextMenuItems(
  state: AppState,
  translations: Translations,
  tabIndex: number,
): readonly TabContextMenuItem[] {
  const tab = tabIndex >= 0 ? state.contentTabs[tabIndex] : null;
  if (!tab) return [];
  const isHtml = isHtmlDocumentPath(tab.filePath);
  const htmlPreview = tab.htmlPreviewOverride ?? state.settings.defaultHtmlPreview;
  const toggleHtmlPreviewShortcut = getEnabledShortcut(state.settings, 'toggleHtmlPreview');
  const splitT = getSplitViewTranslations(state.settings.language);
  const splitView = state.splitView;
  const splitActive = Boolean(splitView?.enabled);
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
      dividerBefore: true,
      disabled: splitActive && splitView?.secondary.filePath === tab.filePath,
    },
    ...(splitActive ? [
      { action: 'moveToOtherPane' as const, label: splitT.moveToOtherPane },
      { action: 'swapPanes' as const, label: splitT.swapPanes },
      { action: 'closeSplit' as const, label: splitT.closeSplit },
    ] : []),
    { action: 'closeThisTab', label: translations.tabContextMenu.closeThisTab, icon: <CloseTabIcon />, shortcut: getEnabledShortcut(state.settings, 'closeContentTab'), primary: true, disabled: tabIndex === -1, dividerBefore: true },
    { action: 'closeTabsToRight', label: translations.tabContextMenu.closeTabsToRight, icon: <CloseRightIcon />, shortcut: getEnabledShortcut(state.settings, 'closeContentTabsToRight'), disabled: tabIndex >= state.contentTabs.length - 1 },
    { action: 'closeOtherTabs', label: translations.tabContextMenu.closeOtherTabs, icon: <CloseOthersIcon />, shortcut: getEnabledShortcut(state.settings, 'closeOtherContentTabs'), disabled: state.contentTabs.length <= 1 },
    { action: 'closeAllTabs', label: translations.tabContextMenu.closeAllTabs, icon: <CloseAllIcon />, shortcut: getEnabledShortcut(state.settings, 'closeAllContentTabs'), disabled: state.contentTabs.length === 0 },
  ];
}
