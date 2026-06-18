import type { FolderNode } from "../types";

export interface ReconcileScopeFocusPathsArgs {
  savedScopePaths: string[] | null;
  previousFilePaths: readonly string[];
  nextFilePaths: readonly string[];
  selectedFolderPaths?: readonly string[];
}

export function reconcileScopeFocusPaths(
  args: ReconcileScopeFocusPathsArgs,
): string[] | null;

export function collectSelectedFolderPaths(
  tree: FolderNode | null,
  selectedFilePaths: Set<string>,
): string[];
