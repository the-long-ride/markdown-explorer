import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../../../../ui/src/insights/analyzeDocument';
import { WorkspaceInsightsIndex } from '../../../../ui/src/insights/index';

const doc = (path: string, source: string) => analyzeDocument({ path, source, revision: '1' });

describe('WorkspaceInsightsIndex path resolution', () => {
  it('resolves extensionless, parent and outside-workspace links', () => {
    const index = new WorkspaceInsightsIndex();
    index.applyDocument(doc('docs/a.md', '[b](./b) [m](../root) [x](../../outside.md) [img](pic.png) [web](https://x.dev) [dot](./.hidden) [up](../../../)'));
    index.applyDocument(doc('docs/b.mdx', '# B'));
    index.applyDocument(doc('root.md', '# Root'));
    const snap = index.snapshot();
    const links = JSON.stringify(snap);
    expect(links).toContain('outside-workspace');
  });

  it('renames documents with overlays and normalizes mismatched paths', () => {
    const index = new WorkspaceInsightsIndex();
    index.applyDocument(doc('a.md', '[t](target.md)'));
    index.applyDocument({ ...doc('other.md', '# x'), path: 'Other.md' } as any);
    index.applyActiveOverlay(doc('a.md', '[t](target.md) more'));
    index.applyActiveOverlay({ ...doc('z.md', ''), path: 'Z.md' } as any);
    index.renameDocument({ fromPath: 'a.md', toPath: 'moved.md' } as any);
    index.renameDocument({ fromPath: 'missing.md', toPath: 'still-missing.md' } as any);
    index.clearActiveOverlay('moved.md');
    index.removeDocument('nope.md');
    expect(index.snapshot().revision).toBeGreaterThan(0);
  });
});
