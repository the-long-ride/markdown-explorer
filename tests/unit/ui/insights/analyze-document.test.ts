import { describe, expect, it } from 'vitest';
import * as analyzeDocumentModule from '../../../../ui/src/insights/analyzeDocument';

const { analyzeDocument } = analyzeDocumentModule;

describe('analyzeDocument', () => {
  it('keeps body findings when frontmatter is malformed', () => {
    const result = analyzeDocument({ path: 'guide.md', source: '---\ntitle: [bad\n---\n# A\n### C\n', revision: 'r1' });
    expect(result.lint.map(finding => finding.ruleId)).toContain('frontmatter/malformed');
    expect(result.lint.map(finding => finding.ruleId)).toContain('heading/skipped-level');
    expect(result.headings.map(heading => heading.text)).toEqual(['A', 'C']);
  });

  it('combines frontmatter metadata, prose tags, anchors, links, and media', () => {
    const result = analyzeDocument({
      path: 'notes/guide.md',
      source: ['---', 'title: Guide Title', 'aliases: [Guide, Handbook]', 'tags: [docs, api]', '---', '# Guide Title', '', 'See [[Other#Install|setup]] and [site](https://example.test/docs).', '![local](../assets/diagram.png)', '<a id="manual-anchor"></a>', '#runtime/tag'].join('\n'),
      revision: 'r2',
    });
    expect(result.title).toBe('Guide Title');
    expect(result.aliases).toEqual(['Guide', 'Handbook']);
    expect(result.tags).toEqual(expect.arrayContaining(['docs', 'api', 'runtime/tag']));
    expect([...result.anchors]).toEqual(expect.arrayContaining(['guide-title', 'manual-anchor']));
    expect(result.references).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'wiki-link', target: 'Other', fragment: 'Install' }),
      expect.objectContaining({ kind: 'link', target: 'https://example.test/docs', remote: true }),
      expect.objectContaining({ kind: 'media', target: '../assets/diagram.png', remote: false }),
    ]));
  });

  it('builds stable sections and persistence-safe terminology signatures', () => {
    const source = ['# Authentication', 'Refresh tokens rotate after successful exchange. Access tokens remain short lived.', '## Failure Modes', 'Expired refresh tokens require a new interactive sign in.'].join('\n\n');
    const first = analyzeDocument({ path: 'auth.md', source, revision: 'one' });
    const second = analyzeDocument({ path: 'auth.md', source, revision: 'two' });
    expect(first.sections.map(section => section.heading)).toEqual(['Authentication', 'Failure Modes']);
    expect(first.terminology).toContain('refresh tokens');
    expect(first.terminologySignatures).toEqual(second.terminologySignatures);
    expect(first.terminologySignatures.length).toBeGreaterThan(0);
    expect(first.terminologySignatures.every(value => /^[a-f0-9]{16,}$/i.test(value))).toBe(true);
    expect(first.persisted).not.toHaveProperty('source');
    expect(first.persisted).not.toHaveProperty('terminology');
  });

  it('restores persistence-safe relationships while keeping readable section text unavailable', () => {
    const analyzed = analyzeDocument({ path: 'guide.md', source: '# Guide\nSee [[Other]].\n## Details\nReadable body.', revision: 'cached' });
    const restore = (analyzeDocumentModule as any).restorePersistedAnalyzedDocument;
    expect(typeof restore).toBe('function');
    const restored = restore(analyzed.persisted);
    expect(restored).toEqual(expect.objectContaining({ path: 'guide.md', revision: 'cached', title: 'Guide', terminology: [], persisted: analyzed.persisted }));
    expect([...restored.anchors].sort()).toEqual([...analyzed.anchors].sort());
    expect(restored.references).toEqual(analyzed.references);
    expect(restored.sections.map((section: any) => section.text)).toEqual(['', '']);
  });

  it('does not treat references or tags inside code as document relationships', () => {
    const result = analyzeDocument({
      path: 'code.md', revision: 'code',
      source: ['# Code', '```md', '[[Not-A-Link]] #not-a-tag', '![not-media](asset.png)', '```', '', '`[[Also-Not]] #still-not`', '', '[[Real-Link]] #real-tag'].join('\n'),
    });
    expect(result.references.map(reference => reference.target)).toEqual(['Real-Link']);
    expect(result.tags).toContain('real-tag');
    expect(result.tags).not.toContain('not-a-tag');
    expect(result.tags).not.toContain('still-not');
  });
});
