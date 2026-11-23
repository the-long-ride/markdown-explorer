import { describe, expect, it } from 'vitest';
import { resolveRenderedLink } from '../../../../ui/src/dom/linkContextMenu';

const anchor = (href: string | null, target?: string) => {
  const a = document.createElement('a');
  if (href !== null) a.setAttribute('href', href);
  if (target) a.dataset.mdnTarget = target;
  return a;
};

describe('resolveRenderedLink kinds', () => {
  it('classifies file, absolute, scheme and malformed web links', () => {
    expect(resolveRenderedLink(anchor('file:///tmp/a.md'), '/w/doc.md').kind).toBe('file');
    expect(resolveRenderedLink(anchor('/abs/b.md'), '/w/doc.md')).toMatchObject({ openable: true });
    expect(resolveRenderedLink(anchor('mailto:x@y.z'), '/w/doc.md')).toMatchObject({ kind: 'unsupported', copyable: true });
    expect(resolveRenderedLink(anchor('http://['), '/w/doc.md')).toMatchObject({ kind: 'unsupported', openable: false });
    expect(resolveRenderedLink(anchor(null), '/w/doc.md')).toMatchObject({ kind: 'unsupported', copyable: false });
  });

  it('resolves fragments against web, empty and relative current documents', () => {
    expect(resolveRenderedLink(anchor('#a'), 'https://x.dev/doc#old').resolved).toBe('https://x.dev/doc#a');
    expect(resolveRenderedLink(anchor('#a'), '', 'http://localhost/app#z').resolved).toBe('http://localhost/app#a');
    expect(resolveRenderedLink(anchor('#a'), 'docs/rel.md', 'http://localhost/app/').resolved).toContain('#a');
    expect(resolveRenderedLink(anchor('x', '#t'), 'C:\\w\\doc.md').kind).toBe('fragment');
  });
});
