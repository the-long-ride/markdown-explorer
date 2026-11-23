import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createVsCodeFontService, defaultSystemFontRoots } from '../../../vscode/src/fonts/fontService';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'vscode-font-metadata-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

function names(records: Array<[number, number, number, number, Buffer]>) {
  const storage = 6 + records.length * 12;
  const table = Buffer.alloc(storage + records.reduce((sum, record) => sum + record[4].length, 0));
  table.writeUInt16BE(records.length, 2);
  table.writeUInt16BE(storage, 4);
  let offset = 0;
  records.forEach(([platform, encoding, language, name, value], index) => {
    [platform, encoding, language, name, value.length, offset].forEach((field, fieldIndex) => {
      table.writeUInt16BE(field, 6 + index * 12 + fieldIndex * 2);
    });
    value.copy(table, storage + offset);
    offset += value.length;
  });
  return table;
}

function variation(axes: Array<[string, number, number]>) {
  const table = Buffer.alloc(16 + axes.length * 20);
  table.writeUInt16BE(16, 4);
  table.writeUInt16BE(axes.length, 8);
  table.writeUInt16BE(20, 10);
  axes.forEach(([tag, min, max], index) => {
    const offset = 16 + index * 20;
    table.write(tag, offset);
    table.writeInt32BE(min * 65536, offset + 4);
    table.writeInt32BE(max * 65536, offset + 12);
  });
  return table;
}

function sfnt(tables: Record<string, Buffer>, faceOffset = 0) {
  const entries = Object.entries(tables);
  let offset = 12 + entries.length * 16;
  const file = Buffer.alloc(offset + entries.reduce((sum, [, table]) => sum + table.length, 0));
  file.writeUInt32BE(0x00010000);
  file.writeUInt16BE(entries.length, 4);
  entries.forEach(([tag, table], index) => {
    const record = 12 + index * 16;
    file.write(tag, record);
    file.writeUInt32BE(faceOffset + offset, record + 8);
    file.writeUInt32BE(table.length, record + 12);
    table.copy(file, offset);
    offset += table.length;
  });
  return file;
}

test('lists OpenType collection faces, preferring typographic names and expanding style axes', async () => {
  const name = names([
    [1, 0, 0, 1, Buffer.from('Fallback', 'latin1')],
    [3, 1, 0, 16, Buffer.from([0xff])],
    [2, 1, 1, 16, Buffer.from('Variation É', 'utf8')],
    [0, 1, 0, 16, Buffer.from('Fixture Sans', 'utf16le').swap16()],
    [3, 1, 0x409, 16, Buffer.from('Preferred Family', 'utf16le').swap16()],
  ]);
  const first = sfnt({ name, fvar: variation([['wght', 50, 1200], ['ital', 0, 1]]) }, 20);
  const secondOffset = 20 + first.length;
  const second = sfnt({
    name: names([[1, 0, 0, 1, Buffer.from('Slanted', 'latin1')]]),
    fvar: variation([['slnt', -12, 0]]),
  }, secondOffset);
  const header = Buffer.alloc(20);
  header.write('ttcf');
  header.writeUInt32BE(2, 4);
  header.writeUInt32BE(2, 8);
  header.writeUInt32BE(20, 12);
  header.writeUInt32BE(secondOffset, 16);
  await fs.writeFile(path.join(root, 'collection.ttc'), Buffer.concat([header, first, second]));
  await fs.writeFile(path.join(root, 'corrupt.otf'), Buffer.from('short'));
  const service = createVsCodeFontService({
    managedRoot: path.join(root, 'managed'), systemFontRoots: [root, root, path.join(root, 'missing')],
    resolveCssUrl: () => 'webview://collection',
  });
  expect(await service.listFonts()).toEqual([
    expect.objectContaining({ family: 'Preferred Family', faces: [
      expect.objectContaining({ style: 'normal', minWeight: 50, maxWeight: 1000 }),
      expect.objectContaining({ style: 'italic', minWeight: 50, maxWeight: 1000 }),
    ] }),
    expect.objectContaining({ family: 'Slanted', faces: [
      expect.objectContaining({ style: 'normal', minWeight: 400, maxWeight: 400 }),
      expect.objectContaining({ style: 'italic', minWeight: 400, maxWeight: 400 }),
    ] }),
  ]);
});

test('identifies italic faces using legacy metadata and falls back from invalid weights', async () => {
  const head = Buffer.alloc(46);
  head.writeUInt16BE(0x0002, 44);
  const os2 = Buffer.alloc(64);
  os2.writeUInt16BE(1200, 4);
  const name = names([[1, 0, 0, 1, Buffer.from('Legacy Font', 'latin1')]]);
  await fs.writeFile(path.join(root, 'legacy.otf'), sfnt({ name, head, 'OS/2': os2 }));
  const service = createVsCodeFontService({
    managedRoot: path.join(root, 'managed'), systemFontRoots: [root], resolveCssUrl: p => path.basename(p),
  });
  expect(await service.listFonts()).toEqual([expect.objectContaining({
    family: 'Legacy Font', faces: [expect.objectContaining({ style: 'italic', minWeight: 400, maxWeight: 400 })],
  })]);
});

test('cleans partial imports when a resource cannot be copied or exposed', async () => {
  const original = path.join(root, 'fixture.ttf');
  const managedRoot = path.join(root, 'managed');
  await fs.writeFile(original, sfnt({ name: names([[1, 0, 0, 1, Buffer.from('Import Font')]]) }));
  const service = createVsCodeFontService({
    managedRoot, systemFontRoots: [], resolveCssUrl() { throw new Error('webview unavailable'); },
  });
  const copyFile = vi.spyOn(fs, 'copyFile').mockRejectedValueOnce(new Error('copy failed'));
  await expect(service.importFontFiles([original])).rejects.toThrow('copy failed');
  await expect(fs.readdir(managedRoot)).resolves.toEqual([]);
  copyFile.mockRestore();
  await expect(service.importFontFiles([original])).rejects.toThrow('webview unavailable');
  await expect(fs.readdir(managedRoot)).resolves.toEqual([]);
});

test('uses Windows local app data when supplied and falls back to the home directory when absent', () => {
  vi.stubEnv('WINDIR', 'D:\\Windows');
  vi.stubEnv('LOCALAPPDATA', 'D:\\Profile\\Local');
  expect(defaultSystemFontRoots('win32')).toEqual(['D:\\Windows\\Fonts', 'D:\\Profile\\Local\\Microsoft\\Windows\\Fonts']);
  vi.stubEnv('WINDIR', undefined);
  vi.stubEnv('LOCALAPPDATA', undefined);
  vi.stubEnv('USERPROFILE', undefined);
  expect(defaultSystemFontRoots('win32')).toEqual([
    'C:\\Windows\\Fonts',
    path.win32.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts'),
  ]);
});
