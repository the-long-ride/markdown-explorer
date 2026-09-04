import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importBrowserFontFile,
  inferBrowserFontDescriptor,
  isSupportedBrowserFontFileName,
  listBrowserFonts,
  removeBrowserFont,
} from '../../../chromium-xtension/src/browser-font-service.ts';

describe('browser-font-service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-${Math.random()}`);
    } else {
      vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${Math.random()}`);
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSupportedBrowserFontFileName', () => {
    it('accepts TTF, OTF, WOFF, and WOFF2 extensions case-insensitively', () => {
      expect(isSupportedBrowserFontFileName('Roboto-Regular.ttf')).toBe(true);
      expect(isSupportedBrowserFontFileName('FiraCode-Medium.OTF')).toBe(true);
      expect(isSupportedBrowserFontFileName('Inter.woff')).toBe(true);
      expect(isSupportedBrowserFontFileName('Cascadia.woff2')).toBe(true);
      expect(isSupportedBrowserFontFileName('  SpacedFont.TTF  ')).toBe(true);
    });

    it('rejects unsupported extensions or empty names', () => {
      expect(isSupportedBrowserFontFileName('font.eot')).toBe(false);
      expect(isSupportedBrowserFontFileName('font.svg')).toBe(false);
      expect(isSupportedBrowserFontFileName('font.txt')).toBe(false);
      expect(isSupportedBrowserFontFileName('font')).toBe(false);
      expect(isSupportedBrowserFontFileName('')).toBe(false);
    });
  });

  describe('inferBrowserFontDescriptor', () => {
    it('infers weights across the full font spectrum', () => {
      expect(inferBrowserFontDescriptor('Custom-Hairline.ttf')).toEqual({
        family: 'Custom',
        style: 'normal',
        weight: 100,
      });
      expect(inferBrowserFontDescriptor('Custom-Thin.otf')).toEqual({
        family: 'Custom',
        style: 'normal',
        weight: 100,
      });
      expect(inferBrowserFontDescriptor('Custom-ExtraLight.ttf')).toEqual({
        family: 'Custom',
        style: 'normal',
        weight: 200,
      });
      expect(inferBrowserFontDescriptor('Custom-Light.ttf')).toEqual({
        family: 'Custom',
        style: 'normal',
        weight: 300,
      });
      expect(inferBrowserFontDescriptor('Custom-Regular.ttf')).toEqual({
        family: 'Custom',
        style: 'normal',
        weight: 400,
      });
      expect(inferBrowserFontDescriptor('Custom-Medium.woff2')).toEqual({
        family: 'Custom',
        style: 'normal',
        weight: 500,
      });
      expect(inferBrowserFontDescriptor('Custom-SemiBold.woff')).toEqual({
        family: 'Custom',
        style: 'normal',
        weight: 600,
      });
      expect(inferBrowserFontDescriptor('Custom-Bold.ttf')).toEqual({
        family: 'Custom',
        style: 'normal',
        weight: 700,
      });
      expect(inferBrowserFontDescriptor('Custom-ExtraBold.ttf')).toEqual({
        family: 'Custom',
        style: 'normal',
        weight: 800,
      });
      expect(inferBrowserFontDescriptor('Custom-Black.ttf')).toEqual({
        family: 'Custom',
        style: 'normal',
        weight: 900,
      });
    });

    it('infers italic style and falls back to default family name if tokens stripped', () => {
      const italic = inferBrowserFontDescriptor('Custom-Bold-Italic.ttf');
      expect(italic.style).toBe('italic');
      expect(italic.weight).toBe(700);

      const oblique = inferBrowserFontDescriptor('Custom-Oblique.otf');
      expect(oblique.style).toBe('italic');

      const fallback = inferBrowserFontDescriptor('Bold-Italic.ttf');
      expect(fallback.family).toBe('Imported Font');
    });
  });

  describe('IndexedDB operations', () => {
    it('imports and lists browser font files with fake-indexeddb', async () => {
      const file = new File(['font content'], 'MyCustom-Bold.ttf', { type: 'font/ttf' });
      const { fonts, importedId } = await importBrowserFontFile(file);

      expect(importedId).toMatch(/^font_browser_/);
      expect(fonts.some((f) => f.id === importedId)).toBe(true);

      const importedFamily = fonts.find((f) => f.id === importedId)!;
      expect(importedFamily.family).toBe('MyCustom');
      expect(importedFamily.faces).toHaveLength(1);
      expect(importedFamily.faces[0].minWeight).toBe(700);
      expect(importedFamily.faces[0].style).toBe('normal');

      // Listing fonts should include the newly imported family
      const listed = await listBrowserFonts();
      expect(listed.some((f) => f.id === importedId)).toBe(true);

      // Remove the font family
      const remaining = await removeBrowserFont(importedId);
      expect(remaining.some((f) => f.id === importedId)).toBe(false);
    });

    it('rejects unsupported file extensions on import', async () => {
      const invalidFile = new File(['text'], 'font.txt', { type: 'text/plain' });
      await expect(importBrowserFontFile(invalidFile)).rejects.toThrow(
        'Only .ttf, .otf, .woff, and .woff2 font files can be imported.',
      );
    });

    it('rejects invalid font id formats on removal', async () => {
      await expect(removeBrowserFont('invalid_id')).rejects.toThrow(
        'Invalid imported browser font id.',
      );
      await expect(removeBrowserFont('font_browser_with_special!chars')).rejects.toThrow(
        'Invalid imported browser font id.',
      );
    });
  });
});
