import type { WorkspaceSearchResult } from '../../types';

export const EMPTY_SELECTED_FILE_PATHS: ReadonlySet<string> = new Set<string>();

export function filterWorkspaceSearchResultsByScope(
  results: readonly WorkspaceSearchResult[],
  hasScopeEntry: boolean,
  selectedFilePaths: ReadonlySet<string> = EMPTY_SELECTED_FILE_PATHS,
): WorkspaceSearchResult[] {
  if (!hasScopeEntry) return [...results];
  return results.filter((result) => selectedFilePaths.has(result.fsPath));
}

export function getScopeSearchRevision(
  selectedFilePaths: ReadonlySet<string> = EMPTY_SELECTED_FILE_PATHS,
): string {
  return [...selectedFilePaths].sort((left, right) => left.localeCompare(right)).join('\n');
}
