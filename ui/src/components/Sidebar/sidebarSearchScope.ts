import type { WorkspaceSearchResult } from '../../types';

export function filterWorkspaceSearchResultsByScope(
  results: readonly WorkspaceSearchResult[],
  hasScopeEntry: boolean,
  selectedFilePaths: ReadonlySet<string>,
): WorkspaceSearchResult[] {
  if (!hasScopeEntry) return [...results];
  return results.filter((result) => selectedFilePaths.has(result.fsPath));
}

export function getScopeSearchRevision(selectedFilePaths: ReadonlySet<string>): string {
  return [...selectedFilePaths].sort((left, right) => left.localeCompare(right)).join('\n');
}
