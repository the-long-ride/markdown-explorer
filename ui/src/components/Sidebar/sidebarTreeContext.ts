import { createContext, useContext, type ReactNode } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
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
  readonly currentFile?: string | null;
  readonly showTitle?: boolean;
  readonly navigate?: (filePath: string) => void;
}

export const SidebarTreeEntryContext = createContext<SidebarTreeEntryContextValue | null>(null);

export function useSidebarTreeEntry(): SidebarTreeEntryContextValue | null {
  return useContext(SidebarTreeEntryContext);
}

export function useResolvedSidebarTreeEntry(): SidebarTreeEntryContextValue {
  const entry = useContext(SidebarTreeEntryContext);
  const { state, navigate } = useAppState();
  if (entry && entry.currentFile !== undefined) {
    return entry;
  }
  return {
    inlineParentPath: entry?.inlineParentPath ?? null,
    inlineInput: entry?.inlineInput ?? null,
    revealPath: entry?.revealPath ?? null,
    selectionActive: entry?.selectionActive ?? false,
    focusedKey: entry?.focusedKey,
    renameKey: entry?.renameKey,
    renameInput: entry?.renameInput,
    isSelected: entry?.isSelected ?? (() => false),
    toggleSelected: entry?.toggleSelected ?? (() => {}),
    selectItemLabel: entry?.selectItemLabel ?? '',
    rememberFocus: entry?.rememberFocus ?? (() => {}),
    onFolderCollapsed: entry?.onFolderCollapsed,
    currentFile: state.currentFile,
    showTitle: state.settings.showTitle,
    navigate,
  };
}

export function sidebarTreeForcesOpen(value: SidebarTreeEntryContextValue, folderPath: string): boolean {
  return [value.inlineParentPath, value.revealPath]
    .some((target) => Boolean(target) && isSameOrDescendant(target as string, folderPath));
}
