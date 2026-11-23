import { describe, expect, it } from 'vitest';
import { findFrontmatterSourceRange, parseFrontmatterDocument, scanFrontmatterPreamble } from '../../../../ui/src/markdown/frontmatter';

describe('frontmatter edge cases', () => {
  it('finds ranges with CRLF and CR line endings', () => {
    expect(findFrontmatterSourceRange('no frontmatter')).toBeNull();
    const crlf = '---\r\ntitle: A\r\n---\r\nBody';
    const range = findFrontmatterSourceRange(crlf);
    expect(range && crlf.slice(range.start, range.end)).not.toMatch(/[\r\n]$/);
    expect(scanFrontmatterPreamble('---\rtitle: A\r---\rBody')).toBeGreaterThanOrEqual(0);
    expect(findFrontmatterSourceRange('---\n---\n')).toBeDefined();
  });

  it('reports non-mapping frontmatter and keeps empty ones silent', () => {
    const list = parseFrontmatterDocument('---\n- a\n- b\n---\nBody');
    expect(list.flatFrontmatter).toEqual({});
    expect(list.diagnostics.length).toBeGreaterThan(0);
    const empty = parseFrontmatterDocument('---\n\n---\nBody');
    expect(empty.diagnostics).toEqual([]);
    const scalar = parseFrontmatterDocument('---\njust text\n---\nBody');
    expect(scalar.diagnostics.length).toBeGreaterThan(0);
  });

  it('flattens nested values, sequences and non-string keys', () => {
    const doc = parseFrontmatterDocument('---\ntitle: T\n1: numeric\n? [a, b]\n: complex\ntags:\n  - x\n  - [y, z]\n  - {k: v}\nnested:\n  deep: 1\n  "": blank\nempty:\n---\nBody');
    expect(doc.metadata.title).toBe('T');
    expect(Object.keys(doc.flatFrontmatter)).toEqual(expect.arrayContaining(['title', 'tags']));
    expect(doc.body.trim()).toBe('Body');
  });

  it('reports YAML syntax errors with source lines', () => {
    const doc = parseFrontmatterDocument('---\ntitle: [unclosed\n---\nBody');
    expect(doc.diagnostics[0]?.line).toBeGreaterThan(0);
    const titled = parseFrontmatterDocument('---\ntitle:\n  - a\naliases: x\n---\n');
    expect(titled.metadata).toBeTruthy();
  });
});
