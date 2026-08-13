import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const IMPORT_FONT_EXTENSIONS = new Set(['.ttf', '.otf']);
const SYSTEM_FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc', '.otc']);
const MAX_SYSTEM_FONT_FILES = 6000;

export type VsCodeFontStyle = 'normal' | 'italic';

export interface VsCodeFontFace {
  readonly style: VsCodeFontStyle;
  readonly minWeight: number;
  readonly maxWeight: number;
  readonly variable: boolean;
  readonly cssUrl?: string;
}

export interface VsCodeFontFamily {
  readonly id: string;
  readonly family: string;
  readonly source: 'system' | 'imported';
  readonly cssFamily: string;
  readonly available: boolean;
  readonly faces: readonly VsCodeFontFace[];
}

interface ParsedFace {
  readonly family: string;
  readonly style: VsCodeFontStyle;
  readonly minWeight: number;
  readonly maxWeight: number;
  readonly variable: boolean;
  readonly supportsItalicAxis: boolean;
  readonly sourcePath: string;
}

interface FontTable { readonly offset: number; readonly length: number }

export interface VsCodeFontServiceOptions {
  readonly managedRoot: string;
  readonly platform?: NodeJS.Platform;
  readonly systemFontRoots?: readonly string[];
  readonly resolveCssUrl: (filePath: string) => string;
}

function u16(buffer: Buffer, offset: number): number {
  return offset >= 0 && offset + 2 <= buffer.length ? buffer.readUInt16BE(offset) : 0;
}

function u32(buffer: Buffer, offset: number): number {
  return offset >= 0 && offset + 4 <= buffer.length ? buffer.readUInt32BE(offset) : 0;
}

function fixed16_16(buffer: Buffer, offset: number): number {
  return u32(buffer, offset) / 65536;
}

function signedFixed16_16(buffer: Buffer, offset: number): number {
  return offset >= 0 && offset + 4 <= buffer.length ? buffer.readInt32BE(offset) / 65536 : 0;
}

function tag(buffer: Buffer, offset: number): string {
  return offset >= 0 && offset + 4 <= buffer.length ? buffer.toString('ascii', offset, offset + 4) : '';
}

function tableMap(buffer: Buffer, faceOffset = 0): Map<string, FontTable> {
  const count = u16(buffer, faceOffset + 4);
  const tables = new Map<string, FontTable>();
  for (let index = 0; index < count; index += 1) {
    const record = faceOffset + 12 + index * 16;
    const tableTag = tag(buffer, record);
    const offset = u32(buffer, record + 8);
    const length = u32(buffer, record + 12);
    if (tableTag && offset + length <= buffer.length) tables.set(tableTag, { offset, length });
  }
  return tables;
}

function decodeName(buffer: Buffer, record: number, storageOffset: number): string {
  const platformId = u16(buffer, record);
  const encodingId = u16(buffer, record + 2);
  const length = u16(buffer, record + 8);
  const stringOffset = u16(buffer, record + 10);
  const start = storageOffset + stringOffset;
  const end = start + length;
  if (start < 0 || end > buffer.length) return '';
  const slice = buffer.subarray(start, end);
  if (platformId === 0 || platformId === 3) {
    if (slice.length % 2 !== 0) return '';
    let value = '';
    for (let index = 0; index < slice.length; index += 2) value += String.fromCharCode(slice.readUInt16BE(index));
    return value.replace(/\0/g, '').trim();
  }
  if (platformId === 1 || encodingId === 0) return slice.toString('latin1').replace(/\0/g, '').trim();
  return slice.toString('utf8').replace(/\0/g, '').trim();
}

function readNames(buffer: Buffer, table: FontTable | undefined): { family: string; subfamily: string } {
  if (!table) return { family: '', subfamily: '' };
  const count = u16(buffer, table.offset + 2);
  const storageOffset = table.offset + u16(buffer, table.offset + 4);
  const candidates: Record<'family' | 'typographicFamily' | 'subfamily' | 'typographicSubfamily', Array<{ value: string; score: number }>> = {
    family: [], typographicFamily: [], subfamily: [], typographicSubfamily: [],
  };
  for (let index = 0; index < count; index += 1) {
    const record = table.offset + 6 + index * 12;
    if (record + 12 > table.offset + table.length) break;
    const nameId = u16(buffer, record + 6);
    const value = decodeName(buffer, record, storageOffset);
    if (!value) continue;
    const platformId = u16(buffer, record);
    const languageId = u16(buffer, record + 4);
    const score = (platformId === 3 ? 10 : platformId === 0 ? 8 : 0) + (languageId === 0x0409 || languageId === 0 ? 2 : 0);
    const target = nameId === 16 ? candidates.typographicFamily
      : nameId === 1 ? candidates.family
      : nameId === 17 ? candidates.typographicSubfamily
      : nameId === 2 ? candidates.subfamily
      : undefined;
    target?.push({ value, score });
  }
  const pick = (items: Array<{ value: string; score: number }>): string => items.sort((a, b) => b.score - a.score)[0]?.value ?? '';
  return {
    family: pick(candidates.typographicFamily) || pick(candidates.family),
    subfamily: pick(candidates.typographicSubfamily) || pick(candidates.subfamily),
  };
}

function inspectFace(buffer: Buffer, faceOffset = 0, sourcePath = ''): ParsedFace {
  const tables = tableMap(buffer, faceOffset);
  const names = readNames(buffer, tables.get('name'));
  if (!names.family) throw new Error(`Font family metadata is missing: ${sourcePath || 'font'}`);
  const os2 = tables.get('OS/2');
  const head = tables.get('head');
  const fvar = tables.get('fvar');
  let weight = os2 ? u16(buffer, os2.offset + 4) : 400;
  if (weight < 1 || weight > 1000) weight = 400;
  let italic = false;
  if (os2 && os2.length >= 64) italic = Boolean(u16(buffer, os2.offset + 62) & 0x0001);
  if (!italic && head && head.length >= 46) italic = Boolean(u16(buffer, head.offset + 44) & 0x0002);
  if (!italic) italic = /italic|oblique/i.test(names.subfamily);

  let minWeight = weight;
  let maxWeight = weight;
  let variable = false;
  let supportsItalicAxis = false;
  if (fvar && fvar.length >= 16) {
    const axesArrayOffset = u16(buffer, fvar.offset + 4);
    const axisCount = u16(buffer, fvar.offset + 8);
    const axisSize = u16(buffer, fvar.offset + 10);
    variable = axisCount > 0;
    for (let index = 0; index < axisCount; index += 1) {
      const axis = fvar.offset + axesArrayOffset + index * axisSize;
      if (axis + 16 > fvar.offset + fvar.length) break;
      const axisTag = tag(buffer, axis);
      if (axisTag === 'wght') {
        minWeight = Math.max(1, Math.round(fixed16_16(buffer, axis + 4)));
        maxWeight = Math.min(1000, Math.round(fixed16_16(buffer, axis + 12)));
      } else if (axisTag === 'ital') {
        supportsItalicAxis = fixed16_16(buffer, axis + 12) >= 1;
      } else if (axisTag === 'slnt') {
        supportsItalicAxis = signedFixed16_16(buffer, axis + 4) !== 0 || signedFixed16_16(buffer, axis + 12) !== 0;
      }
    }
  }
  return { family: names.family, style: italic ? 'italic' : 'normal', minWeight, maxWeight, variable, supportsItalicAxis, sourcePath };
}

function inspectFontBuffer(buffer: Buffer, sourcePath = ''): ParsedFace[] {
  const faces: ParsedFace[] = [];
  if (tag(buffer, 0) === 'ttcf') {
    const count = u32(buffer, 8);
    for (let index = 0; index < count; index += 1) faces.push(inspectFace(buffer, u32(buffer, 12 + index * 4), sourcePath));
  } else {
    faces.push(inspectFace(buffer, 0, sourcePath));
  }
  return faces.flatMap((face) => face.supportsItalicAxis
    ? [{ ...face, style: 'normal' as const }, { ...face, style: 'italic' as const }]
    : [face]);
}

async function inspectFontFile(filePath: string): Promise<ParsedFace[]> {
  if (!SYSTEM_FONT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) throw new Error('Unsupported font file type');
  return inspectFontBuffer(await fs.promises.readFile(filePath), filePath);
}

export function defaultSystemFontRoots(platform: NodeJS.Platform = process.platform): string[] {
  if (platform === 'win32') {
    const windowsDir = process.env.WINDIR || 'C:\\Windows';
    const localAppData = process.env.LOCALAPPDATA || path.win32.join(process.env.USERPROFILE || os.homedir(), 'AppData', 'Local');
    return [path.win32.join(windowsDir, 'Fonts'), path.win32.join(localAppData, 'Microsoft', 'Windows', 'Fonts')];
  }
  if (platform === 'darwin') return ['/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library/Fonts')];
  return ['/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts'), path.join(os.homedir(), '.local/share/fonts')];
}

async function collectFontFiles(roots: readonly string[]): Promise<string[]> {
  const results: string[] = [];
  const pending = roots.map((root) => path.resolve(root));
  const visited = new Set<string>();
  while (pending.length > 0 && results.length < MAX_SYSTEM_FONT_FILES) {
    const current = pending.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    let entries: fs.Dirent[];
    try { entries = await fs.promises.readdir(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (entry.isFile() && SYSTEM_FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) results.push(fullPath);
      if (results.length >= MAX_SYSTEM_FONT_FILES) break;
    }
  }
  return results;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'font';
}

function groupFaces(parsed: readonly ParsedFace[], source: 'system' | 'imported', resolveCssUrl: (filePath: string) => string, importedId?: string): VsCodeFontFamily[] {
  const groups = new Map<string, ParsedFace[]>();
  for (const face of parsed) groups.set(face.family, [...(groups.get(face.family) ?? []), face]);
  return [...groups.entries()].map(([family, faces]) => ({
    id: source === 'imported' ? String(importedId) : `system:${family}`,
    family,
    source,
    cssFamily: source === 'imported' ? `MarkdownExplorer Imported ${String(importedId)}` : family,
    available: true,
    faces: faces.map(({ style, minWeight, maxWeight, variable, sourcePath }) => ({
      style, minWeight, maxWeight, variable,
      ...(source === 'imported' ? { cssUrl: resolveCssUrl(sourcePath) } : {}),
    })),
  }));
}

export function createVsCodeFontService({
  managedRoot,
  platform = process.platform,
  systemFontRoots = defaultSystemFontRoots(platform),
  resolveCssUrl,
}: VsCodeFontServiceOptions) {
  if (!managedRoot) throw new Error('managedRoot is required');

  async function inspectMany(paths: readonly string[]): Promise<ParsedFace[]> {
    const parsed: ParsedFace[] = [];
    for (const fontPath of paths) {
      try { parsed.push(...await inspectFontFile(fontPath)); } catch { /* ignore unreadable system fonts */ }
    }
    return parsed;
  }

  async function readImportedFamilies(): Promise<VsCodeFontFamily[]> {
    let dirs: fs.Dirent[];
    try { dirs = await fs.promises.readdir(managedRoot, { withFileTypes: true }); } catch { return []; }
    const families: VsCodeFontFamily[] = [];
    for (const dir of dirs) {
      if (!dir.isDirectory() || !/^font_[a-zA-Z0-9-]+$/.test(dir.name)) continue;
      const folder = path.join(managedRoot, dir.name);
      let names: string[];
      try { names = await fs.promises.readdir(folder); } catch { continue; }
      const paths = names
        .filter((name) => IMPORT_FONT_EXTENSIONS.has(path.extname(name).toLowerCase()))
        .map((name) => path.join(folder, name));
      families.push(...groupFaces(await inspectMany(paths), 'imported', resolveCssUrl, dir.name));
    }
    return families;
  }

  async function listFonts(): Promise<VsCodeFontFamily[]> {
    const systemPaths = await collectFontFiles(systemFontRoots);
    const systems = groupFaces(await inspectMany(systemPaths), 'system', resolveCssUrl);
    const imported = await readImportedFamilies();
    return [...systems, ...imported].sort((left, right) => left.family.localeCompare(right.family));
  }

  async function importFontFiles(paths: readonly string[]): Promise<VsCodeFontFamily> {
    if (paths.length === 0) throw new Error('Choose at least one .ttf or .otf font file.');
    if (paths.some((filePath) => !IMPORT_FONT_EXTENSIONS.has(path.extname(filePath).toLowerCase()))) throw new Error('Only .ttf and .otf font files can be imported.');
    const parsed: ParsedFace[] = [];
    for (const filePath of paths) parsed.push(...await inspectFontFile(filePath));
    if (new Set(parsed.map((face) => face.family)).size !== 1) throw new Error('Imported font files must belong to one font family.');

    const id = `font_${crypto.randomUUID()}`;
    const targetDir = path.join(managedRoot, id);
    await fs.promises.mkdir(targetDir, { recursive: true });
    try {
      const copiedPaths: string[] = [];
      for (let index = 0; index < paths.length; index += 1) {
        const original = paths[index];
        const target = path.join(targetDir, `${String(index + 1).padStart(2, '0')}-${safeSegment(path.basename(original))}`);
        await fs.promises.copyFile(original, target);
        copiedPaths.push(target);
      }
      const families = groupFaces(await inspectMany(copiedPaths), 'imported', resolveCssUrl, id);
      if (!families[0]) throw new Error('Imported font family could not be read.');
      return families[0];
    } catch (error) {
      await fs.promises.rm(targetDir, { recursive: true, force: true });
      throw error;
    }
  }

  async function removeImportedFont(id: string): Promise<void> {
    if (!/^font_[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid imported font id.');
    await fs.promises.rm(path.join(managedRoot, id), { recursive: true, force: true });
  }

  return { listFonts, importFontFiles, removeImportedFont };
}
