import type { AppState } from '../contexts/appStateModel';
import { normalizePathKey } from '../contexts/appStateModel';

export function bumpDocumentRenderRevision(
  revisions: Readonly<Record<string, number>>,
  filePath: string,
): Record<string, number> {
  if (!filePath) return { ...revisions };
  const key = normalizePathKey(filePath);
  return {
    ...revisions,
    [key]: (revisions[key] ?? 0) + 1,
  };
}

export function selectDocumentRenderRevision(state: AppState, filePath: string | null | undefined): number {
  if (!filePath) return 0;
  return state.documentRenderRevisions[normalizePathKey(filePath)] ?? 0;
}
