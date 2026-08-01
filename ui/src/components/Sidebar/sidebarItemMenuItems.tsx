import type { AppState } from '../../contexts/appStateModel';
import { normalizePathKey } from '../../contexts/appStateReducer';
import type { Translations } from '../../contexts/translations';
import { getShellLocationLabel, requestShellLocation, resolveWorkspaceFolderPath } from '../../desktop/shellLocation';
import { openLocalFileInBrowser } from '../../dom/htmlPreviewActions';
import type { PlatformBridge } from '../../platform/bridge';
import { getEnabledShortcut } from '../../utils/shortcuts';
import { HtmlPreviewIcon, InternetIcon, MarkdownViewIcon, OpenFolderLocationIcon, RevealFileLocationIcon } from '../shared/icons';
import { isHtmlDocumentPath } from '../Content/HtmlDocumentView';
import type { SidebarItemMenuItem } from './SidebarItemMenu';
import type { SidebarItemMenuTarget } from './TreeNode';

interface SidebarItemMenuOptions {
  state: AppState;
  target: SidebarItemMenuTarget | null;
  canOpenHtmlInBrowser: boolean;
  canOpenItemLocations: boolean;
  translations: Translations;
  bridge: PlatformBridge;
  navigate: (path: string, options?: { htmlPreviewOverride?: boolean }) => void;
}

export function buildSidebarItemMenuItems({
  state, target, canOpenHtmlInBrowser, canOpenItemLocations, translations: t, bridge, navigate,
}: SidebarItemMenuOptions): readonly SidebarItemMenuItem[] {
  if (!target) return [];
  const items: SidebarItemMenuItem[] = [];
  if (target.kind === 'file' && isHtmlDocumentPath(target.path)) {
    const targetPathKey = normalizePathKey(target.path);
    const matchingTab = state.contentTabs.find((tab) => normalizePathKey(tab.filePath) === targetPathKey);
    const currentOverride = normalizePathKey(state.currentFile ?? '') === targetPathKey
      ? state.currentHtmlPreviewOverride : undefined;
    const htmlPreviewEnabled = matchingTab?.htmlPreviewOverride ?? currentOverride ?? state.settings.defaultHtmlPreview;
    if (canOpenHtmlInBrowser) {
      items.push({ id: 'open-in-browser', label: t.openInBrowser, icon: <InternetIcon />, onSelect: () => {
        if (!openLocalFileInBrowser(bridge, target.path)) {
          window.dispatchEvent(new CustomEvent('markdown-explorer-action-notice', { detail: t.previewActions.openError }));
        }
      }});
    }
    items.push({ id: 'toggle-html-preview', label: htmlPreviewEnabled ? t.showMarkdownView : t.showHtmlPreview,
      icon: htmlPreviewEnabled ? <MarkdownViewIcon /> : <HtmlPreviewIcon />,
      shortcut: getEnabledShortcut(state.settings, 'toggleHtmlPreview'),
      onSelect: () => navigate(target.path, { htmlPreviewOverride: !htmlPreviewEnabled }) });
  }
  if (canOpenItemLocations) {
    items.push({ id: 'open-location', label: getShellLocationLabel(t, state.hostPlatform, target.kind),
      icon: target.kind === 'file' ? <RevealFileLocationIcon /> : <OpenFolderLocationIcon />,
      shortcut: target.kind === 'file' ? getEnabledShortcut(state.settings, 'openCurrentDocumentLocation') : undefined,
      dividerBefore: items.length > 0,
      onSelect: () => target.kind === 'file'
        ? requestShellLocation(bridge, target.path, 'reveal-file')
        : requestShellLocation(bridge, resolveWorkspaceFolderPath(state.workspacePath || '', target.path, state.hostPlatform), 'open-directory') });
  }
  return items;
}
