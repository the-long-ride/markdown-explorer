import type { SidebarSortMode } from '../../types';
import { CheckIcon } from '../shared/icons';
import { SidebarItemMenu } from './SidebarItemMenu';
import type { SidebarItemMenuItem } from './SidebarItemMenu';
import { DEFAULT_SIDEBAR_SORT_MODE } from './sidebarWorkspacePreferences';

interface SidebarSortLabels {
  menu: string;
  nameAsc: string;
  nameDesc: string;
  modifiedDesc: string;
  modifiedAsc: string;
}

interface SidebarSortMenuProps {
  anchor: HTMLElement;
  sidebar: HTMLElement;
  value: SidebarSortMode;
  labels: SidebarSortLabels;
  onChange: (mode: SidebarSortMode) => void;
  onClose: () => void;
}

export function SidebarSortMenu({
  anchor,
  sidebar,
  value,
  labels,
  onChange,
  onClose,
}: SidebarSortMenuProps) {
  const choices: readonly [SidebarSortMode, string][] = [
    ['name-asc', labels.nameAsc],
    ['name-desc', labels.nameDesc],
    ['modified-desc', labels.modifiedDesc],
    ['modified-asc', labels.modifiedAsc],
  ];
  const items: readonly SidebarItemMenuItem[] = choices.map(([mode, label]) => ({
    id: `sort-${mode}`,
    label,
    icon: mode === value ? <CheckIcon size={12} /> : <span aria-hidden="true" />,
    onSelect: () => onChange(mode === value ? DEFAULT_SIDEBAR_SORT_MODE : mode),
  }));

  return (
    <SidebarItemMenu
      anchor={anchor}
      sidebar={sidebar}
      menuLabel={labels.menu}
      items={items}
      onClose={onClose}
    />
  );
}
