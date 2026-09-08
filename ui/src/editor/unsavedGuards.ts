import { isDocumentDirty, type EditableDocumentSession } from './documentSession';

export type UnsavedChangesChoice = 'save' | 'discard' | 'cancel';

export function collectDirtyDocumentPaths(
  sessions: Readonly<Record<string, EditableDocumentSession>>,
): string[] {
  return Object.values(sessions)
    .filter(isDocumentDirty)
    .map((session) => session.filePath);
}
