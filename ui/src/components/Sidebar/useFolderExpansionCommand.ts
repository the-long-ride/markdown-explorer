import { useCallback, useState } from 'react';
import type { FolderExpansionCommand } from './TreeNode';

export function useFolderExpansionCommand() {
  const [folderExpansionCommand, setFolderExpansionCommand] =
    useState<FolderExpansionCommand>({ version: 0, expanded: true });

  const setAllFoldersExpanded = useCallback((expanded: boolean) => {
    setFolderExpansionCommand((current) => ({
      version: current.version + 1,
      expanded,
    }));
  }, []);

  const collapseAllFolders = useCallback(
    () => setAllFoldersExpanded(false),
    [setAllFoldersExpanded],
  );
  const expandAllFolders = useCallback(
    () => setAllFoldersExpanded(true),
    [setAllFoldersExpanded],
  );

  return { folderExpansionCommand, collapseAllFolders, expandAllFolders };
}
