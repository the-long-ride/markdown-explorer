import type { MdFile } from '../../ui/src/types';

export function resolveWorkspaceSearchItems(
  items: unknown,
  flatList: MdFile[],
): MdFile[] {
  if (!Array.isArray(items)) return flatList;

  const selectedPaths = new Set(
    items
      .map((item) => (item && typeof item === 'object' ? String((item as { fsPath?: unknown }).fsPath ?? '') : ''))
      .filter(Boolean),
  );
  return flatList.filter((file) => selectedPaths.has(file.fsPath));
}
