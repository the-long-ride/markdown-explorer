import type { AppState } from './appStateModel';
import type { ContentTab, MdFile } from '../types';

// The host answers every `navigate` with a full RENDER_CONTENT, including
// switches to a tab whose content is already cached. When the render carries
// nothing new, applying it would only bump renderVersion, replace the tab
// object and re-render/re-enhance the document. These helpers let the reducer
// detect that case and keep the previous state object.

function sameJson(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function sameFile(a: MdFile, b: MdFile): boolean {
  if (a === b) return true;
  if (
    a.fsPath !== b.fsPath
    || a.relativePath !== b.relativePath
    || a.fileName !== b.fileName
    || a.title !== b.title
    || a.extension !== b.extension
    || a.documentKind !== b.documentKind
    || a.modifiedAt !== b.modifiedAt
  ) return false;
  const aParts = a.parts ?? [];
  const bParts = b.parts ?? [];
  return aParts.length === bParts.length && aParts.every((part, index) => part === bParts[index]);
}

function sameFileList(a: readonly MdFile[], b: readonly MdFile[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (!sameFile(a[index], b[index])) return false;
  }
  return true;
}

// Every ContentTab field is either a primitive or a small JSON-serialisable
// value (frontmatter, toc, previewInfo, documentWrite).
function sameRecord(a: object, b: object): boolean {
  if (a === b) return true;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const x = left[key];
    const y = right[key];
    if (Object.is(x, y)) continue;
    if (x === null || y === null || typeof x !== 'object' || typeof y !== 'object') return false;
    if (!sameJson(x, y)) return false;
  }
  return true;
}

function sameContentTabs(a: readonly ContentTab[], b: readonly ContentTab[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (!sameRecord(a[index], b[index])) return false;
  }
  return true;
}

/**
 * `prepareRenderContentSession` recreates a clean document session on every
 * render. When the recreated session is field-for-field identical to the
 * existing one, keep the original state object so the render can still be
 * recognised as redundant.
 */
export function retainEquivalentDocumentSessions(original: AppState, prepared: AppState): AppState {
  if (original === prepared) return original;
  const keys = new Set([...Object.keys(original), ...Object.keys(prepared)]) as Set<keyof AppState>;
  for (const key of keys) {
    if (key === 'documentSessions' || Object.is(original[key], prepared[key])) continue;
    return prepared;
  }
  const before = original.documentSessions;
  const after = prepared.documentSessions;
  const sessionKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of sessionKeys) {
    const a = before[key];
    const b = after[key];
    if (a === b) continue;
    if (!a || !b || !sameRecord(a, b)) return prepared;
  }
  return original;
}

/**
 * True when `next` (the fully reduced RENDER_CONTENT result) differs from
 * `state` only by the renderVersion bump and by fresh-but-equal objects.
 * Any other differing field (loading/stale/not-found flags, html, source,
 * override, active tab, file list, tabs, render revisions, ...) makes the
 * render meaningful; unknown fields are treated as changes.
 */
export function isRedundantRender(state: AppState, next: AppState): boolean {
  if (state === next) return true;
  const keys = new Set([...Object.keys(state), ...Object.keys(next)]) as Set<keyof AppState>;
  for (const key of keys) {
    if (key === 'renderVersion' || Object.is(state[key], next[key])) continue;
    switch (key) {
      case 'fileList':
        if (!sameFileList(state.fileList, next.fileList)) return false;
        break;
      case 'contentTabs':
        if (!sameContentTabs(state.contentTabs, next.contentTabs)) return false;
        break;
      case 'frontmatter':
      case 'toc':
      case 'previewInfo':
        if (!sameJson(state[key], next[key])) return false;
        break;
      default:
        return false;
    }
  }
  return true;
}
