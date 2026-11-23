import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../../ui/src/contexts/appStateReducer';
import { createEditableDocumentSession, documentSessionKey, markSaveConflict } from '../../../../ui/src/editor/documentSession';
import {
  applyLateSavedDocumentResult, applySavedDocumentResult, discardWorkingDocumentChanges,
  reloadDocumentConflictFromDisk, updateWorkingDocumentSource,
} from '../../../../ui/src/editor/documentWorkingCopy';

const A = '/w/a.md';
function base(session = createEditableDocumentSession(A, '# A', 'r1' as any)): any {
  const s = createInitialState() as any;
  return {
    ...s,
    currentFile: '/w/b.md',
    documentSessions: { [documentSessionKey(A)]: session },
    contentTabs: [
      { filePath: A, contentHtml: '<h1>A</h1>', markdownSource: '# A', documentWrite: { supported: true, revision: 'r1' } },
      { filePath: '/w/b.md', contentHtml: '', markdownSource: '' },
    ],
  };
}

describe('document working copy tab projection', () => {
  it('updates background tabs without touching the current document', () => {
    const state = base();
    const next = updateWorkingDocumentSource(state, A, '# Changed');
    expect(next.contentTabs[0].markdownSource).toBe('# Changed');
    expect(next.renderVersion).toBe(state.renderVersion);
    const current = updateWorkingDocumentSource({ ...state, currentFile: A, contentTabs: [], contentHtml: '<h1>A</h1>', markdownSource: '# A' }, A, '# A');
    expect(current.markdownSource).toBe('# A');
    expect(discardWorkingDocumentChanges(next, A).contentTabs[0].markdownSource).toBe('# A');
  });

  it('reloads conflicts from disk and refreshes tab revisions', () => {
    const conflicted = markSaveConflict(createEditableDocumentSession(A, '# A', 'r1' as any), '# Disk', 'r2' as any);
    const state = base(conflicted);
    state.contentTabs.push({ filePath: '/w/c.md' });
    const next = reloadDocumentConflictFromDisk(state, A);
    expect(next.contentTabs[0].markdownSource).toBe('# Disk');
    const noWrite = reloadDocumentConflictFromDisk({ ...state, contentTabs: [{ filePath: A }] }, A);
    expect(noWrite.contentTabs[0].documentWrite).toBeUndefined();
  });

  it('applies saved, conflicting, failed and late save results', () => {
    const state = base();
    const saved = applySavedDocumentResult(state, { filePath: A, ok: true, revision: 'r3' } as any);
    expect(saved.contentTabs[0].documentWrite.revision).toBe('r3');
    const noWrite = applySavedDocumentResult({ ...state, contentTabs: [{ filePath: A }] }, { filePath: A, ok: true, revision: 'r3' } as any);
    expect(noWrite.contentTabs[0].documentWrite).toBeUndefined();
    const conflict = applySavedDocumentResult(state, { filePath: A, ok: false, reason: 'conflict', diskSource: 'd', diskRevision: 'r9' } as any);
    expect(conflict.documentSessions[documentSessionKey(A)].conflict).toBeTruthy();
    const failed = applySavedDocumentResult(state, { filePath: A, ok: false, reason: 'conflict' } as any);
    expect(failed.contentTabs).toBe(state.contentTabs);
    const late = applyLateSavedDocumentResult({ ...state, contentTabs: [...state.contentTabs, { filePath: '/w/x.md' }] }, { filePath: A, ok: true, revision: 'r4' } as any, '# A', 'r1' as any);
    expect(late.documentSessions[documentSessionKey(A)].revision).toBe('r4');
    expect(applyLateSavedDocumentResult(state, { filePath: A, ok: true, revision: 'r4' } as any, '# A', 'other' as any)).toBe(state);
  });
});
