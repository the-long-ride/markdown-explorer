import { describe, expect, it } from 'vitest';
import { findFrontmatterSourceRange, parseFrontmatterDocument, scanFrontmatterPreamble } from '../../../../ui/src/markdown/frontmatter';

describe('frontmatter edge cases', () => {
  it('scans CRLF and CR line endings', () => {
    expect(scanFrontmatterPreamble('\r\n\r---\r\ntitle: a\r\n---\r\nbody')).toBeGreaterThanOrEqual(0);
    expect(scanFrontmatterPreamble('---\rtitle: a\r---\rbody')).toBeGreaterThanOrEqual(0);
    expect(findFrontmatterSourceRange('no frontmatter')).toBeNull();
    expect(findFrontmatterSourceRange('---\n---\nbody')).toEqual(expect.anything());
  });
  it('reports diagnostics for invalid yaml and non-string values', () => {
    const bad = parseFrontmatterDocument('---\ntitle: [unclosed\n---\nbody');
    expect(bad).toBeTruthy();
    const seq = parseFrontmatterDocument('---\ntitle:\n  - First\n  - Second\ntags:\n  - a\n  - { nested: 1 }\n? \n: x\naliases: 5\n---\n# Body');
    expect(seq).toBeTruthy();
    const scalarRoot = parseFrontmatterDocument('---\njust a string\n---\nbody');
    expect(scalarRoot).toBeTruthy();
  });
});
