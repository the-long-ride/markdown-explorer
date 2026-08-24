import { describe, expect, it } from 'vitest';
import { htmlToPdfNodes } from '../../../../ui/src/export/pdf/pdfSemantic';

describe('HTML to semantic PDF nodes', () => {
  it('keeps headings, inline emphasis/links, lists, quotes, code and tables semantic', () => {
    const nodes = htmlToPdfNodes(`
      <h1>Title <em>One</em></h1>
      <p>Hello <strong>bold</strong> <a href="https://example.com">link</a> <code>x()</code></p>
      <blockquote><p>Quote</p></blockquote>
      <ul><li>Alpha</li><li>Beta</li></ul>
      <pre><code>const x = 1;</code></pre>
      <table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>
      <hr>
    `);
    expect(nodes[0]).toMatchObject({ style: 'h1' });
    expect(JSON.stringify(nodes)).toContain('https://example.com');
    expect(nodes.some((node) => node.ul)).toBe(true);
    expect(nodes.some((node) => node.style === 'quote')).toBe(true);

    const code = nodes.find((node) => node.style === 'code');
    expect(code).toMatchObject({ color: '#1f2328', fillColor: '#f6f8fa' });

    const table = nodes.find((node) => node.table);
    expect(table?.table?.body).toHaveLength(2);
    expect(table?.layout).toBe('lightHorizontalLines');
    expect(table?.table?.body[0][0]).toMatchObject({ bold: true, color: '#1f2328', fillColor: '#f3f4f6' });

    const divider = nodes.find((node) => node.canvas);
    expect(divider?.canvas?.[0]).toMatchObject({ type: 'line', lineColor: '#d0d7de' });
    expect(JSON.stringify(nodes)).not.toContain('────────────────');
  });

  it('replaces annotated complex blocks with visual references instead of rasterizing ordinary text', () => {
    const nodes = htmlToPdfNodes('<p>Selectable text</p><div data-mdn-pdf-visual-id="pdfv-1"><canvas></canvas></div>');
    expect(nodes[0]).toMatchObject({ text: [{ text: 'Selectable text' }] });
    expect(nodes[1]).toMatchObject({ _visualRef: 'pdfv-1' });
  });
});
