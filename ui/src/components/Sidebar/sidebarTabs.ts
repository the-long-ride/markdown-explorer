import type { ReactNode } from 'react';
import type { SidebarTabId } from '../../contexts/appStateModel';

export interface SidebarTabDescriptor {
  readonly id: SidebarTabId;
  readonly label: string;
  readonly icon: ReactNode;
  readonly shortcut?: string;
  readonly count?: number;
  readonly indicator?: 'accent-dot';
}

interface BuildVisibleSidebarTabsInput {
  readonly bookmarksEnabled: boolean;
  readonly historyEnabled: boolean;
  readonly historyIndicator?: 'accent-dot';
  readonly filesLabel: string;
  readonly searchLabel: string;
  readonly bookmarksLabel: string;
  readonly historyLabel: string;
  readonly filesShortcut?: string;
  readonly searchShortcut?: string;
  readonly bookmarksShortcut?: string;
  readonly fileCount: number;
  readonly bookmarkCount: number;
  readonly icons: Readonly<Record<SidebarTabId, ReactNode>>;
}

export function buildVisibleSidebarTabs(input: BuildVisibleSidebarTabsInput): readonly SidebarTabDescriptor[] {
  const tabs: SidebarTabDescriptor[] = [
    { id: 'files', label: input.filesLabel, icon: input.icons.files, shortcut: input.filesShortcut, count: input.fileCount },
    { id: 'search', label: input.searchLabel, icon: input.icons.search, shortcut: input.searchShortcut },
  ];
  if (input.bookmarksEnabled) {
    tabs.push({
      id: 'bookmarks',
      label: input.bookmarksLabel,
      icon: input.icons.bookmarks,
      shortcut: input.bookmarksShortcut,
      count: input.bookmarkCount,
    });
  }
  if (input.historyEnabled) {
    tabs.push({ id: 'history', label: input.historyLabel, icon: input.icons.history, indicator: input.historyIndicator });
  }
  return tabs;
}

export function sidebarTabIndex(tabs: readonly SidebarTabDescriptor[], id: SidebarTabId): number {
  const index = tabs.findIndex((tab) => tab.id === id);
  return index < 0 ? 0 : index;
}
