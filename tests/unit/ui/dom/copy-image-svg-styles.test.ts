import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareStandaloneSvgForRasterization, writeBlobToClipboard } from '../../../../ui/src/dom/copyImage';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

describe('copyImage svg styles and clipboard types', () => {
  it('defaults untyped blobs to image/png', async () => {
    const write = vi.fn(async () => undefined);
    const ClipboardItem = vi.fn(function (this: any, data: any) { this.data = data; });
    vi.stubGlobal('ClipboardItem', ClipboardItem);
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
    expect(await writeBlobToClipboard(new Blob(['x']))).toBe(true);
    expect(Object.keys((ClipboardItem.mock.calls[0] as any)[0])).toEqual(['image/png']);
  });

  it('inlines computed fonts and colors and uses css variables for background and font', () => {
    document.body.innerHTML = '<svg width="10" height="20"><foreignObject><div><span>t</span></div></foreignObject><text>x</text></svg>';
    const svg = document.querySelector('svg') as SVGSVGElement;
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: (name: string) => (name === '--bg' ? '#123' : name === '--font-mermaid' ? 'Mono' : ''),
      backgroundColor: '', fontFamily: '', fontSize: '12px', fontWeight: '700', fontStyle: 'italic', color: 'red',
    }) as any);
    const result = prepareStandaloneSvgForRasterization(svg, '@font-face{}');
    expect(result.bgColor).toBe('#123');
    expect(result.svgXml).toContain('font-weight');
    expect(result.svgXml).toContain('Mono');
  });

  it('falls back to transparent background without computed styles', () => {
    document.body.innerHTML = '<svg><text>x</text></svg>';
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => null as any);
    const result = prepareStandaloneSvgForRasterization(document.querySelector('svg') as SVGSVGElement);
    expect(result.svgXml).toContain('transparent');
  });
});
