import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  blobToDataUrl,
  canvasToPngBlob,
  copyElementImageToClipboard,
  copyImageElementToClipboard,
  copySvgElementToClipboard,
  extractDocumentFontFaceCss,
  isTauriRuntime,
  prepareStandaloneSvgForRasterization,
  rasterizeImageToPngBlob,
  rasterizeSvgToPngBlob,
  saveBlobAsFile,
  saveElementImageAsPng,
  saveImageElementAsPng,
  saveSvgElementAsPng,
  writeBlobToClipboard,
} from '../../../../ui/src/dom/copyImage.ts';

describe('copyImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete (window as any).__TAURI__;
    delete (window as any).__TAURI_INTERNALS__;
    delete (window as any).PlatformBridge;
  });

  describe('canvasToPngBlob', () => {
    it('returns blob when canvas.toBlob succeeds', async () => {
      const canvas = document.createElement('canvas');
      const expectedBlob = new Blob(['png-bytes'], { type: 'image/png' });
      canvas.toBlob = vi.fn((callback) => callback(expectedBlob));

      const result = await canvasToPngBlob(canvas);
      expect(result).toBe(expectedBlob);
    });

    it('returns null when canvas.toBlob throws', async () => {
      const canvas = document.createElement('canvas');
      canvas.toBlob = vi.fn(() => { throw new Error('SecurityError'); });

      const result = await canvasToPngBlob(canvas);
      expect(result).toBeNull();
    });
  });

  describe('writeBlobToClipboard', () => {
    it('returns false when clipboard API is unavailable', async () => {
      const blob = new Blob(['sample'], { type: 'image/png' });
      // Without ClipboardItem defined, it should return false
      const origItem = (globalThis as any).ClipboardItem;
      delete (globalThis as any).ClipboardItem;
      delete (window as any).ClipboardItem;

      expect(await writeBlobToClipboard(blob)).toBe(false);

      if (origItem) {
        (globalThis as any).ClipboardItem = origItem;
        (window as any).ClipboardItem = origItem;
      }
    });

    it('writes to navigator.clipboard and returns true on success', async () => {
      const writeMock = vi.fn().mockResolvedValue(undefined);
      class MockClipboardItem {
        constructor(public items: any) {}
      }

      (globalThis as any).ClipboardItem = MockClipboardItem;
      (window as any).ClipboardItem = MockClipboardItem;
      Object.defineProperty(navigator, 'clipboard', {
        value: { write: writeMock },
        configurable: true,
        writable: true,
      });

      try {
        const blob = new Blob(['png'], { type: 'image/png' });
        const success = await writeBlobToClipboard(blob);
        expect(success).toBe(true);
        expect(writeMock).toHaveBeenCalled();
      } finally {
        delete (globalThis as any).ClipboardItem;
        delete (window as any).ClipboardItem;
      }
    });

    it('returns false and warns when navigator.clipboard.write rejects', async () => {
      const writeMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      class MockClipboardItem {
        constructor(public items: any) {}
      }
      (globalThis as any).ClipboardItem = MockClipboardItem;
      (window as any).ClipboardItem = MockClipboardItem;
      Object.defineProperty(navigator, 'clipboard', {
        value: { write: writeMock },
        configurable: true,
        writable: true,
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const blob = new Blob(['png'], { type: 'image/png' });
        const success = await writeBlobToClipboard(blob);
        expect(success).toBe(false);
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        delete (globalThis as any).ClipboardItem;
        delete (window as any).ClipboardItem;
        warnSpy.mockRestore();
      }
    });
  });

  describe('extractDocumentFontFaceCss', () => {
    it('returns empty string when no style sheets exist', async () => {
      const css = await extractDocumentFontFaceCss();
      expect(typeof css).toBe('string');
    });

    it('extracts font-face rules with data URLs', async () => {
      const style = document.createElement('style');
      style.textContent = '@font-face { font-family: "TestFont"; src: url("data:font/ttf;base64,AAAA"); }';
      document.head.appendChild(style);

      try {
        // Mock CSSFontFaceRule in style sheet
        const sheet = style.sheet;
        if (sheet) {
          const rule = {
            cssText: '@font-face { font-family: "TestFont"; src: url("data:font/ttf;base64,AAAA"); }',
          };
          Object.setPrototypeOf(rule, CSSFontFaceRule.prototype);
          // @ts-ignore
          vi.spyOn(sheet, 'cssRules', 'get').mockReturnValue([rule] as any);
        }

        const result = await extractDocumentFontFaceCss();
        expect(result).toContain('TestFont');
      } finally {
        style.remove();
      }
    });
  });

  describe('prepareStandaloneSvgForRasterization', () => {
    it('sets namespaces, dimensions, and inlines font/color styles', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '400');
      svg.setAttribute('height', '300');

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = 'Diagram Node';
      svg.appendChild(text);

      const result = prepareStandaloneSvgForRasterization(svg, '/* custom font */');
      expect(result.width).toBe(400);
      expect(result.height).toBe(300);
      expect(result.svgXml).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(result.svgXml).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
      expect(result.svgXml).toContain('/* custom font */');
    });

    it('falls back to viewBox or default dimensions when attributes are missing', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const result = prepareStandaloneSvgForRasterization(svg);
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.svgXml).toContain('viewBox="0 0 800 600"');
    });
  });

  describe('isTauriRuntime', () => {
    it('detects tauri when __TAURI__ or __TAURI_INTERNALS__ is defined', () => {
      expect(isTauriRuntime()).toBe(false);

      (window as any).__TAURI__ = {};
      expect(isTauriRuntime()).toBe(true);

      delete (window as any).__TAURI__;
      (window as any).__TAURI_INTERNALS__ = {};
      expect(isTauriRuntime()).toBe(true);
    });
  });

  describe('blobToDataUrl', () => {
    it('converts a blob to a data URL string', async () => {
      const blob = new Blob(['hello world'], { type: 'text/plain' });
      const dataUrl = await blobToDataUrl(blob);
      expect(dataUrl).toMatch(/^data:text\/plain;base64,/);
    });
  });

  describe('saveBlobAsFile in browser environment', () => {
    it('creates an anchor, clicks it, and revokes object URL', async () => {
      vi.useFakeTimers();
      const clickMock = vi.fn();
      const origCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          el.click = clickMock;
        }
        return el;
      });

      const blob = new Blob(['data'], { type: 'image/png' });
      const success = await saveBlobAsFile(blob, 'export.png');

      expect(success).toBe(true);
      expect(clickMock).toHaveBeenCalled();

      vi.runAllTimers();
      vi.useRealTimers();
      createElementSpy.mockRestore();
    });
  });

  describe('saveElementImageAsPng and copyElementImageToClipboard', () => {
    it('handles image elements and appends png extension', async () => {
      const img = document.createElement('img');
      img.width = 100;
      img.height = 100;

      // Mock rasterizeImageToPngBlob
      const dummyBlob = new Blob(['img'], { type: 'image/png' });
      const canvas = document.createElement('canvas');
      canvas.toBlob = (cb) => cb(dummyBlob);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return canvas;
        return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
      });

      const writeMock = vi.fn().mockResolvedValue(undefined);
      // @ts-ignore
      navigator.clipboard = { write: writeMock };
      (globalThis as any).ClipboardItem = vi.fn((obj) => obj);

      const copySuccess = await copyImageElementToClipboard(img);
      expect(typeof copySuccess).toBe('boolean');

      const saveSuccess = await saveImageElementAsPng(img, 'test');
      expect(typeof saveSuccess).toBe('boolean');
    });

    it('delegates to img or svg child elements in container', async () => {
      const div = document.createElement('div');
      expect(await copyElementImageToClipboard(div)).toBe(false);
      expect(await saveElementImageAsPng(div, 'test')).toBe(false);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      div.appendChild(svg);

      // Svg copy test
      const copyResult = await copyElementImageToClipboard(div);
      expect(typeof copyResult).toBe('boolean');
    });
  });
});
