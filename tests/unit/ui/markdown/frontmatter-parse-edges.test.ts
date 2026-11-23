import { describe, expect, it } from 'vitest';
import { findFrontmatterSourceRange, parseFrontmatterDocument, scanFrontmatterPreamble } from '../../../../ui/src/markdown/frontmatter';

describe('frontmatter parse edges', () => {
  it('handles CRLF and lone CR delimiters', () => {
    const crlf = '---\r\ntitle: A\r\n---\r\nbody';
    expect(scanFrontmatterPreamble('\r\n\n\r' + crlf)).toBeGreaterThanOrEqual(0);
    expect(findFrontmatterSourceRange(crlf)).not.toBeNull();
    expect(parseFrontmatterDocument(crlf).metadata.title).toBe('A');
    const cr = '---\rtitle: B\r---\rbody';
    expect(() => parseFrontmatterDocument(cr)).not.toThrow();
  });

  it('reports malformed yaml with flat fallback and non-mapping frontmatter', () => {
    const bad = parseFrontmatterDocument('---\ntitle: [unclosed\nkey: v\n:nokey\n---\nbody');
    expect(bad.diagnostics.some((d) => d.ruleId === 'frontmatter/malformed')).toBe(true);
    expect(bad.flatFrontmatter.key).toBe('v');
    const list = parseFrontmatterDocument('---\n- a\n- b\n---\nbody');
    expect(list.diagnostics[0]?.message).toBe('Frontmatter must be a YAML mapping.');
    expect(parseFrontmatterDocument('---\n\n---\nbody').diagnostics).toEqual([]);
  });

  it('validates title and list metadata shapes', () => {
    const doc = parseFrontmatterDocument('---\ntitle:\n  nested: x\naliases: [one, 2, {a: b}]\ntags: single\n---\nbody');
    expect(doc.diagnostics.some((d) => d.message === 'title must be a string.')).toBe(true);
    expect(doc.metadata.tags).toEqual(['single']);
    expect(doc.metadata.aliases).toContain('one');
    const nullTitle = parseFrontmatterDocument('---\ntitle:\ntags: {a: 1}\n---\nbody');
    expect(nullTitle.diagnostics.length).toBeGreaterThan(0);
  });
});
