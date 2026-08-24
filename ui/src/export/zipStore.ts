const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const UTF8_FLAG = 0x0800;
const MAX_U16 = 0xffff;
const MAX_U32 = 0xffffffff;

export interface StoreZipEntry {
  path: string;
  data: Uint8Array;
}

function sanitizeZipPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Unsafe ZIP path: ${path}`);
  }
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Unsafe ZIP path: ${path}`);
  }
  return parts.join('/');
}

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < table.length; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
}

const CRC_TABLE = createCrcTable();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function createStoreZip(entries: readonly StoreZipEntry[]): Uint8Array {
  if (entries.length > MAX_U16) throw new Error('Too many ZIP entries for ZIP32');

  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const path = sanitizeZipPath(entry.path);
    const name = encoder.encode(path);
    if (name.byteLength > MAX_U16) throw new Error(`ZIP path is too long: ${path}`);
    if (entry.data.byteLength > MAX_U32) throw new Error(`ZIP entry is too large: ${path}`);
    if (localOffset > MAX_U32) throw new Error('ZIP archive exceeds ZIP32 limits');

    const crc = crc32(entry.data);
    const localHeader = concat([
      u32(LOCAL_FILE_HEADER),
      u16(20),
      u16(UTF8_FLAG),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.data.byteLength),
      u32(entry.data.byteLength),
      u16(name.byteLength),
      u16(0),
      name,
    ]);
    localParts.push(localHeader, entry.data);

    const centralHeader = concat([
      u32(CENTRAL_DIRECTORY_HEADER),
      u16(20),
      u16(20),
      u16(UTF8_FLAG),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.data.byteLength),
      u32(entry.data.byteLength),
      u16(name.byteLength),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(localOffset),
      name,
    ]);
    centralParts.push(centralHeader);
    localOffset += localHeader.byteLength + entry.data.byteLength;
  }

  const localData = concat(localParts);
  const centralData = concat(centralParts);
  if (localData.byteLength > MAX_U32 || centralData.byteLength > MAX_U32) {
    throw new Error('ZIP archive exceeds ZIP32 limits');
  }

  const eocd = concat([
    u32(END_OF_CENTRAL_DIRECTORY),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralData.byteLength),
    u32(localData.byteLength),
    u16(0),
  ]);

  return concat([localData, centralData, eocd]);
}
