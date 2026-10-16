import type { WorkspaceEntryKind } from '../types';

export type WorkspaceEntryNameError = 'empty' | 'invalid' | 'reserved' | 'protected';

// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** `.git` in any case, ignoring trailing dots/spaces (Windows strips them). */
export function isProtectedSegment(segment: string): boolean {
  return segment.replace(/[. ]+$/, '').toLowerCase() === '.git';
}

/** Shared rule set; hosts carry copies tested against tests/fixtures/workspace-entry-names.json. Does not trim. */
export function validateWorkspaceEntryName(name: string): WorkspaceEntryNameError | null {
  if (name.trim() === '') return 'empty';
  if (isProtectedSegment(name)) return 'protected';
  if (name === '.' || name === '..') return 'invalid';
  if (FORBIDDEN_CHARACTERS.test(name) || /[. ]$/.test(name)) return 'invalid';
  if (RESERVED_DEVICE_NAME.test(name)) return 'reserved';
  return null;
}

export function withDefaultExtension(name: string, kind: WorkspaceEntryKind): string {
  return kind === 'file' && !name.includes('.') ? `${name}.md` : name;
}
