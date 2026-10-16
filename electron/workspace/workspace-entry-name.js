'use strict';

// Copy of ui/src/workspace/workspaceEntryName.ts; both are tested against tests/fixtures/workspace-entry-names.json.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

function isProtectedSegment(segment) {
  return String(segment).replace(/[. ]+$/, '').toLowerCase() === '.git';
}

/** True when any segment of an (already split or resolved relative) path is protected. */
function hasProtectedSegment(segments) {
  return segments.some(isProtectedSegment);
}

/** On Windows a ':' inside a path segment addresses an NTFS alternate data stream (e.g. `.git::$INDEX_ALLOCATION`). */
function hasStreamSegment(segments, platform = process.platform) {
  return platform === 'win32' && segments.some((segment) => String(segment).includes(':'));
}

function nameError(name) {
  const value = String(name);
  if (value.trim() === '') return 'empty';
  if (isProtectedSegment(value)) return 'protected';
  if (value === '.' || value === '..') return 'invalid';
  if (FORBIDDEN_CHARACTERS.test(value) || /[. ]$/.test(value)) return 'invalid';
  if (RESERVED_DEVICE_NAME.test(value)) return 'reserved';
  return null;
}

module.exports = { nameError, isProtectedSegment, hasProtectedSegment, hasStreamSegment };
