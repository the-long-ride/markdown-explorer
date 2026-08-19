import { describe, expect, it, vi } from 'vitest';
import { capturePdfVisualBlocks } from '../../../../ui/src/export/pdf/pdfVisualCapture';

describe('PDF visual capture', () => {
  it('keeps Mermaid as sanitized SVG and marks source DOM with stable visual ids', () => {
    document.body.innerHTML = '<div class="mdn-mermaid-wrap"><div class="mermaid"><svg width="300" height="120"><script>alert(1)</script><text>Diagram</text></svg></div></div>';
    const blocks = capturePdfVisualBlocks(document.body);
    expect(blocks[0].kind).toBe('mermaid');
    expect(blocks[0].svg).toContain('<svg');
    expect(blocks[0].svg).not.toContain('<script');
    expect(document.querySelector('.mdn-mermaid-wrap')?.getAttribute('data-mdn-pdf-visual-id')).toBe('pdfv-1');
  });

  it('captures chart canvases as PNG data URLs before staging cleanup', () => {
    document.body.innerHTML = '<div class="mdn-table-chart-container"><canvas width="320" height="180"></canvas></div>';
    const canvas = document.querySelector('canvas')!;
    vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,chart');
    const blocks = capturePdfVisualBlocks(document.body);
    expect(blocks[0]).toMatchObject({ kind: 'chart', image: 'data:image/png;base64,chart' });
  });

  it('turns HTML previews into a script-free static SVG representation', () => {
    document.body.innerHTML = '<div class="mdn-html-preview-wrap"><iframe class="mdn-html-preview-iframe"></iframe></div>';
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    iframe.srcdoc = '<button onclick="alert(1)">Run</button><script>evil()</script><p>Hello preview</p>';
    const blocks = capturePdfVisualBlocks(document.body);
    expect(blocks[0].kind).toBe('htmlPreview');
    expect(blocks[0].svg).toContain('Hello preview');
    expect(blocks[0].svg).not.toContain('evil()');
    expect(blocks[0].svg).not.toContain('onclick');
  });

  it('falls back deterministically when a local image cannot be drawn', () => {
    document.body.innerHTML = '<img src="file:///missing.png" alt="Missing diagram">';
    const blocks = capturePdfVisualBlocks(document.body);
    expect(blocks[0]).toMatchObject({ kind: 'image', fallbackText: 'Missing diagram' });
    expect(blocks[0].warning).toContain('could not be captured');
  });
});
