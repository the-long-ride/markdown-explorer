import type { AppState } from '../../contexts/appStateModel';
import type { Translations } from '../../contexts/translations';
import { getShellLocationLabel, supportsShellLocation } from '../../desktop/shellLocation';
import { getEnabledShortcut } from '../../utils/shortcuts';
import { TabContextMenu, type TabContextMenuAction } from '../shared/TabContextMenu';
import { CloseAllIcon, CloseOthersIcon, CloseRightIcon, CloseTabIcon, OpenFolderLocationIcon } from '../shared/icons';

interface DesktopTabContextMenuProps {
  state: AppState;
  translations: Translations;
  position: { x: number; y: number };
  tabIndex: number;
  tabCount: number;
  onAction: (action: TabContextMenuAction) => void;
  onClose: () => void;
}

export function DesktopTabContextMenu({ state, translations: t, position, tabIndex, tabCount, onAction, onClose }: DesktopTabContextMenuProps) {
  return <TabContextMenu
    x={position.x} y={position.y}
    labels={{ ...t.tabContextMenu, openLocation: supportsShellLocation(state.appRuntime)
      ? getShellLocationLabel(t, state.hostPlatform, 'folder') : undefined }}
    openLocationIcon={<OpenFolderLocationIcon />} closeThisTabIcon={<CloseTabIcon />}
    closeTabsToRightIcon={<CloseRightIcon />} closeOtherTabsIcon={<CloseOthersIcon />}
    closeAllTabsIcon={<CloseAllIcon />}
    shortcuts={{
      closeThisTab: getEnabledShortcut(state.settings, 'closeContentTab'),
      closeTabsToRight: getEnabledShortcut(state.settings, 'closeContentTabsToRight'),
      closeOtherTabs: getEnabledShortcut(state.settings, 'closeOtherContentTabs'),
      closeAllTabs: getEnabledShortcut(state.settings, 'closeAllContentTabs'),
    }}
    ariaLabel={t.tabContextMenu.menuLabel}
    disabled={{ closeThisTab: tabIndex === -1, closeTabsToRight: tabIndex === -1 || tabIndex >= tabCount - 1,
      closeOtherTabs: tabCount <= 1, closeAllTabs: tabCount === 0 }}
    onAction={onAction} onClose={onClose}
  />;
}
