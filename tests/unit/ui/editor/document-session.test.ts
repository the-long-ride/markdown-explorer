import { describe, expect, it } from 'vitest';
import {
  canonicalizeDocumentSource,
  createEditableDocumentSession,
  discardWorkingChanges,
  documentSessionKey,
  isDocumentDirty,
  markSaveConflict,
  markSaveSucceeded,
  replaceWorkingSource,
  serializeDocumentSource,
  setDocumentEditMode,
} from '../../../../ui/src/editor/documentSession';

describe('editable document session', () => {
  it('derives dirty state from working and persisted source', () => {
    const clean = createEditableDocumentSession('/docs/a.md', '# A', '10:3');
    expect(isDocumentDirty(clean)).toBe(false);
    expect(isDocumentDirty(replaceWorkingSource(clean, '# B'))).toBe(true);
  });

  it('starts in rendered mode and can switch to plain without changing source', () => {
    const edited = replaceWorkingSource(
      createEditableDocumentSession('/docs/a.md', '# A', '10:3'),
      '# B',
    );

    expect(edited.mode).toBe('rendered');
    const plain = setDocumentEditMode(edited, 'plain');
    expect(plain.mode).toBe('plain');
    expect(plain.source).toBe('# B');
    expect(plain.persistedSource).toBe('# A');
    expect(isDocumentDirty(plain)).toBe(true);
  });

  it('switches back to rendered mode without losing unsaved source', () => {
    const plain = setDocumentEditMode(
      replaceWorkingSource(createEditableDocumentSession('/docs/a.md', '# A', '10:3'), '# B'),
      'plain',
    );

    const rendered = setDocumentEditMode(plain, 'rendered');
    expect(rendered.mode).toBe('rendered');
    expect(rendered.source).toBe('# B');
    expect(isDocumentDirty(rendered)).toBe(true);
  });

  it('keeps the working source when a save conflicts', () => {
    const edited = replaceWorkingSource(createEditableDocumentSession('/docs/a.md', '# A', '10:3'), '# Mine');
    const conflicted = markSaveConflict(edited, '# Disk', '20:6');
    expect(conflicted.source).toBe('# Mine');
    expect(conflicted.conflict?.diskSource).toBe('# Disk');
  });

  it('advances persisted source and revision after a successful save', () => {
    const edited = replaceWorkingSource(createEditableDocumentSession('/docs/a.md', '# A', '10:3'), '# B');
    const saved = markSaveSucceeded(edited, '30:3');
    expect(saved.persistedSource).toBe('# B');
    expect(saved.revision).toBe('30:3');
    expect(isDocumentDirty(saved)).toBe(false);
  });

  it('discard restores the last persisted source', () => {
    const edited = replaceWorkingSource(createEditableDocumentSession('/docs/a.md', '# A', '10:3'), '# B');
    expect(discardWorkingChanges(edited).source).toBe('# A');
  });

  it('keeps CRLF as the disk serialization while editing canonical LF offsets', () => {
    const session = createEditableDocumentSession('/docs/a.md', '# A\r\n\r\nText\r\n', '1:12');
    expect(session.source).toBe('# A\n\nText\n');
    expect(session.lineEnding).toBe('\r\n');
    expect(serializeDocumentSource('# B\n\nText\n', session.lineEnding)).toBe('# B\r\n\r\nText\r\n');
  });

  it('uses LF when LF is at least as common as CRLF', () => {
    expect(canonicalizeDocumentSource('a\r\nb\nc\n')).toEqual({ source: 'a\nb\nc\n', lineEnding: '\n' });
  });

  it('normalizes equivalent Windows paths to one session key', () => {
    expect(documentSessionKey('C:\\Docs\\A.md')).toBe(documentSessionKey('c:/docs/a.md'));
  });
});