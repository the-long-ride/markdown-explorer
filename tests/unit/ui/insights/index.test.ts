import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';

function doc(path: string, source: string, revision = source) {
  return analyzeDocument({ path, source, revision });
}

describe('WorkspaceInsightsIndex', () => {
  it('removes deleted documents and turns surviving references into broken links', () => {
    const index = new WorkspaceInsightsIndex();
    index.applyDocument(doc('a.md', '[[B]]'));
    index.applyDocument(doc('b.md', '# B'));
    expect(index.snapshot().brokenLinks).toHaveLength(0);

    index.removeDocument('b.md');

    const snapshot = index.snapshot();
    expect(snapshot.documents.has('b.md')).toBe(false);
    expect(snapshot.brokenLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourcePath: 'a.md', status: 'missing' }),
    ]));
  });

  it('replaces every active-file contribution with the unsaved overlay and restores disk state', () => {
    const index = new WorkspaceInsightsIndex();
    index.applyDocument(doc('a.md', '[[B]] #disk'));
    index.applyDocument(doc('b.md', '# B'));
    index.applyDocument(doc('c.md', '# C'));

    index.applyActiveOverlay(doc('a.md', '[[C]] #overlay', 'unsaved-2'));
    let snapshot = index.snapshot();
    expect(snapshot.outboundLinks.get('a.md')?.map(edge => edge.targetPath)).toEqual(['c.md']);
    expect(snapshot.tags.get('overlay')).toEqual(new Set(['a.md']));
    expect(snapshot.tags.has('disk')).toBe(false);

    index.clearActiveOverlay('a.md');
    snapshot = index.snapshot();
    expect(snapshot.outboundLinks.get('a.md')?.map(edge => edge.targetPath)).toEqual(['b.md']);
    expect(snapshot.tags.get('disk')).toEqual(new Set(['a.md']));
  });

  it('distinguishes links and embeds and excludes valid same-document fragments from graph edges', () => {
    const index = new WorkspaceInsightsIndex();
    index.applyDocument(doc('a.md', '# Local\n[[#Local]]\n[[B]]\n![[C]]'));
    index.applyDocument(doc('b.md', '# B'));
    index.applyDocument(doc('c.md', '# C'));

    const edges = index.snapshot().outboundLinks.get('a.md') ?? [];
    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetPath: 'b.md', kind: 'link' }),
      expect.objectContaining({ targetPath: 'c.md', kind: 'embed' }),
    ]));
    expect(edges.some(edge => edge.targetPath === 'a.md')).toBe(false);
  });

  it('reports ambiguous title/alias resolution rather than guessing', () => {
    const index = new WorkspaceInsightsIndex();
    index.applyDocument(doc('source.md', '[[Guide]]'));
    index.applyDocument(doc('one.md', '---\ntitle: Guide\n---\n# One'));
    index.applyDocument(doc('two.md', '---\naliases: [Guide]\n---\n# Two'));

    expect(index.snapshot().brokenLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourcePath: 'source.md', status: 'ambiguous' }),
    ]));
  });

  it('migrates indexed identity on high-confidence rename', () => {
    const index = new WorkspaceInsightsIndex();
    index.applyDocument(doc('old.md', '# Old\n#tag'));
    index.renameDocument({ fromPath: 'old.md', toPath: 'new.md' });
    const snapshot = index.snapshot();
    expect(snapshot.documents.has('old.md')).toBe(false);
    expect(snapshot.documents.has('new.md')).toBe(true);
    expect(snapshot.tags.get('tag')).toEqual(new Set(['new.md']));
  });
});
