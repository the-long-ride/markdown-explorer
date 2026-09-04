import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const {
  createFontService,
  defaultSystemFontRoots,
  inspectFontBuffer,
  inspectFontFile,
} = require('../../../electron/fonts/font-service.js');

const normalFont = path.resolve('ui/assets/fonts/JetBrainsMono/JetBrainsMono-VariableFont_wght.ttf');
const italicFont = path.resolve('ui/assets/fonts/JetBrainsMono/JetBrainsMono-Italic-VariableFont_wght.ttf');

describe('electron font-service', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'electron-font-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('defaultSystemFontRoots', () => {
    it('detects Windows font roots', () => {
      const origWinDir = process.env.WINDIR;
      const origLocal = process.env.LOCALAPPDATA;
      process.env.WINDIR = 'C:\\Windows';
      process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';

      try {
        const roots = defaultSystemFontRoots('win32');
        expect(roots).toContain(path.win32.join('C:\\Windows', 'Fonts'));
        expect(roots).toContain(path.win32.join('C:\\Users\\Test\\AppData\\Local', 'Microsoft', 'Windows', 'Fonts'));
      } finally {
        process.env.WINDIR = origWinDir;
        process.env.LOCALAPPDATA = origLocal;
      }
    });

    it('detects macOS and Linux font roots', () => {
      const macRoots = defaultSystemFontRoots('darwin');
      expect(macRoots.some((r: string) => r.includes('Library/Fonts'))).toBe(true);

      const linuxRoots = defaultSystemFontRoots('linux');
      expect(linuxRoots).toContain('/usr/share/fonts');
      expect(linuxRoots).toContain('/usr/local/share/fonts');

      // Other platforms fallback to linux roots
      const otherRoots = defaultSystemFontRoots('sunos' as any);
      expect(otherRoots).toEqual(linuxRoots);
    });
  });

  describe('inspectFontFile and inspectFontBuffer', () => {
    it('parses upright and italic bundled font files', async () => {
      const normalFaces = await inspectFontFile(normalFont);
      expect(normalFaces.length).toBeGreaterThanOrEqual(1);
      expect(normalFaces[0].family).toBe('JetBrains Mono');
      expect(normalFaces[0].style).toBe('normal');
      expect(normalFaces[0].variable).toBe(true);

      const italicFaces = await inspectFontFile(italicFont);
      expect(italicFaces.length).toBeGreaterThanOrEqual(1);
      expect(italicFaces[0].family).toBe('JetBrains Mono');
      expect(italicFaces[0].style).toBe('italic');
    });

    it('throws when font family metadata is missing on corrupt or empty buffers', () => {
      expect(() => inspectFontBuffer(Buffer.alloc(0))).toThrow(/Font family metadata is missing/);
      expect(() => inspectFontBuffer(Buffer.from('not a font'))).toThrow(/Font family metadata is missing/);
      expect(() => inspectFontBuffer(Buffer.alloc(100), 'custom-path.ttf')).toThrow(
        'Font family metadata is missing: custom-path.ttf',
      );
    });
  });

  describe('createFontService lifecycle', () => {
    it('imports font files, lists them, and deletes by id', async () => {
      const service = createFontService({
        appDataDir: tempDir,
        systemFontRoots: [],
        pathToFileURL,
      });

      const family = await service.importFontFiles([normalFont, italicFont]);
      expect(family.family).toBe('JetBrains Mono');
      expect(family.source).toBe('imported');
      expect(family.faces.every((f: any) => f.cssUrl?.startsWith('file:'))).toBe(true);

      const list = await service.listFonts();
      expect(list.some((f: any) => f.id === family.id)).toBe(true);

      await service.removeImportedFont(family.id);
      const afterDelete = await service.listFonts();
      expect(afterDelete.some((f: any) => f.id === family.id)).toBe(false);
    });

    it('validates file types and IDs on import/removal', async () => {
      const service = createFontService({
        appDataDir: tempDir,
        systemFontRoots: [],
      });

      await expect(service.importFontFiles([])).rejects.toThrow('Choose at least one .ttf or .otf font file.');

      const badFile = path.join(tempDir, 'fake.txt');
      await writeFile(badFile, 'txt');
      await expect(service.importFontFiles([badFile])).rejects.toThrow('Only .ttf and .otf font files can be imported.');

      await expect(service.removeImportedFont('malicious/../id')).rejects.toThrow('Invalid imported font id.');
    });
  });
});
