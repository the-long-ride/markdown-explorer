import { useCallback, useEffect, useMemo } from 'react';
import type { AppSettings, FolderNode, SidebarPinnedItem, SidebarSortMode } from '../../types';
import {
  clearWorkspacePins,
  collectSidebarItemKeys,
  getSidebarPinnedItemKey,
  getWorkspacePins,
  getWorkspaceSortMode,
  normalizeMaxPinnedItems,
  reconcileWorkspacePins,
  setWorkspacePins,
  toggleWorkspacePin,
} from './sidebarWorkspacePreferences';

interface SidebarPinnedSortingOptions {
  tree: FolderNode | null;
  workspaceKey: string;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

function pinsEqual(left: readonly SidebarPinnedItem[], right: readonly SidebarPinnedItem[]) {
  return left.length === right.length
    && left.every((pin, index) => getSidebarPinnedItemKey(pin)
      === getSidebarPinnedItemKey(right[index]));
}

export function useSidebarPinnedSorting({
  tree,
  workspaceKey,
  settings,
  updateSettings,
}: SidebarPinnedSortingOptions) {
  const maxPinnedItems = normalizeMaxPinnedItems(settings.maxPinnedItems);
  const rawPins = useMemo(
    () => getWorkspacePins(settings.sidebarPinnedItems, workspaceKey),
    [settings.sidebarPinnedItems, workspaceKey],
  );
  const validKeys = useMemo(
    () => collectSidebarItemKeys(tree?.files ?? [], tree?.children ?? []),
    [tree],
  );
  const pins = useMemo(
    () => reconcileWorkspacePins(rawPins, validKeys, maxPinnedItems),
    [maxPinnedItems, rawPins, validKeys],
  );
  const pinnedKeys = useMemo(
    () => new Set(pins.map(getSidebarPinnedItemKey)),
    [pins],
  );
  const sortMode = getWorkspaceSortMode(settings.sidebarSortModes, workspaceKey);

  useEffect(() => {
    if (pinsEqual(rawPins, pins)) return;
    updateSettings({
      sidebarPinnedItems: setWorkspacePins(settings.sidebarPinnedItems, workspaceKey, pins),
    });
  }, [pins, rawPins, settings.sidebarPinnedItems, updateSettings, workspaceKey]);

  const clearPins = useCallback(() => {
    updateSettings({
      sidebarPinnedItems: clearWorkspacePins(settings.sidebarPinnedItems, workspaceKey),
    });
  }, [settings.sidebarPinnedItems, updateSettings, workspaceKey]);

  const togglePin = useCallback((item: SidebarPinnedItem) => {
    updateSettings({
      sidebarPinnedItems: toggleWorkspacePin(
        settings.sidebarPinnedItems,
        workspaceKey,
        item,
        maxPinnedItems,
      ),
    });
  }, [maxPinnedItems, settings.sidebarPinnedItems, updateSettings, workspaceKey]);

  const setSortMode = useCallback((mode: SidebarSortMode) => {
    updateSettings({
      sidebarSortModes: { ...(settings.sidebarSortModes ?? {}), [workspaceKey]: mode },
    });
  }, [settings.sidebarSortModes, updateSettings, workspaceKey]);

  return {
    pins,
    pinnedKeys,
    sortMode,
    maxPinnedItems,
    hasPins: pins.length > 0,
    pinLimitReached: pins.length >= maxPinnedItems,
    clearPins,
    togglePin,
    setSortMode,
  };
}
