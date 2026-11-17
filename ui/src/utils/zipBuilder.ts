// =============================================================================
// utils/zipBuilder.ts — Zero-dependency browser ZIP archive builder
// =============================================================================

export interface ZipEntryInput {
  path: string;
  content: string | Uint8Array;
}

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c >>> 0;
}

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function normalizeZipPath(rawPath: string): string {
  return rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function createZipArchive(entries: readonly ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => {
    const nameBytes = encoder.encode(normalizeZipPath(entry.path));
    const dataBytes = typeof entry.content === 'string' ? encoder.encode(entry.content) : entry.content;
    const checksum = crc32(dataBytes);
    return { nameBytes, dataBytes, checksum };
  });

  let totalSize = 22; // EOCD record
  for (const item of prepared) {
    totalSize += 30 + item.nameBytes.length + item.dataBytes.length; // Local file record
    totalSize += 46 + item.nameBytes.length; // Central directory record
  }

  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);
  let localOffset = 0;
  const offsets: number[] = [];

  // Write local file headers & data
  for (const item of prepared) {
    offsets.push(localOffset);
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint16(localOffset + 4, 20, true);
    view.setUint16(localOffset + 6, 0x0800, true); // UTF-8 filename flag
    view.setUint16(localOffset + 8, 0, true); // Stored (no compression)
    view.setUint16(localOffset + 10, 0, true);
    view.setUint16(localOffset + 12, 0, true);
    view.setUint32(localOffset + 14, item.checksum, true);
    view.setUint32(localOffset + 18, item.dataBytes.length, true);
    view.setUint32(localOffset + 22, item.dataBytes.length, true);
    view.setUint16(localOffset + 26, item.nameBytes.length, true);
    view.setUint16(localOffset + 28, 0, true); // Extra field length
    localOffset += 30;

    buffer.set(item.nameBytes, localOffset);
    localOffset += item.nameBytes.length;

    buffer.set(item.dataBytes, localOffset);
    localOffset += item.dataBytes.length;
  }

  const centralDirStart = localOffset;

  // Write central directory headers
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    const offset = offsets[i];
    view.setUint32(localOffset, 0x02014b50, true);
    view.setUint16(localOffset + 4, 20, true);
    view.setUint16(localOffset + 6, 20, true);
    view.setUint16(localOffset + 8, 0x0800, true);
    view.setUint16(localOffset + 10, 0, true);
    view.setUint16(localOffset + 12, 0, true);
    view.setUint16(localOffset + 14, 0, true);
    view.setUint32(localOffset + 16, item.checksum, true);
    view.setUint32(localOffset + 20, item.dataBytes.length, true);
    view.setUint32(localOffset + 24, item.dataBytes.length, true);
    view.setUint16(localOffset + 28, item.nameBytes.length, true);
    view.setUint16(localOffset + 30, 0, true);
    view.setUint16(localOffset + 32, 0, true);
    view.setUint16(localOffset + 34, 0, true);
    view.setUint16(localOffset + 36, 0, true);
    view.setUint32(localOffset + 38, 0, true);
    view.setUint32(localOffset + 42, offset, true);
    localOffset += 46;

    buffer.set(item.nameBytes, localOffset);
    localOffset += item.nameBytes.length;
  }

  const centralDirSize = localOffset - centralDirStart;

  // Write End of Central Directory (EOCD)
  view.setUint32(localOffset, 0x06054b50, true);
  view.setUint16(localOffset + 4, 0, true);
  view.setUint16(localOffset + 6, 0, true);
  view.setUint16(localOffset + 8, prepared.length, true);
  view.setUint16(localOffset + 10, prepared.length, true);
  view.setUint32(localOffset + 12, centralDirSize, true);
  view.setUint32(localOffset + 16, centralDirStart, true);
  view.setUint16(localOffset + 20, 0, true);

  return buffer;
}

export function createZipBlob(entries: readonly ZipEntryInput[]): Blob {
  return new Blob([createZipArchive(entries)], { type: 'application/zip' });
}

export function triggerBrowserDownload(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
