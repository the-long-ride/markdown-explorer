import { describe, expect, it, vi } from 'vitest';
import { capturePdfVisualBlocks } from '../../../../ui/src/export/pdf/pdfVisualCapture';

describe('PDF visual capture', () => {
  it('keeps Mermaid as sanitized SVG, normalizes light print paint, and records SVG dimensions', () => {
    document.body.innerHTML = '<div class="mdn-mermaid-wrap"><div class="mermaid"><svg width="300" height="120"><script>alert(1)</script><text fill="#ffffff" stroke="#fafafa">Diagram</text><path d="M0 0L10 10" fill="none" stroke="#ffffff"/></svg></div></div>';
    const blocks = capturePdfVisualBlocks(document.body);
    expect(blocks[0]).toMatchObject({ kind: 'mermaid', width: 300, height: 120 });
    expect(blocks[0].svg).toContain('<svg');
    expect(blocks[0].svg).not.toContain('<script');
    expect(blocks[0].svg).toContain('fill="#1f2328"');
    expect(blocks[0].svg).toContain('stroke="#57606a"');
    expect(blocks[0].svg).not.toContain('stroke="#ffffff"');
    expect(document.querySelector('.mdn-mermaid-wrap')?.getAttribute('data-mdn-pdf-visual-id')).toBe('pdfv-1');
  });

  it('captures chart canvases as PNG data URLs before staging cleanup', () => {
    document.body.innerHTML = '<div class="mdn-table-chart-container"><canvas width="320" height="180"></canvas></div>';
    const canvas = document.querySelector('canvas')!;
    vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,chart');
    const blocks = capturePdfVisualBlocks(document.body);
    expect(blocks[0]).toMatchObject({ kind: 'chart', image: 'data:image/png;base64,chart', width: 320, height: 180 });
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
