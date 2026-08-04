import { useCallback, useMemo } from 'react';
import type { AppSettings, MdFile } from '../../types';
import type { ScopeFocusTreeProps } from './TreeNode';

interface UseSidebarScopeFocusOptions {
  fileList: readonly MdFile[];
  settings: AppSettings;
  workspaceKey: string;
  editing: boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

export function useSidebarScopeFocus({
  fileList,
  settings,
  workspaceKey,
  editing,
  updateSettings,
}: UseSidebarScopeFocusOptions) {
  const scopeFocusMap = settings.scopeFocus ?? {};
  const hasScopeEntry = Object.prototype.hasOwnProperty.call(scopeFocusMap, workspaceKey);
  const allFilePaths = useMemo(() => fileList.map((file) => file.fsPath), [fileList]);
  const allFilePathSet = useMemo(() => new Set(allFilePaths), [allFilePaths]);
  const storedScopePaths = scopeFocusMap[workspaceKey] ?? [];
  const selectedFilePaths = useMemo(() => {
    if (!hasScopeEntry) return allFilePathSet;
    return new Set(storedScopePaths.filter((path) => allFilePathSet.has(path)));
  }, [allFilePathSet, hasScopeEntry, storedScopePaths]);
  const hideUnselected = hasScopeEntry
    && !editing
    && selectedFilePaths.size < allFilePaths.length;

  const updateScopeFocusPaths = useCallback((nextPaths: Iterable<string>) => {
    const normalized = [...new Set(nextPaths)].filter((path) => allFilePathSet.has(path));
    const nextScopeFocus = { ...(settings.scopeFocus ?? {}) };
    if (normalized.length >= allFilePaths.length) delete nextScopeFocus[workspaceKey];
    else nextScopeFocus[workspaceKey] = normalized;
    updateSettings({ scopeFocus: nextScopeFocus });
  }, [allFilePathSet, allFilePaths.length, settings.scopeFocus, updateSettings, workspaceKey]);

  const onFileChange = useCallback((path: string, checked: boolean) => {
    const next = new Set(hasScopeEntry ? selectedFilePaths : allFilePaths);
    if (checked) next.add(path);
    else next.delete(path);
    updateScopeFocusPaths(next);
  }, [allFilePaths, hasScopeEntry, selectedFilePaths, updateScopeFocusPaths]);

  const onFolderChange = useCallback((paths: readonly string[], checked: boolean) => {
    const next = new Set(hasScopeEntry ? selectedFilePaths : allFilePaths);
    for (const path of paths) {
      if (checked) next.add(path);
      else next.delete(path);
    }
    updateScopeFocusPaths(next);
  }, [allFilePaths, hasScopeEntry, selectedFilePaths, updateScopeFocusPaths]);

  const clear = useCallback(() => {
    const nextScopeFocus = { ...(settings.scopeFocus ?? {}) };
    delete nextScopeFocus[workspaceKey];
    updateSettings({ scopeFocus: nextScopeFocus });
  }, [settings.scopeFocus, updateSettings, workspaceKey]);

  const allSelected = allFilePaths.length > 0
    && selectedFilePaths.size === allFilePaths.length;
  const toggleAll = useCallback(() => {
    updateScopeFocusPaths(allSelected ? [] : allFilePaths);
  }, [allFilePaths, allSelected, updateScopeFocusPaths]);

  const treeProps = useMemo<ScopeFocusTreeProps>(() => ({
    editing,
    hideUnselected,
    selectedFilePaths,
    onFileChange,
    onFolderChange,
  }), [editing, hideUnselected, onFileChange, onFolderChange, selectedFilePaths]);

  return {
    allFilePaths,
    selectedFilePaths,
    hideUnselected,
    hasScopeEntry,
    count: hasScopeEntry ? selectedFilePaths.size : allFilePaths.length,
    allSelected,
    clear,
    toggleAll,
    treeProps,
  };
}
