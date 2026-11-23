import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { enhanceColorSwatches } from '../../../../ui/src/components/Content/enhancements/enhanceColorSwatches';

describe('enhanceColorSwatches', () => {
  it('uses the document fallback traversal without changing excluded descendants or original text', () => {
    const embeddedDocument = document.implementation.createHTMLDocument();
    const root = embeddedDocument.body;
    root.innerHTML = '<p>#fff</p><!-- #aaa --><code>prefix #abc / rgb(1, 2, 3) suffix</code><div class="cm-editor"><code>#fed</code></div><code><span data-color-swatched="true">#aaa</span></code>';
    const originalText = root.textContent;
    Object.defineProperty(embeddedDocument, 'createTreeWalker', { value: undefined, configurable: true });
    enhanceColorSwatches(root);
    enhanceColorSwatches(root);
    Reflect.deleteProperty(embeddedDocument, 'createTreeWalker');
    expect([...root.querySelectorAll('.mdn-color-swatch')].map((swatch) => swatch.getAttribute('data-color'))).toEqual(['#abc', 'rgb(1, 2, 3)']);
    expect(root.querySelector('.cm-editor code')?.textContent).toBe('#fed');
    expect(root.querySelectorAll('.cm-editor .mdn-color-token, p .mdn-color-token')).toHaveLength(0);
    expect(root.textContent).toBe(originalText);
    expect(root.querySelectorAll('.mdn-color-token')).toHaveLength(2);
  });
  it('enhances hex colors in inline code elements', () => {
    const container = document.createElement('div');
    container.innerHTML = '<code>#E9E5DD</code> and <code>color: #171716;</code> and <code>#fff</code>';
    document.body.appendChild(container);

    enhanceColorSwatches(container);

    const tokens = container.querySelectorAll('.mdn-color-token');
    expect(tokens.length).toBe(3);

    const swatches = container.querySelectorAll('.mdn-color-swatch');
    expect(swatches.length).toBe(3);

    expect(swatches[0].getAttribute('data-color')).toBe('#E9E5DD');
    expect((swatches[0] as HTMLElement).style.getPropertyValue('--mdn-swatch-color')).toBe('#E9E5DD');
    expect(swatches[0].getAttribute('aria-hidden')).toBe('true');

    expect(swatches[1].getAttribute('data-color')).toBe('#171716');
    expect((swatches[1] as HTMLElement).style.getPropertyValue('--mdn-swatch-color')).toBe('#171716');

    expect(swatches[2].getAttribute('data-color')).toBe('#fff');
    expect((swatches[2] as HTMLElement).style.getPropertyValue('--mdn-swatch-color')).toBe('#fff');

    // textContent is 100% preserved
    expect(container.textContent).toBe('#E9E5DD and color: #171716; and #fff');
  });

  it('enhances 8-digit hex colors with alpha (#RRGGBBAA)', () => {
    const container = document.createElement('div');
    container.innerHTML = '<code>#a96f28ff</code>';
    document.body.appendChild(container);

    enhanceColorSwatches(container);

    const swatch = container.querySelector('.mdn-color-swatch');
    expect(swatch).not.toBeNull();
    expect(swatch?.getAttribute('data-color')).toBe('#a96f28ff');
    expect((swatch as HTMLElement).style.getPropertyValue('--mdn-swatch-color')).toBe('#a96f28ff');
    expect(container.textContent).toBe('#a96f28ff');
  });

  it('enhances code blocks with syntax-highlighted tokens (<pre><code>)', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <pre><code><span class="hljs-keyword">const</span> <span class="hljs-variable">bg</span> = <span class="hljs-string">"#E9E5DD"</span>;
<span class="hljs-keyword">const</span> <span class="hljs-variable">fg</span> = <span class="hljs-string">"#171716"</span>;</code></pre>
    `;
    document.body.appendChild(container);

    const textBefore = container.textContent;
    enhanceColorSwatches(container);

    const swatches = container.querySelectorAll('.mdn-color-swatch');
    expect(swatches.length).toBe(2);
    expect(swatches[0].getAttribute('data-color')).toBe('#E9E5DD');
    expect(swatches[1].getAttribute('data-color')).toBe('#171716');

    // Syntax highlight spans are preserved
    expect(container.querySelector('.hljs-keyword')).not.toBeNull();
    expect(container.querySelector('.hljs-string')).not.toBeNull();

    // textContent is identical
    expect(container.textContent).toBe(textBefore);
  });

  it('enhances data tables (both plain text td/th and nested code tags)', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Header: #fff</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>#E9E5DD</code></td>
            <td>Background tone</td>
          </tr>
          <tr>
            <td>#171716</td>
            <td>Foreground tone</td>
          </tr>
        </tbody>
      </table>
    `;
    document.body.appendChild(container);

    const textBefore = container.textContent;
    enhanceColorSwatches(container);

    const swatches = container.querySelectorAll('.mdn-color-swatch');
    expect(swatches.length).toBe(3);

    // td with <code>#E9E5DD</code> has exactly 1 swatch inside <code>
    const codeCell = container.querySelector('td code');
    expect(codeCell?.querySelectorAll('.mdn-color-swatch').length).toBe(1);

    // plain td has exactly 1 swatch
    const plainTd = container.querySelectorAll('tbody td')[2];
    expect(plainTd.querySelectorAll('.mdn-color-swatch').length).toBe(1);

    // th has exactly 1 swatch
    const th = container.querySelector('th');
    expect(th?.querySelectorAll('.mdn-color-swatch').length).toBe(1);

    expect(container.textContent).toBe(textBefore);
  });

  it('enhances functional CSS colors (rgb, rgba, hsl, hsla, oklch, oklab)', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code>rgba(169,111,40,0.12)</code>
      <code>rgb(23, 23, 22)</code>
      <code>hsl(120, 100%, 50%)</code>
      <code>oklch(0.7 0.15 150)</code>
      <code>oklab(0.6 0.1 -0.1)</code>
    `;
    document.body.appendChild(container);

    const textBefore = container.textContent;
    enhanceColorSwatches(container);

    const swatches = container.querySelectorAll('.mdn-color-swatch');
    expect(swatches.length).toBe(5);

    expect(swatches[0].getAttribute('data-color')).toBe('rgba(169,111,40,0.12)');
    expect((swatches[0] as HTMLElement).style.getPropertyValue('--mdn-swatch-color')).toBe('rgba(169,111,40,0.12)');

    expect(swatches[1].getAttribute('data-color')).toBe('rgb(23, 23, 22)');
    expect(swatches[2].getAttribute('data-color')).toBe('hsl(120, 100%, 50%)');
    expect(swatches[3].getAttribute('data-color')).toBe('oklch(0.7 0.15 150)');
    expect(swatches[4].getAttribute('data-color')).toBe('oklab(0.6 0.1 -0.1)');

    expect(container.textContent).toBe(textBefore);
  });

  it('is completely idempotent when run multiple times', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <table>
        <tr>
          <td><code>#E9E5DD</code></td>
          <td>#171716</td>
          <td>rgba(169,111,40,0.12)</td>
        </tr>
      </table>
      <pre><code>#fff</code></pre>
    `;
    document.body.appendChild(container);

    enhanceColorSwatches(container);
    const htmlFirstPass = container.innerHTML;
    const swatchCountFirstPass = container.querySelectorAll('.mdn-color-swatch').length;
    expect(swatchCountFirstPass).toBe(4);

    // Second enhancement pass
    enhanceColorSwatches(container);
    const htmlSecondPass = container.innerHTML;
    const swatchCountSecondPass = container.querySelectorAll('.mdn-color-swatch').length;

    expect(swatchCountSecondPass).toBe(4);
    expect(htmlSecondPass).toBe(htmlFirstPass);
  });

  it('does not match invalid hex lengths or non-color words/anchors', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <code>#12345</code>
      <code>#1234567</code>
      <code>#heading-anchor</code>
      <code>#section</code>
      <code>#notacolor</code>
      <code>issue#123</code>
    `;
    document.body.appendChild(container);

    enhanceColorSwatches(container);

    const swatches = container.querySelectorAll('.mdn-color-swatch');
    expect(swatches.length).toBe(0);
  });

  it('skips interactive editors and non-rendered scopes', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="cm-editor">
        <code>#E9E5DD</code>
      </div>
      <div class="markdown-inline-editor">
        <code>#171716</code>
      </div>
      <div class="mermaid">
        #fff
      </div>
      <p>Regular paragraph #fff should not be swatched</p>
    `;
    document.body.appendChild(container);

    enhanceColorSwatches(container);

    const swatches = container.querySelectorAll('.mdn-color-swatch');
    expect(swatches.length).toBe(0);
  });

  it('detects and swatches all color tokens in manual-tests/test-code.md CSS block', () => {
    const testCodePath = path.resolve(__dirname, '../../../../manual-tests/test-code.md');
    const content = fs.readFileSync(testCodePath, 'utf8');

    const expectedTokens = [
      '#00f0ff',
      '#ff2a85',
      '#171716',
      '#e9e5ddff',
      'rgb(15, 23, 42)',
      'rgba(0, 240, 255, 0.18)',
      'hsl(217, 91%, 60%)',
      'oklch(0.72 0.19 149.5)',
    ];

    for (const token of expectedTokens) {
      expect(content).toContain(token);
    }

    const container = document.createElement('div');
    const codeEl = document.createElement('code');
    codeEl.textContent = expectedTokens.join(' \n ');
    container.appendChild(codeEl);
    document.body.appendChild(container);

    enhanceColorSwatches(container);

    const swatches = container.querySelectorAll('.mdn-color-swatch');
    expect(swatches.length).toBe(expectedTokens.length);

    const swatchedColors = Array.from(swatches).map((s) => s.getAttribute('data-color'));
    for (const token of expectedTokens) {
      expect(swatchedColors).toContain(token);
    }
  });
});
