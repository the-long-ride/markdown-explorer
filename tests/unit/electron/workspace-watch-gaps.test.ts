import { describe, expect, it } from 'vitest';
import path from 'node:path';

import {
  normalizeWatchFilename,
  createWatchChange,
  mergeWatchChange,
} from '../../../desktop/workspace-watch.js';

describe('normalizeWatchFilename', () => {
  it('converts Buffer to string', () => {
    const buf = Buffer.from('readme.md');
    expect(normalizeWatchFilename(buf)).toBe('readme.md');
  });

  it('returns string input unchanged', () => {
    expect(normalizeWatchFilename('guide.md')).toBe('guide.md');
  });

  it('returns empty string for non-string non-Buffer input', () => {
    expect(normalizeWatchFilename(undefined as any)).toBe('');
    expect(normalizeWatchFilename(null as any)).toBe('');
    expect(normalizeWatchFilename(42 as any)).toBe('');
  });

  it('returns empty string for Buffer that decodes to empty', () => {
    const buf = Buffer.alloc(0);
    expect(normalizeWatchFilename(buf)).toBe('');
  });
});

describe('createWatchChange', () => {
  it('constructs change object with path.join for fsPath', () => {
    const change = createWatchChange('C:/docs', 'change', 'readme.md');
    expect(change.eventType).toBe('change');
    expect(change.relativePath).toBe('readme.md');
    expect(change.fsPath).toBe(path.join('C:/docs', 'readme.md'));
  });

  it('defaults eventType to "change" when not a string', () => {
    const change = createWatchChange('C:/docs', undefined as any, 'file.md');
    expect(change.eventType).toBe('change');
  });

  it('defaults eventType to "change" when null', () => {
    const change = createWatchChange('C:/docs', null as any, 'file.md');
    expect(change.eventType).toBe('change');
  });

  it('sets fsPath to empty string when relativePath is empty', () => {
    const change = createWatchChange('C:/docs', 'rename', '');
    expect(change.fsPath).toBe('');
    expect(change.relativePath).toBe('');
  });

  it('sets fsPath to empty string when filename normalizes to empty', () => {
    const change = createWatchChange('C:/docs', 'rename', null as any);
    expect(change.fsPath).toBe('');
  });

  it('handles Buffer filename via normalization', () => {
    const change = createWatchChange('C:/docs', 'rename', Buffer.from('notes.md'));
    expect(change.relativePath).toBe('notes.md');
    expect(change.fsPath).toBe(path.join('C:/docs', 'notes.md'));
  });
});

describe('mergeWatchChange', () => {
  it('returns current when nextChange is null', () => {
    const current = { eventType: 'change', relativePath: 'a.md', fsPath: '/docs/a.md' };
    expect(mergeWatchChange(current, null)).toBe(current);
  });

  it('returns next when currentChange is null', () => {
    const next = { eventType: 'rename', relativePath: 'b.md', fsPath: '/docs/b.md' };
    expect(mergeWatchChange(null, next)).toBe(next);
  });

  it('returns next when both share the same fsPath', () => {
    const current = { eventType: 'change', relativePath: 'a.md', fsPath: '/docs/a.md' };
    const next = { eventType: 'rename', relativePath: 'a.md', fsPath: '/docs/a.md' };
    const merged = mergeWatchChange(current, next);
    expect(merged).toBe(next);
  });

  it('returns mixed result when fsPaths differ', () => {
    const current = { eventType: 'change', relativePath: 'a.md', fsPath: '/docs/a.md' };
    const next = { eventType: 'rename', relativePath: 'b.md', fsPath: '/docs/b.md' };
    const merged = mergeWatchChange(current, next);
    expect(merged.eventType).toBe('mixed');
    expect(merged.relativePath).toBe('');
    expect(merged.fsPath).toBe('');
  });

  it('returns mixed when current fsPath is empty and next fsPath differs', () => {
    const current = { eventType: 'change', relativePath: '', fsPath: '' };
    const next = { eventType: 'rename', relativePath: 'b.md', fsPath: '/docs/b.md' };
    const merged = mergeWatchChange(current, next);
    expect(merged.eventType).toBe('mixed');
  });

  it('returns both null yields null', () => {
    expect(mergeWatchChange(null, null)).toBeNull();
  });
});
