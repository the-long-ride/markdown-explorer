import { describe, expect, it, vi } from 'vitest';
import { isRevisionDocumentPath, searchRevisionWorkspace } from '../../../../ui/src/history/revisionWorkspace';

describe('revision workspace search guards', () => {
  it('returns no results for blank queries without reading files', async () => {
    const readFile = vi.fn();
    expect(await searchRevisionWorkspace('o', [{ path: 'a.md' }] as any, readFile, '   ', false)).toEqual([]);
    expect(await searchRevisionWorkspace('o', [{ path: 'a.md' }] as any, readFile, undefined as any, false)).toEqual([]);
    expect(readFile).not.toHaveBeenCalled();
  });

  it('treats nullish and extension-less paths as non-documents', () => {
    expect(isRevisionDocumentPath(undefined as any)).toBe(false);
    expect(isRevisionDocumentPath('\\\\docs//README')).toBe(false);
    expect(isRevisionDocumentPath('docs\\a.md')).toBe(true);
  });
});
