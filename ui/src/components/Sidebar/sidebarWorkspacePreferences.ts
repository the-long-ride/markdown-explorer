import type { FolderNode, MdFile, SidebarPinnedItem, SidebarSortMode } from '../../types';

export const DEFAULT_MAX_PINNED_ITEMS = 10;
export const DEFAULT_SIDEBAR_SORT_MODE: SidebarSortMode = 'name-asc';

export function normalizeMaxPinnedItems(value: unknown): number {
  const parsed = Number(value);
  const rounded = Number.isFinite(parsed) ? Math.round(parsed) : DEFAULT_MAX_PINNED_ITEMS;
  return Math.min(15, Math.max(1, rounded));
}

export function isSidebarSortMode(value: unknown): value is SidebarSortMode {
  return value === 'name-asc'
    || value === 'name-desc'
    || value === 'modified-desc'
    || value === 'modified-asc';
}

export function getSidebarPinnedItemKey(item: SidebarPinnedItem): string {
  return `${item.kind}:${item.path}`;
}

export function getWorkspacePins(
  pinnedItems: Record<string, SidebarPinnedItem[]> | undefined,
  workspaceKey: string,
): SidebarPinnedItem[] {
  return pinnedItems?.[workspaceKey] ?? [];
}

export function getWorkspaceSortMode(
  sortModes: Record<string, SidebarSortMode> | undefined,
  workspaceKey: string,
): SidebarSortMode {
  const mode = sortModes?.[workspaceKey];
  return isSidebarSortMode(mode) ? mode : DEFAULT_SIDEBAR_SORT_MODE;
}

export function toggleWorkspacePin(
  pinnedItems: Record<string, SidebarPinnedItem[]> | undefined,
  workspaceKey: string,
  item: SidebarPinnedItem,
  maxPinnedItems: number,
): Record<string, SidebarPinnedItem[]> {
  const next = { ...(pinnedItems ?? {}) };
  const current = [...getWorkspacePins(pinnedItems, workspaceKey)];
  const itemKey = getSidebarPinnedItemKey(item);
  const existingIndex = current.findIndex(
    (candidate) => getSidebarPinnedItemKey(candidate) === itemKey,
  );
  if (existingIndex >= 0) current.splice(existingIndex, 1);
  else if (current.length < normalizeMaxPinnedItems(maxPinnedItems)) current.push(item);
  if (current.length > 0) next[workspaceKey] = current;
  else delete next[workspaceKey];
  return next;
}

export function setWorkspacePins(
  pinnedItems: Record<string, SidebarPinnedItem[]> | undefined,
  workspaceKey: string,
  pins: readonly SidebarPinnedItem[],
): Record<string, SidebarPinnedItem[]> {
  const next = { ...(pinnedItems ?? {}) };
  if (pins.length > 0) next[workspaceKey] = [...pins];
  else delete next[workspaceKey];
  return next;
}

export function clearWorkspacePins(
  pinnedItems: Record<string, SidebarPinnedItem[]> | undefined,
  workspaceKey: string,
): Record<string, SidebarPinnedItem[]> {
  const next = { ...(pinnedItems ?? {}) };
  delete next[workspaceKey];
  return next;
}

export function reconcileWorkspacePins(
  pins: readonly SidebarPinnedItem[],
  validItemKeys: ReadonlySet<string>,
  maxPinnedItems = DEFAULT_MAX_PINNED_ITEMS,
): SidebarPinnedItem[] {
  const seen = new Set<string>();
  const reconciled: SidebarPinnedItem[] = [];
  for (const pin of pins) {
    const key = getSidebarPinnedItemKey(pin);
    if (!validItemKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    reconciled.push(pin);
    if (reconciled.length >= normalizeMaxPinnedItems(maxPinnedItems)) break;
  }
  return reconciled;
}

export function collectSidebarItemKeys(
  files: readonly MdFile[],
  folders: readonly FolderNode[],
): Set<string> {
  const keys = new Set(files.map((file) => `file:${file.fsPath}`));
  const visit = (folder: FolderNode) => {
    keys.add(`folder:${folder.path}`);
    for (const file of folder.files) keys.add(`file:${file.fsPath}`);
    for (const child of folder.children) visit(child);
  };
  for (const folder of folders) visit(folder);
  return keys;
}
