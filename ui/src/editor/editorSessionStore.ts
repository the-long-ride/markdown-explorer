import type { Compartment, EditorState } from '@codemirror/state';

export interface CachedEditorSession {
  readonly state: EditorState;
  readonly editableCompartment: Compartment;
  readonly wrapCompartment?: Compartment;
  readonly scroll?: { readonly top: number; readonly left: number };
}

export const MAX_EDITOR_SESSIONS = 15;

const editorSessions = new Map<string, CachedEditorSession>();

export function getEditorSession(key: string): CachedEditorSession | undefined {
  const session = editorSessions.get(key);
  if (session) {
    editorSessions.delete(key);
    editorSessions.set(key, session);
  }
  return session;
}

export function setEditorSession(key: string, session: CachedEditorSession): void {
  if (editorSessions.has(key)) {
    editorSessions.delete(key);
  } else if (editorSessions.size >= MAX_EDITOR_SESSIONS) {
    const oldestKey = editorSessions.keys().next().value;
    if (oldestKey !== undefined) {
      editorSessions.delete(oldestKey);
    }
  }
  editorSessions.set(key, session);
}

export const setCachedEditorSession = setEditorSession;

export function clearEditorSession(key: string): void {
  editorSessions.delete(key);
}

export function clearAllEditorSessions(): void {
  editorSessions.clear();
}
