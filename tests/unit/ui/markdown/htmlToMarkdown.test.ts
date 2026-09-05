import { describe, expect, it } from 'vitest';
import { convertHtmlSourceToMarkdown } from '../../../../ui/src/markdown/htmlToMarkdown';

describe('convertHtmlSourceToMarkdown', () => {
  it('returns empty string for empty or whitespace-only input', () => {
    expect(convertHtmlSourceToMarkdown('')).toBe('');
    expect(convertHtmlSourceToMarkdown('   \n\t  ')).toBe('');
  });

  it('converts headings h1 to h6 properly', () => {
    const html = `
      <h1>Heading 1</h1>
      <h2>Heading 2</h2>
      <h3>Heading 3</h3>
      <h4>Heading 4</h4>
      <h5>Heading 5</h5>
      <h6>Heading 6</h6>
    `;
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('# Heading 1');
    expect(md).toContain('## Heading 2');
    expect(md).toContain('### Heading 3');
    expect(md).toContain('#### Heading 4');
    expect(md).toContain('##### Heading 5');
    expect(md).toContain('###### Heading 6');
  });

  it('converts paragraphs and block containers', () => {
    const html = `
      <div>A div container</div>
      <p>A paragraph</p>
      <section><article><main><header>Structured content</header></main></article></section>
      <footer>Footer content</footer>
      <aside>Aside note</aside>
    `;
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('A div container');
    expect(md).toContain('A paragraph');
    expect(md).toContain('Structured content');
    expect(md).toContain('Footer content');
    expect(md).toContain('Aside note');
  });

  it('converts line breaks and horizontal rules', () => {
    const html = '<p>Line 1<br>Line 2</p><hr><p>Line 3</p>';
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('Line 1  \nLine 2');
    expect(md).toContain('---');
    expect(md).toContain('Line 3');
  });

  it('converts text styling: strong, em, del, and variants', () => {
    const html = '<p><strong>Bold 1</strong> and <b>Bold 2</b>, <em>Italic 1</em> and <i>Italic 2</i>, <del>Strikethrough 1</del>, <s>Strikethrough 2</s>, <strike>Strikethrough 3</strike></p>';
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('**Bold 1**');
    expect(md).toContain('**Bold 2**');
    expect(md).toContain('*Italic 1*');
    expect(md).toContain('*Italic 2*');
    expect(md).toContain('~~Strikethrough 1~~');
    expect(md).toContain('~~Strikethrough 2~~');
    expect(md).toContain('~~Strikethrough 3~~');
  });

  it('converts inline code and preserves code within pre blocks', () => {
    const html = `
      <p>Use <code>const x = 1;</code> inline with backtick <code>\`nested\`</code>.</p>
      <pre><code class="language-typescript">function add(a: number, b: number): number {\n  return a + b;\n}</code></pre>
      <pre>plain preformatted text</pre>
    `;
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('`const x = 1;`');
    expect(md).toContain('`\\`nested\\``');
    expect(md).toContain('```typescript\nfunction add(a: number, b: number): number {\n  return a + b;\n}\n```');
    expect(md).toContain('```\nplain preformatted text\n```');
  });

  it('converts links with and without href or inner text', () => {
    const html = `
      <p><a href="https://example.com">Example Site</a></p>
      <p><a href="https://autolink.org"></a></p>
      <p><a>No href link</a></p>
    `;
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('[Example Site](https://example.com)');
    expect(md).toContain('[https://autolink.org](https://autolink.org)');
    expect(md).toContain('No href link');
  });

  it('converts images with src, alt, and title escaping', () => {
    const html = `
      <img src="pic.jpg" alt="A photo" title='Photo "Special"'>
      <img src="no-alt.png">
      <img>
    `;
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('![A photo](pic.jpg "Photo \\"Special\\"")');
    expect(md).toContain('![](no-alt.png)');
    expect(md).not.toContain('![]()');
  });

  it('converts blockquotes including multiline content', () => {
    const html = '<blockquote>Quote line 1\nQuote line 2</blockquote>';
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('> Quote line 1\n> Quote line 2');
  });

  it('converts ordered and unordered lists, including nested lists', () => {
    const html = `
      <ul>
        <li>First item</li>
        <li>Second item
          <ul>
            <li>Nested unordered</li>
          </ul>
        </li>
      </ul>
      <ol>
        <li>First numbered</li>
        <li>Second numbered
          <ol>
            <li>Nested ordered</li>
          </ol>
        </li>
      </ol>
    `;
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('- First item');
    expect(md).toContain('  - Nested unordered');
    expect(md).toContain('1. First numbered');
    expect(md).toContain('  1. Nested ordered');
  });

  it('converts HTML tables with normalization and pipes', () => {
    const html = `
      <table>
        <thead>
          <tr><th>Col A</th><th>Col B | Escaped</th></tr>
        </thead>
        <tbody>
          <tr><td>Val 1</td><td>Val 2</td></tr>
          <tr><td>Only col 1</td></tr>
        </tbody>
      </table>
      <table></table>
      <table><tr></tr></table>
    `;
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('| Col A | Col B \\| Escaped |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| Val 1 | Val 2 |');
    expect(md).toContain('| Only col 1 |  |');
  });

  it('ignores non-content and embedded tags like script, style, meta, head, iframe', () => {
    const html = `
      <head><title>Title</title><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head>
      <body>
        <script>console.log("bad");</script>
        <style>body { color: red; }</style>
        <noscript>No script</noscript>
        <template>Template</template>
        <iframe src="frame.html"></iframe>
        <object data="obj"></object>
        <embed src="emb">
        <p>Real content</p>
      </body>
    `;
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toBe('Real content');
    expect(md).not.toContain('console.log');
    expect(md).not.toContain('color: red');
    expect(md).not.toContain('No script');
    expect(md).not.toContain('frame.html');
  });

  it('escapes inline markdown characters and handles non-breaking spaces', () => {
    const html = '<p>Price: $100 &nbsp; *star* and _underscore_ and \\backslash\\</p>';
    const md = convertHtmlSourceToMarkdown(html);
    expect(md).toContain('Price: $100');
    expect(md).toContain('\\*star\\*');
    expect(md).toContain('\\_underscore\\_');
    expect(md).toContain('\\\\backslash\\\\');
  });
});
