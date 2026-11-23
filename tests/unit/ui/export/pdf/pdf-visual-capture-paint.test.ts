import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturePdfVisualBlocks } from '../../../../../ui/src/export/pdf/pdfVisualCapture';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('capturePdfVisualBlocks paint normalization and fallbacks', () => {
  it('normalizes light svg paints and strips handlers', () => {
    document.body.innerHTML = `<div class="mdn-mermaid-wrap"><svg viewBox="0 0 10 10"><g onclick="x()"></g>
      <path style="stroke:#ffffff;fill:#fff;opacity:1;bogus" stroke="#fff"></path>
      <text style="fill:#ffffff;color:white;font-size:12px" onmouseover="y()">Label</text>
      <rect style=""></rect></svg></div><div class="mdn-mermaid-wrap"></div>`;
    const [block, missing] = capturePdfVisualBlocks(document.body);
    expect(block.svg).not.toContain('onclick');
    expect(block.svg).not.toMatch(/stroke:#ffffff/i);
    expect(missing.fallbackText).toBe('Mermaid diagram unavailable');
  });

  it('captures images with natural size and falls back for broken ones', () => {
    document.body.innerHTML = '<img id="ok" src="ok.png" width="20" height="10"><img id="zero" alt="Zero" src="x.png"><img id="nosrc">';
    const ok = document.getElementById('ok') as HTMLImageElement;
    Object.defineProperty(ok, 'naturalWidth', { value: 20 });
    Object.defineProperty(ok, 'naturalHeight', { value: 10 });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,QQ');
    const blocks = capturePdfVisualBlocks(document.body);
    expect(blocks[0].image).toBe('data:image/png;base64,QQ');
    expect(blocks[1].fallbackText).toBe('Zero');
    expect(blocks[2].fallbackText).toBe('Image unavailable');
  });

  it('handles null canvas contexts, oversized charts and iframe previews', () => {
    document.body.innerHTML = `<img id="ctx" src="a.png"><div class="mdn-table-chart-container"><canvas width="0" height="0"></canvas></div>
      <div class="mdn-table-chart-container"><canvas width="99999" height="99999"></canvas></div><div class="mdn-table-chart-container"></div>
      <div class="mdn-html-preview-wrap"><iframe class="mdn-html-preview-iframe" srcdoc="<p onclick='x()'>Hello &amp; &quot;world&quot; &lt;tag&gt; it's</p>"></iframe></div>
      <div class="mdn-html-preview-wrap"><iframe class="mdn-html-preview-iframe"></iframe></div><div class="mdn-html-preview-wrap"></div>`;
    const img = document.getElementById('ctx') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 5 });
    Object.defineProperty(img, 'naturalHeight', { value: 5 });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const blocks = capturePdfVisualBlocks(document.body);
    expect(blocks[0].warning).toBeTruthy();
    expect(blocks[1].fallbackText).toBe('Chart preview unavailable');
    expect(blocks[2].fallbackText).toBe('Chart preview unavailable');
    expect(blocks[3].svg).toContain('&amp;');
    expect(blocks[4].svg).toContain('HTML preview');
    expect(blocks[5].fallbackText).toBe('HTML preview unavailable');
  });
});
