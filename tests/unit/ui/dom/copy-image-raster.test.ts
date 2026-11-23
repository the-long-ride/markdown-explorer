import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  copyElementImageToClipboard,
  extractDocumentFontFaceCss,
  rasterizeImageToPngBlob,
  rasterizeSvgToPngBlob,
  saveElementImageAsPng,
  saveSvgElementAsPng,
} from '../../../../ui/src/dom/copyImage.ts';

class FakeFontFaceRule { constructor(public cssText: string) {} }

let imageMode: 'load' | 'error' = 'load';
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  naturalWidth = 0;
  naturalHeight = 0;
  private value = '';
  get src() { return this.value; }
  set src(next: string) {
    this.value = next;
    queueMicrotask(() => (imageMode === 'load' ? this.onload?.() : this.onerror?.()));
  }
}

function fakeCtx(overrides: Record<string, unknown> = {}) {
  return { fillStyle: '', fillRect: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), ...overrides } as unknown as CanvasRenderingContext2D;
}

const png = new Blob(['png'], { type: 'image/png' });

function svgElement() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '40');
  svg.setAttribute('height', '20');
  svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'text'));
  document.body.appendChild(svg);
  return svg;
}

const originalImage = globalThis.Image;

beforeEach(() => {
  imageMode = 'load';
  (globalThis as any).Image = FakeImage;
  (globalThis as any).CSSFontFaceRule = FakeFontFaceRule;
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) { cb(png); });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  (globalThis as any).Image = originalImage;
  delete (globalThis as any).CSSFontFaceRule;
  document.body.innerHTML = '';
});

describe('extractDocumentFontFaceCss', () => {
  it('inlines fetched font urls, keeps data/unfetchable urls and skips unreadable sheets', async () => {
    const throwingSheet = { get cssRules() { throw new Error('cross-origin'); } };
    vi.spyOn(document, 'styleSheets', 'get').mockReturnValue([
      throwingSheet,
      { cssRules: [
        new FakeFontFaceRule('@font-face { src: url("https://fonts.test/ok.woff2"); }'),
        new FakeFontFaceRule('@font-face { src: url("https://fonts.test/ok.woff2"); }'),
        new FakeFontFaceRule('@font-face { src: url(data:font/woff2;base64,AAAA); }'),
        new FakeFontFaceRule('@font-face { src: url("https://fonts.test/missing.woff2"); }'),
        new FakeFontFaceRule('@font-face { src: url("https://fonts.test/broken.woff2"); }'),
        new FakeFontFaceRule('@font-face { font-family: Local; }'),
        { cssText: '.not-a-font {}' },
      ] },
      { cssRules: null },
    ] as any);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('missing')) return { ok: false } as Response;
      if (url.includes('broken')) throw new Error('offline');
      return { ok: true, blob: async () => new Blob(['font'], { type: 'font/woff2' }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const css = await extractDocumentFontFaceCss();
    expect(css).toContain('url("data:font/woff2;base64,');
    expect(css).toContain('url(data:font/woff2;base64,AAAA)');
    expect(css).toContain('missing.woff2');
    expect(css).toContain('broken.woff2');
    expect(css).toContain('font-family: Local');
    expect(css).not.toContain('.not-a-font');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('ok.woff2'))).toHaveLength(1);
  });
});

describe('rasterizeSvgToPngBlob', () => {
  beforeEach(() => {
    vi.spyOn(document, 'styleSheets', 'get').mockReturnValue([] as any);
  });

  it('paints the background colour and returns the canvas blob', async () => {
    const ctx = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: (name: string) => (name === '--bg' ? ' #123456 ' : name === '--font-mermaid' ? 'monospace' : ''),
      backgroundColor: '', fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', fontStyle: 'italic', color: 'red',
    }) as any);
    const blob = await rasterizeSvgToPngBlob(svgElement());
    expect(blob).toBe(png);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillStyle).toBe('#123456');
  });

  it('returns null without a 2d context, without toBlob, on draw errors and on image errors', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(await rasterizeSvgToPngBlob(svgElement())).toBeNull();

    getContext.mockReturnValue(fakeCtx() as any);
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    (HTMLCanvasElement.prototype as any).toBlob = undefined;
    try {
      expect(await rasterizeSvgToPngBlob(svgElement())).toBeNull();
    } finally {
      HTMLCanvasElement.prototype.toBlob = toBlob;
    }

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    getContext.mockReturnValue(fakeCtx({ drawImage: () => { throw new Error('tainted'); } }) as any);
    expect(await rasterizeSvgToPngBlob(svgElement())).toBeNull();

    imageMode = 'error';
    expect(await rasterizeSvgToPngBlob(svgElement())).toBeNull();
  });

  it('saves and copies svg diagrams through the rasterizer', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx() as any);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(await saveSvgElementAsPng(svgElement())).toBe(true);
    const wrapper = document.createElement('div');
    wrapper.appendChild(svgElement());
    expect(await saveElementImageAsPng(wrapper, 'diagram')).toBe(true);
    expect(await saveElementImageAsPng(svgElement(), 'chart.png')).toBe(true);
    imageMode = 'error';
    expect(await saveSvgElementAsPng(svgElement())).toBe(false);
    expect(await copyElementImageToClipboard(wrapper)).toBe(false);
  });
});

describe('rasterizeImageToPngBlob', () => {
  function image(src: string) {
    const img = document.createElement('img');
    img.src = src;
    return img;
  }

  it('fetches png data urls directly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => png })));
    expect(await rasterizeImageToPngBlob(image('data:image/png;base64,AAAA'))).toBe(png);
  });

  it('draws onto a canvas when a context is available', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx() as any);
    expect(await rasterizeImageToPngBlob(image('https://img.test/a.jpg'))).toBe(png);
  });

  it('falls back to fetching and converting the source when the canvas is tainted', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const tainted = fakeCtx({ drawImage: () => { throw new Error('tainted'); } });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tmp');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const jpeg = new Blob(['jpg'], { type: 'image/jpeg' });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('fail')) throw new Error('offline');
      if (url.includes('png')) return { blob: async () => png };
      if (url.includes('empty')) return { blob: async () => null };
      return { blob: async () => jpeg };
    }));

    getContext.mockReturnValue(tainted as any);
    expect(await rasterizeImageToPngBlob(image('https://img.test/a.png'))).toBe(png);

    getContext.mockReturnValueOnce(tainted as any).mockReturnValueOnce(fakeCtx() as any);
    expect(await rasterizeImageToPngBlob(image('https://img.test/a.jpg'))).toBe(png);

    getContext.mockReturnValueOnce(tainted as any).mockReturnValueOnce(null);
    expect(await rasterizeImageToPngBlob(image('https://img.test/b.jpg'))).toBe(jpeg);

    getContext.mockReturnValueOnce(tainted as any).mockReturnValueOnce(fakeCtx({ drawImage: () => { throw new Error('x'); } }) as any);
    expect(await rasterizeImageToPngBlob(image('https://img.test/c.jpg'))).toBe(jpeg);

    getContext.mockReturnValue(tainted as any);
    imageMode = 'error';
    expect(await rasterizeImageToPngBlob(image('https://img.test/d.jpg'))).toBe(jpeg);
    expect(await rasterizeImageToPngBlob(image('https://img.test/empty.jpg'))).toBeNull();
    expect(await rasterizeImageToPngBlob(image('https://img.test/fail.jpg'))).toBeNull();
    expect(await rasterizeImageToPngBlob(document.createElement('img'))).toBeNull();
  });

  it('returns null when canvas toBlob yields nothing and the source cannot be fetched', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx() as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) { cb(null); });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await rasterizeImageToPngBlob(image('https://img.test/a.jpg'))).toBeNull();
    expect(await copyElementImageToClipboard(image('https://img.test/a.jpg'))).toBe(false);
    expect(await saveElementImageAsPng(image('https://img.test/a.jpg'), 'pic')).toBe(false);
    expect(await copyElementImageToClipboard(document.createElement('div'))).toBe(false);
  });
});
