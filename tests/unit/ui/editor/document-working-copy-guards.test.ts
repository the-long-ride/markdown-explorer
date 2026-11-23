import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../../ui/src/contexts/appStateReducer';
import {
  applyLateSavedDocumentResult, applySavedDocumentResult, discardWorkingDocumentChanges, markDocumentSaveStarted,
  reloadDocumentConflictFromDisk, updateDocumentEditMode, updateWorkingDocumentSource,
} from '../../../../ui/src/editor/documentWorkingCopy';

describe('document working copy guards', () => {
  it('returns the same state when no session exists', () => {
    const state = createInitialState() as any;
    expect(updateWorkingDocumentSource(state, '/a.md', 'x')).toBe(state);
    expect(updateDocumentEditMode(state, '/a.md', 'source' as any)).toBe(state);
    expect(discardWorkingDocumentChanges(state, '/a.md')).toBe(state);
    expect(reloadDocumentConflictFromDisk(state, '/a.md')).toBe(state);
    expect(markDocumentSaveStarted(state, '/a.md')).toBe(state);
    expect(applySavedDocumentResult(state, { filePath: '/a.md', ok: true, revision: 'r' } as any)).toBe(state);
    expect(applyLateSavedDocumentResult(state, { filePath: '/a.md', ok: false } as any, 'src')).toBe(state);
    expect(applyLateSavedDocumentResult(state, { filePath: '/a.md', ok: true } as any, 'src')).toBe(state);
  });

  it('ignores edits when markdown editing is disabled or the mode is not allowed', () => {
    const state = { ...createInitialState(), settings: { ...createInitialState().settings, markdownEditing: false, enableMarkdownEditing: false } } as any;
    expect(updateWorkingDocumentSource(state, '/a.md', 'x')).toBe(state);
    expect(updateDocumentEditMode(state, '/a.md', 'not-a-mode' as any)).toBe(state);
  });
});
