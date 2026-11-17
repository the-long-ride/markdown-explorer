import type { AppState } from '../../contexts/appStateModel';
import type { SidebarPinnedItem, WorkspaceEntryKind } from '../../types';
import { normalizePathKey } from '../../contexts/appStateReducer';
import type { Translations } from '../../contexts/translations';
import { getHistoryAvailabilityCopy } from '../../history/historyAvailability';
import { getSplitViewTranslations } from '../../contexts/splitViewTranslations';
import { getShellLocationLabel, requestShellLocation, resolveWorkspaceFolderPath } from '../../desktop/shellLocation';
import { openLocalFileInBrowser } from '../../dom/htmlPreviewActions';
import type { PlatformBridge } from '../../platform/bridge';
import { getEnabledShortcut } from '../../utils/shortcuts';
import { requestOpenInSplit } from '../Content/documentFileDrop';
import { requestOpenDocumentHistory } from '../shared/ToolbarActionMenu';
import { CopyIcon, HistoryIcon, HtmlPreviewIcon, InternetIcon, MarkdownViewIcon, OpenFolderLocationIcon, TrashIcon, RevealFileLocationIcon, SplitViewIcon } from '../shared/icons';
import { isHtmlDocumentPath } from '../Content/HtmlDocumentView';
import type { SidebarItemMenuItem } from './SidebarItemMenu';
import type { SidebarItemMenuTarget } from './TreeNode';
import { FilePlusIcon, FolderPlusIcon, DownloadIcon } from './sidebarEntryIcons';
import { downloadWebDemoFile, downloadWebDemoFolderZip } from '../../utils/webDemoDownload';
import { RenameEntryIcon } from './sidebarRenameIcon';
import { PinIcon, UnpinIcon } from './sidebarPinIcons';

interface SidebarItemMenuOptions {
  state: AppState;
  target: SidebarItemMenuTarget | null;
  canOpenHtmlInBrowser: boolean;
  canOpenItemLocations: boolean;
  translations: Translations;
  bridge: PlatformBridge;
  navigate: (path: string, options?: { htmlPreviewOverride?: boolean }) => void;
  isPinned: boolean;
  pinLimitReached: boolean;
  onTogglePin: (item: SidebarPinnedItem) => void;
  onRenameEntry?: (kind: WorkspaceEntryKind, path: string) => void;
  onDeleteEntry?: (kind: WorkspaceEntryKind, path: string) => void;
  canChangeEntry?: (entry: { kind: WorkspaceEntryKind; path: string }) => boolean;
  onCreateEntry?: (kind: WorkspaceEntryKind, parentPath: string) => void;
}

export function buildSidebarItemMenuItems({
  state, target, canOpenHtmlInBrowser, canOpenItemLocations, translations: t, bridge, navigate,
  isPinned, pinLimitReached, onTogglePin, onCreateEntry, onRenameEntry, onDeleteEntry, canChangeEntry,
}: SidebarItemMenuOptions): readonly SidebarItemMenuItem[] {
  if (!target) return [];
  const items: SidebarItemMenuItem[] = [];
  const pinItem: SidebarPinnedItem = { kind: target.kind, path: target.path };
  if (target.kind === 'folder' && onCreateEntry) {
    items.push({ id: 'new-file', label: t.sidebar.newFileMenu, icon: <FilePlusIcon size={14} />, onSelect: () => onCreateEntry('file', target.path) });
    items.push({ id: 'new-folder', label: t.sidebar.newFolderMenu, icon: <FolderPlusIcon size={14} />, onSelect: () => onCreateEntry('folder', target.path) });
  }
  if (onRenameEntry) items.push({ id: 'rename-entry', label: target.kind === 'file' ? t.sidebar.renameFile : t.sidebar.renameFolder,
    icon: <RenameEntryIcon />, shortcut: 'F2', disabled: canChangeEntry ? !canChangeEntry(target) : false, dividerBefore: items.length > 0, onSelect: () => onRenameEntry(target.kind, target.path) });
  if (onDeleteEntry) items.push({ id: 'delete-entry', label: target.kind === 'file' ? t.sidebar.deleteFile : t.sidebar.deleteFolder,
    icon: <TrashIcon size={14} />, shortcut: 'Del', disabled: canChangeEntry ? !canChangeEntry(target) : false, onSelect: () => onDeleteEntry(target.kind, target.path) });
  if (isPinned) {
    items.push({
      id: 'unpin',
      label: t.sidebar.unpinItem,
      icon: <UnpinIcon />,
      dividerBefore: items.length > 0,
      onSelect: () => onTogglePin(pinItem),
    });
  } else {
    items.push({
      id: target.kind === 'file' ? 'pin-this-file' : 'pin-this-folder',
      label: target.kind === 'file'
        ? t.sidebar.pinThisFile
        : t.sidebar.pinThisFolder,
      icon: <PinIcon />,
      dividerBefore: items.length > 0,
      disabled: pinLimitReached,
      onSelect: () => onTogglePin(pinItem),
    });
  }
  const isWeb = typeof (window as any).__webBus !== 'undefined';
  if (target.kind === 'file') {
    items.push({
      id: 'open-in-split',
      label: getSplitViewTranslations(state.settings.language).openInSplit,
      icon: <SplitViewIcon size={14} />,
      dividerBefore: items.length > 0,
      onSelect: () => requestOpenInSplit(target.path),
    });
    const baseRevisionLabel = getHistoryAvailabilityCopy(state.settings.language).revision;
    items.push({
      id: 'history',
      label: isWeb ? `${baseRevisionLabel} (Web unavailable)` : baseRevisionLabel,
      icon: <HistoryIcon size={14} />,
      disabled: isWeb,
      onSelect: () => requestOpenDocumentHistory(target.path),
    });
  }
  if (target.kind === 'file' && isHtmlDocumentPath(target.path)) {
    const targetPathKey = normalizePathKey(target.path);
    const matchingTab = state.contentTabs.find((tab) => normalizePathKey(tab.filePath) === targetPathKey);
    const currentOverride = normalizePathKey(state.currentFile ?? '') === targetPathKey
      ? state.currentHtmlPreviewOverride : undefined;
    const htmlPreviewEnabled = matchingTab?.htmlPreviewOverride ?? currentOverride ?? state.settings.defaultHtmlPreview;
    if (canOpenHtmlInBrowser) {
      items.push({ id: 'open-in-browser', label: t.openInBrowser, icon: <InternetIcon />, dividerBefore: items.length > 0, onSelect: () => {
        if (!openLocalFileInBrowser(bridge, target.path)) {
          window.dispatchEvent(new CustomEvent('markdown-explorer-action-notice', { detail: t.previewActions.openError }));
        }
      }});
    }
    items.push({ id: 'toggle-html-preview', dividerBefore: items.length === 1, label: htmlPreviewEnabled ? t.showMarkdownView : t.showHtmlPreview,
      icon: htmlPreviewEnabled ? <MarkdownViewIcon /> : <HtmlPreviewIcon />,
      shortcut: getEnabledShortcut(state.settings, 'toggleHtmlPreview'),
      onSelect: () => navigate(target.path, { htmlPreviewOverride: !htmlPreviewEnabled }) });
  }
  if (isWeb) {
    if (target.kind === 'file') {
      items.push({
        id: 'download-file',
        label: t.sidebar.downloadFile,
        icon: <DownloadIcon size={14} />,
        dividerBefore: items.length > 0,
        onSelect: () => {
          const file = state.fileList?.find((f) => f.fsPath === target.path || f.relativePath === target.path) ?? {
            fileName: target.path.split(/[\\/]/).pop() || 'document.md',
            fsPath: target.path,
            relativePath: target.path,
            extension: '.md',
            documentKind: 'markdown',
          };
          void downloadWebDemoFile(file as any, state);
        },
      });
    } else if (target.kind === 'folder') {
      items.push({
        id: 'download-folder-zip',
        label: t.sidebar.downloadFolderZip,
        icon: <DownloadIcon size={14} />,
        dividerBefore: items.length > 0,
        onSelect: () => {
          const folderName = target.path.split(/[\\/]/).filter(Boolean).pop() || 'folder';
          void downloadWebDemoFolderZip(target.path, folderName, state);
        },
      });
    }
  }

  const copyPathToClipboard = (textToCopy: string) => {
    try {
      void bridge.copyToClipboard(textToCopy);
    } catch {
      void navigator.clipboard?.writeText(textToCopy);
    }
  };

  const getTargetPaths = () => {
    if (target.kind === 'file') {
      const fullPath = target.path;
      const matching = state.fileList?.find((f) => f.fsPath === target.path);
      let relativePath = matching?.relativePath;
      if (!relativePath) {
        if (state.workspacePath && target.path.startsWith(state.workspacePath)) {
          relativePath = target.path.slice(state.workspacePath.length).replace(/^[\/\\]+/, '');
        } else {
          relativePath = target.path;
        }
      }
      return { fullPath, relativePath };
    }
    const fullPath = resolveWorkspaceFolderPath(state.workspacePath || '', target.path, state.hostPlatform);
    const separator = state.hostPlatform === 'windows' ? '\\' : '/';
    const relativePath = target.path.replace(/[\\/]+/g, separator);
    return { fullPath, relativePath };
  };

  const { fullPath, relativePath } = getTargetPaths();

  items.push({
    id: 'copy-relative-path',
    label: t.sidebar.copyRelativePath,
    icon: <CopyIcon size={14} />,
    dividerBefore: items.length > 0,
    onSelect: () => {
      copyPathToClipboard(relativePath);
      window.dispatchEvent(new CustomEvent('markdown-explorer-action-notice', { detail: t.rendererUi.copied }));
    },
  });

  items.push({
    id: 'copy-full-path',
    label: t.sidebar.copyFullPath,
    icon: <CopyIcon size={14} />,
    onSelect: () => {
      copyPathToClipboard(fullPath);
      window.dispatchEvent(new CustomEvent('markdown-explorer-action-notice', { detail: t.rendererUi.copied }));
    },
  });

  if (canOpenItemLocations) {
    items.push({ id: 'open-location', label: getShellLocationLabel(t, state.hostPlatform, target.kind),
      icon: target.kind === 'file' ? <RevealFileLocationIcon /> : <OpenFolderLocationIcon />,
      shortcut: target.kind === 'file' ? getEnabledShortcut(state.settings, 'openCurrentDocumentLocation') : undefined,
      dividerBefore: false,
      onSelect: () => target.kind === 'file'
        ? requestShellLocation(bridge, target.path, 'reveal-file')
        : requestShellLocation(bridge, resolveWorkspaceFolderPath(state.workspacePath || '', target.path, state.hostPlatform), 'open-directory') });
  }
  return items;
}
