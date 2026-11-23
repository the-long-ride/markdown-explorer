import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createFontService,
  defaultSystemFontRoots,
  inspectFontBuffer,
  inspectFontFile,
} = require('../../../electron/fonts/font-service.js');

const normalFont = path.resolve('ui/assets/fonts/JetBrainsMono/JetBrainsMono-VariableFont_wght.ttf');
const italicFont = path.resolve('ui/assets/fonts/JetBrainsMono/JetBrainsMono-Italic-VariableFont_wght.ttf');

type Name = { id: number; value: string; platform?: number; encoding?: number; language?: number; bytes?: Buffer };

function nameTable(names: Name[]) {
  const records = Buffer.alloc(6 + 12 * names.length);
  records.writeUInt16BE(names.length, 2);
  records.writeUInt16BE(records.length, 4);
  let offset = 0;
  const strings = names.map(({ id, value, platform = 3, encoding = 1, language = 0x409, bytes }, index) => {
    const text = bytes ?? (platform === 0 || platform === 3
      ? Buffer.from(value, 'utf16le').swap16()
      : Buffer.from(value, platform === 1 || encoding === 0 ? 'latin1' : 'utf8'));
    const record = 6 + 12 * index;
    [platform, encoding, language, id, text.length, offset].forEach((field, i) => records.writeUInt16BE(field, record + i * 2));
    offset += text.length;
    return text;
  });
  return Buffer.concat([records, ...strings]);
}

function font(tables: Record<string, Buffer>, faceOffset = 0) {
  const entries = Object.entries(tables);
  const header = Buffer.alloc(faceOffset + 12 + entries.length * 16);
  header.writeUInt32BE(0x10000, faceOffset);
  header.writeUInt16BE(entries.length, faceOffset + 4);
  let offset = header.length;
  entries.forEach(([tag, contents], index) => {
    const record = faceOffset + 12 + index * 16;
    header.write(tag, record, 'ascii');
    header.writeUInt32BE(offset, record + 8);
    header.writeUInt32BE(contents.length, record + 12);
    offset += contents.length;
  });
  return Buffer.concat([header, ...entries.map(([, contents]) => contents)]);
}

function variableAxis(tag: string, min: number, max: number) {
  const table = Buffer.alloc(36);
  table.writeUInt16BE(16, 4);
  table.writeUInt16BE(1, 8);
  table.writeUInt16BE(20, 10);
  table.write(tag, 16, 'ascii');
  table.writeInt32BE(min * 65536, 20);
  table.writeInt32BE(max * 65536, 28);
  return table;
}

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

    it('prefers typographic and English Windows names while skipping malformed name records', () => {
      const name = nameTable([
        { id: 1, value: 'Legacy' }, { id: 4, value: 'Full name' },
        { id: 16, value: 'Mac', platform: 1 }, { id: 16, value: 'Unicode', platform: 0, language: 0 },
        { id: 16, value: 'Localized', language: 0x411 }, { id: 16, value: 'Odd', bytes: Buffer.from([1]) },
        { id: 16, value: '  Preferred\0 ' }, { id: 2, value: 'Oblique', platform: 2, encoding: 1 },
        { id: 17, value: '', platform: 2, encoding: 0 },
      ]);
      expect(inspectFontBuffer(font({ name }))).toMatchObject([
        { family: 'Preferred', style: 'italic', minWeight: 400, maxWeight: 400 },
      ]);
    });

    it('reads a font collection and falls back from invalid weight to the default', () => {
      const name = nameTable([{ id: 1, value: 'Collection', platform: 1 }]);
      const os2 = Buffer.alloc(64);
      os2.writeUInt16BE(1500, 4);
      const head = Buffer.alloc(46);
      head.writeUInt16BE(2, 44);
      const collection = font({ name, 'OS/2': os2, head }, 16);
      collection.write('ttcf');
      collection.writeUInt32BE(1, 8);
      collection.writeUInt32BE(16, 12);
      expect(inspectFontBuffer(collection)).toMatchObject([
        { family: 'Collection', style: 'italic', minWeight: 400, maxWeight: 400, variable: false },
      ]);
    });

    it.each([
      ['slnt', -10, 0, ['normal', 'italic']], ['slnt', 0, 10, ['normal', 'italic']],
      ['slnt', 0, 0, ['normal']], ['ital', 0, 1, ['normal', 'italic']],
    ] as const)('exposes the %s axis for range %i to %i', (tag, min, max, styles) => {
      const name = nameTable([{ id: 1, value: 'Variable' }, { id: 17, value: 'Regular' }]);
      const faces = inspectFontBuffer(font({ name, fvar: variableAxis(tag, min, max) }));
      expect(faces.map((face: { style: string }) => face.style)).toEqual(styles);
      expect(faces.every((face: { variable: boolean }) => face.variable)).toBe(true);
    });

    it('ignores out-of-bounds name strings and truncated variable axis records', () => {
      const name = nameTable([{ id: 1, value: 'Readable' }, { id: 16, value: 'Bad offset' }]);
      name.writeUInt16BE(65535, 28);
      const fvar = variableAxis('wght', 100, 800).subarray(0, 25);
      expect(inspectFontBuffer(font({ name, fvar }))).toMatchObject([
        { family: 'Readable', minWeight: 400, maxWeight: 400 },
      ]);
      const truncated = nameTable([{ id: 1, value: 'Readable' }]);
      truncated.writeUInt16BE(100, 2);
      expect(inspectFontBuffer(font({ name: truncated }))).toMatchObject([{ family: 'Readable' }]);
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

    it('discovers supported fonts recursively and ignores duplicates, missing roots, and corrupt files', async () => {
      const system = path.join(tempDir, 'system');
      const nested = path.join(system, 'nested');
      const managed = path.join(tempDir, 'fonts');
      await mkdir(nested, { recursive: true });
      await mkdir(path.join(managed, 'unmanaged'), { recursive: true });
      await copyFile(normalFont, path.join(nested, 'sample.TTF'));
      await writeFile(path.join(nested, 'invalid.otc'), 'invalid');
      await writeFile(path.join(nested, 'ignore.txt'), 'not a font');
      await writeFile(path.join(managed, 'unexpected-file'), '');
      const service = createFontService({ appDataDir: tempDir, systemFontRoots: [system, system, path.join(system, 'missing')] });
      expect(await service.listFonts()).toMatchObject([
        { family: 'JetBrains Mono', source: 'system', faces: [{ style: 'normal' }] },
      ]);
    });

    it('rejects mixed font families without persisting imports', async () => {
      const first = path.join(tempDir, 'first.ttf');
      const second = path.join(tempDir, 'second.otf');
      await writeFile(first, font({ name: nameTable([{ id: 1, value: 'First' }]) }));
      await writeFile(second, font({ name: nameTable([{ id: 1, value: 'Second' }]) }));
      const service = createFontService({ appDataDir: tempDir, systemFontRoots: [] });
      await expect(service.importFontFiles([first, second])).rejects.toThrow('one font family');
      await expect(service.importFontFiles(null)).rejects.toThrow('Choose at least one');
      await expect(service.listFonts()).resolves.toEqual([]);
      expect(() => createFontService()).toThrow('appDataDir is required');
    });

    it('uses Windows defaults if no font directories are configured', () => {
      vi.stubEnv('WINDIR', undefined);
      vi.stubEnv('LOCALAPPDATA', undefined);
      vi.stubEnv('USERPROFILE', 'C:\\Users\\Test');
      expect(defaultSystemFontRoots('win32')).toEqual([
        'C:\\Windows\\Fonts', 'C:\\Users\\Test\\AppData\\Local\\Microsoft\\Windows\\Fonts',
      ]);
      vi.stubEnv('USERPROFILE', undefined);
      expect(defaultSystemFontRoots('win32')[1]).toBe(path.win32.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts'));
    });
  });
});
