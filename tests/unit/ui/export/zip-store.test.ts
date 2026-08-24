import { describe, expect, it } from 'vitest';
import { createStoreZip } from '../../../../ui/src/export/zipStore';

function u32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

describe('createStoreZip', () => {
  it('writes local headers, central directory and end-of-central-directory records', () => {
    const zip = createStoreZip([
      { path: 'index.html', data: new TextEncoder().encode('<h1>Hello</h1>') },
      { path: 'docs/guide.html', data: new TextEncoder().encode('Guide') },
    ]);

    expect(u32(zip, 0)).toBe(0x04034b50);
    const centralOffset = zip.findIndex((_, index) => index + 4 <= zip.length && u32(zip, index) === 0x02014b50);
    expect(centralOffset).toBeGreaterThan(0);
    const eocdOffset = zip.length - 22;
    expect(u32(zip, eocdOffset)).toBe(0x06054b50);
    expect(new DataView(zip.buffer, zip.byteOffset, zip.byteLength).getUint16(eocdOffset + 10, true)).toBe(2);
  });

  it('is deterministic for the same entries', () => {
    const entries = [{ path: 'café.txt', data: new TextEncoder().encode('same') }];
    expect(Array.from(createStoreZip(entries))).toEqual(Array.from(createStoreZip(entries)));
  });

  it('rejects unsafe archive paths', () => {
    expect(() => createStoreZip([{ path: '../secret.txt', data: new Uint8Array([1]) }])).toThrow('Unsafe ZIP path');
    expect(() => createStoreZip([{ path: '/absolute.txt', data: new Uint8Array([1]) }])).toThrow('Unsafe ZIP path');
  });
});
