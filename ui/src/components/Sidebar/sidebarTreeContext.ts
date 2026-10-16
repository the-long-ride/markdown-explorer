import { createContext, useContext, type ReactNode } from 'react';
import type { SidebarItemKind } from '../../types';
import { isSameOrDescendant } from '../../workspace/workspaceEntryPaths';

/** Carries file-op state to tree rows so TreeNode props do not grow. Null outside the Files tab or in revision mode. */
export interface SidebarTreeEntryContextValue {
  readonly inlineParentPath: string | null;
  readonly inlineInput: ReactNode;
  readonly revealPath: string | null;
  readonly selectionActive: boolean;
  readonly focusedKey?: string | null;
  readonly renameKey?: string | null;
  readonly renameInput?: ReactNode;
  readonly isSelected: (key: string) => boolean;
  readonly toggleSelected: (kind: SidebarItemKind, path: string) => void;
  readonly selectItemLabel: string;
  readonly rememberFocus: (kind: SidebarItemKind, path: string) => void;
  /** Called when the user closes an open folder, so a draft hosted inside it can be dropped. */
  readonly onFolderCollapsed?: (folderPath: string) => void;
}

export const SidebarTreeEntryContext = createContext<SidebarTreeEntryContextValue | null>(null);

export function useSidebarTreeEntry(): SidebarTreeEntryContextValue | null {
  return useContext(SidebarTreeEntryContext);
}

export function sidebarTreeForcesOpen(value: SidebarTreeEntryContextValue, folderPath: string): boolean {
  return [value.inlineParentPath, value.revealPath]
    .some((target) => Boolean(target) && isSameOrDescendant(target as string, folderPath));
}
