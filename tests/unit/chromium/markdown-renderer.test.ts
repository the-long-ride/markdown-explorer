import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../../chromium-xtension/src/markdown-renderer';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const result = renderMarkdown('test.md', '# Hello World');
    expect(result.html).toContain('Hello World');
    expect(result.frontmatter).toBeDefined();
    expect(Array.isArray(result.toc)).toBe(true);
  });

  it('extracts frontmatter', () => {
    const md = '---\ntitle: Test\n---\n# Body';
    const result = renderMarkdown('test.md', md);
    expect(result.frontmatter.title).toBe('Test');
  });

  it('extracts table of contents', () => {
    const md = '# Heading 1\n## Heading 2\n### Heading 3';
    const result = renderMarkdown('test.md', md);
    expect(result.toc.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty HTML for empty markdown', () => {
    const result = renderMarkdown('empty.md', '');
    expect(typeof result.html).toBe('string');
  });

  it('handles .mdx file extension', () => {
    const result = renderMarkdown('component.mdx', '# MDX File');
    expect(result.html).toContain('MDX File');
  });

  it('respects theme parameter', () => {
    const dark = renderMarkdown('a.md', '# Test', 'dark');
    const light = renderMarkdown('a.md', '# Test', 'light');
    expect(dark.html).toBeDefined();
    expect(light.html).toBeDefined();
  });

  it('renders code blocks', () => {
    const md = '```js\nconsole.log("hi");\n```';
    const result = renderMarkdown('code.md', md);
    expect(result.html).toContain('language-js');
    expect(result.html).toContain('console');
    expect(result.html).toContain('log');
  });

  it('renders links', () => {
    const md = '[Click me](https://example.com)';
    const result = renderMarkdown('link.md', md);
    expect(result.html).toContain('Click me');
    expect(result.html).toContain('https://example.com');
  });

  it('renders inline code', () => {
    const result = renderMarkdown('inline.md', 'Use `console.log` for debugging');
    expect(result.html).toContain('console.log');
  });

  it('renders bold and italic', () => {
    const result = renderMarkdown('format.md', '**bold** and *italic*');
    expect(result.html).toContain('bold');
    expect(result.html).toContain('italic');
  });
});
