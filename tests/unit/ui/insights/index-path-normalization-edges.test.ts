import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';

const doc = (path: string, source: string) => analyzeDocument({ path, source, revision: '1' });

describe('WorkspaceInsightsIndex path normalization edges', () => {
  it('renames unnormalized base and overlay paths and resolves absolute, file and media links', () => {
    const index = new WorkspaceInsightsIndex();
    expect(index.applyDocument(doc('./notes\\a.md', '[r](/Root.md) [f](file:///x.md) [img](pic.png) [h](.hidden)')).changedPaths).toEqual(['notes/a.md']);
    index.applyDocument(doc('root.md', '# Root'));
    index.applyDocument(doc('notes/.hidden', '# H'));
    expect(index.applyActiveOverlay(doc('notes\\b.md', '[a](a.md)')).changedPaths).toEqual(['notes/b.md']);
    const outside = index.applyDocument(doc('../escape.md', '# E'));
    expect(outside.changedPaths[0]).toBe('../');
    const snapshot = index.snapshot() as any;
    expect(snapshot).toBeTruthy();
    expect(JSON.stringify(snapshot)).toContain('outside-workspace');
  });
});
