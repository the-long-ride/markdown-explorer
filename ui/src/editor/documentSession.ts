import { normalizePathKey } from '../contexts/appStateModel';
import type { DocumentRevisionToken } from '../types/content';

export type MarkdownEditMode = 'rendered' | 'inline-edit' | 'plain';
export type LineEnding = '\n' | '\r\n';

export interface DocumentConflict {
  readonly diskSource: string;
  readonly diskRevision: DocumentRevisionToken;
  readonly diskLineEnding: LineEnding;
}

export interface EditableDocumentSession {
  readonly filePath: string;
  readonly source: string;
  readonly persistedSource: string;
  readonly lineEnding: LineEnding;
  readonly revision: DocumentRevisionToken | null;
  readonly saveState: 'idle' | 'saving' | 'conflict';
  readonly conflict: DocumentConflict | null;
}

export function documentSessionKey(filePath: string): string {
  return normalizePathKey(filePath);
}

export function canonicalizeDocumentSource(raw: string): { source: string; lineEnding: LineEnding } {
  const crlf = (raw.match(/\r\n/g) ?? []).length;
  const bareLf = (raw.match(/(?<!\r)\n/g) ?? []).length;
  const lineEnding: LineEnding = crlf > bareLf ? '\r\n' : '\n';
  return {
    source: raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    lineEnding,
  };
}

export function serializeDocumentSource(source: string, lineEnding: LineEnding): string {
  const canonical = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return lineEnding === '\r\n' ? canonical.replace(/\n/g, '\r\n') : canonical;
}

export function createEditableDocumentSession(
  filePath: string,
  rawSource: string,
  revision: DocumentRevisionToken | null,
): EditableDocumentSession {
  const { source, lineEnding } = canonicalizeDocumentSource(rawSource);
  return {
    filePath,
    source,
    persistedSource: source,
    lineEnding,
    revision,
    saveState: 'idle',
    conflict: null,
  };
}

export function isDocumentDirty(session: EditableDocumentSession): boolean {
  return session.source !== session.persistedSource;
}

export function replaceWorkingSource(
  session: EditableDocumentSession,
  rawSource: string,
): EditableDocumentSession {
  const { source } = canonicalizeDocumentSource(rawSource);
  return {
    ...session,
    source,
    saveState: session.saveState === 'saving' ? 'saving' : 'idle',
    conflict: null,
  };
}

export function markSaveStarted(session: EditableDocumentSession): EditableDocumentSession {
  return {
    ...session,
    saveState: 'saving',
    conflict: null,
  };
}

export function markSaveSucceeded(
  session: EditableDocumentSession,
  revision: DocumentRevisionToken,
): EditableDocumentSession {
  return {
    ...session,
    persistedSource: session.source,
    revision,
    saveState: 'idle',
    conflict: null,
  };
}

export function markSaveConflict(
  session: EditableDocumentSession,
  rawDiskSource: string,
  diskRevision: DocumentRevisionToken,
): EditableDocumentSession {
  const disk = canonicalizeDocumentSource(rawDiskSource);
  return {
    ...session,
    saveState: 'conflict',
    conflict: {
      diskSource: disk.source,
      diskRevision,
      diskLineEnding: disk.lineEnding,
    },
  };
}

export function discardWorkingChanges(session: EditableDocumentSession): EditableDocumentSession {
  return {
    ...session,
    source: session.persistedSource,
    saveState: 'idle',
    conflict: null,
  };
}
