import type { ReactNode } from 'react';
import type { SidebarTabId } from '../../contexts/appStateModel';

export interface SidebarTabDescriptor {
  readonly id: SidebarTabId;
  readonly label: string;
  readonly icon: ReactNode;
  readonly count?: number;
}

interface BuildVisibleSidebarTabsInput {
  readonly bookmarksEnabled: boolean;
  readonly historyEnabled: boolean;
  readonly filesLabel: string;
  readonly searchLabel: string;
  readonly bookmarksLabel: string;
  readonly historyLabel: string;
  readonly fileCount: number;
  readonly bookmarkCount: number;
  readonly icons: Readonly<Record<SidebarTabId, ReactNode>>;
}

export function buildVisibleSidebarTabs(input: BuildVisibleSidebarTabsInput): readonly SidebarTabDescriptor[] {
  const tabs: SidebarTabDescriptor[] = [
    { id: 'files', label: input.filesLabel, icon: input.icons.files, count: input.fileCount },
    { id: 'search', label: input.searchLabel, icon: input.icons.search },
  ];
  if (input.bookmarksEnabled) {
    tabs.push({ id: 'bookmarks', label: input.bookmarksLabel, icon: input.icons.bookmarks, count: input.bookmarkCount });
  }
  if (input.historyEnabled) {
    tabs.push({ id: 'history', label: input.historyLabel, icon: input.icons.history });
  }
  return tabs;
}

export function sidebarTabIndex(tabs: readonly SidebarTabDescriptor[], id: SidebarTabId): number {
  const index = tabs.findIndex((tab) => tab.id === id);
  return index < 0 ? 0 : index;
}
