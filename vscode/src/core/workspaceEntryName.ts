// Copy of ui/src/workspace/workspaceEntryName.ts; both are tested against tests/fixtures/workspace-entry-names.json.
export type WorkspaceEntryNameError = 'empty' | 'invalid' | 'reserved' | 'protected';

// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function isProtectedSegment(segment: string): boolean {
  return segment.replace(/[. ]+$/, '').toLowerCase() === '.git';
}

/** True when any segment of an (already split or resolved relative) path is protected. */
export function hasProtectedSegment(segments: readonly string[]): boolean {
  return segments.some(isProtectedSegment);
}

/** On Windows a ':' inside a path segment addresses an NTFS alternate data stream (e.g. `.git::$INDEX_ALLOCATION`). */
export function hasStreamSegment(segments: readonly string[], platform: string = process.platform): boolean {
  return platform === 'win32' && segments.some((segment) => segment.includes(':'));
}

export function nameError(name: string): WorkspaceEntryNameError | null {
  if (name.trim() === '') return 'empty';
  if (isProtectedSegment(name)) return 'protected';
  if (name === '.' || name === '..') return 'invalid';
  if (FORBIDDEN_CHARACTERS.test(name) || /[. ]$/.test(name)) return 'invalid';
  if (RESERVED_DEVICE_NAME.test(name)) return 'reserved';
  return null;
}
