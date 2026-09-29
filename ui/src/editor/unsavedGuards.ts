import { isDocumentDirty, type EditableDocumentSession } from './documentSession';

export type UnsavedChangesChoice = 'save' | 'discard' | 'cancel';

export function collectDirtyDocumentPaths(
  sessions: Readonly<Record<string, EditableDocumentSession>>,
): string[] {
  return Object.values(sessions)
    .filter(isDocumentDirty)
    .map((session) => session.filePath);
}

/**
 * Sessions that must outlive a workspace transition: only dirty ones. Clean
 * sessions are cheap to rebuild from disk, but dropping a dirty one silently
 * discards the user's unsaved edits (e.g. on a transient network/USB drop).
 */
export function retainDirtyDocumentSessions(
  sessions: Readonly<Record<string, EditableDocumentSession>>,
): Record<string, EditableDocumentSession> {
  const retained: Record<string, EditableDocumentSession> = {};
  for (const [key, session] of Object.entries(sessions)) {
    if (isDocumentDirty(session)) retained[key] = session;
  }
  return retained;
}
