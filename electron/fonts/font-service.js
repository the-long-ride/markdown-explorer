const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL: defaultPathToFileURL } = require('url');

const IMPORT_FONT_EXTENSIONS = new Set(['.ttf', '.otf']);
const SYSTEM_FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc', '.otc']);
const MAX_SYSTEM_FONT_FILES = 6000;

function u16(buffer, offset) {
  return offset >= 0 && offset + 2 <= buffer.length ? buffer.readUInt16BE(offset) : 0;
}

function i16(buffer, offset) {
  return offset >= 0 && offset + 2 <= buffer.length ? buffer.readInt16BE(offset) : 0;
}

function u32(buffer, offset) {
  return offset >= 0 && offset + 4 <= buffer.length ? buffer.readUInt32BE(offset) : 0;
}

function fixed16_16(buffer, offset) {
  return u32(buffer, offset) / 65536;
}

function signedFixed16_16(buffer, offset) {
  return offset >= 0 && offset + 4 <= buffer.length ? buffer.readInt32BE(offset) / 65536 : 0;
}

function tag(buffer, offset) {
  return offset >= 0 && offset + 4 <= buffer.length ? buffer.toString('ascii', offset, offset + 4) : '';
}

function tableMap(buffer, faceOffset = 0) {
  const count = u16(buffer, faceOffset + 4);
  const tables = new Map();
  for (let index = 0; index < count; index += 1) {
    const record = faceOffset + 12 + index * 16;
    const tableTag = tag(buffer, record);
    const offset = u32(buffer, record + 8);
    const length = u32(buffer, record + 12);
    if (tableTag && offset + length <= buffer.length) tables.set(tableTag, { offset, length });
  }
  return tables;
}

function decodeName(buffer, record, storageOffset) {
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
    for (let i = 0; i < slice.length; i += 2) value += String.fromCharCode(slice.readUInt16BE(i));
    return value.replace(/\0/g, '').trim();
  }
  if (platformId === 1 || encodingId === 0) return slice.toString('latin1').replace(/\0/g, '').trim();
  return slice.toString('utf8').replace(/\0/g, '').trim();
}

function readNames(buffer, table) {
  if (!table) return { family: '', subfamily: '' };
  const count = u16(buffer, table.offset + 2);
  const storageOffset = table.offset + u16(buffer, table.offset + 4);
  const candidates = { family: [], typographicFamily: [], subfamily: [], typographicSubfamily: [] };
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
      : null;
    if (target) target.push({ value, score });
  }
  const pick = (items) => items.sort((a, b) => b.score - a.score)[0]?.value || '';
  return {
    family: pick(candidates.typographicFamily) || pick(candidates.family),
    subfamily: pick(candidates.typographicSubfamily) || pick(candidates.subfamily),
  };
}

function inspectFace(buffer, faceOffset = 0, sourcePath = '') {
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

  return {
    family: names.family,
    style: italic ? 'italic' : 'normal',
    minWeight,
    maxWeight,
    variable,
    supportsItalicAxis,
    sourcePath,
  };
}

function expandItalicAxis(face) {
  if (!face.supportsItalicAxis) return [face];
  return [
    { ...face, style: 'normal' },
    { ...face, style: 'italic' },
  ];
}

function inspectFontBuffer(buffer, sourcePath = '') {
  const rawFaces = [];
  if (tag(buffer, 0) === 'ttcf') {
    const count = u32(buffer, 8);
    for (let index = 0; index < count; index += 1) {
      rawFaces.push(inspectFace(buffer, u32(buffer, 12 + index * 4), sourcePath));
    }
  } else {
    rawFaces.push(inspectFace(buffer, 0, sourcePath));
  }
  return rawFaces.flatMap(expandItalicAxis);
}

async function inspectFontFile(filePath) {
  if (!SYSTEM_FONT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) throw new Error('Unsupported font file type');
  return inspectFontBuffer(await fs.promises.readFile(filePath), filePath);
}

function defaultSystemFontRoots(platform = process.platform) {
  if (platform === 'win32') {
    const windir = process.env.WINDIR || 'C:\\Windows';
    const localAppData = process.env.LOCALAPPDATA
      || path.win32.join(process.env.USERPROFILE || os.homedir(), 'AppData', 'Local');
    return [
      path.win32.join(windir, 'Fonts'),
      path.win32.join(localAppData, 'Microsoft', 'Windows', 'Fonts'),
    ];
  }
  if (platform === 'darwin') return [
    '/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library/Fonts'),
  ];
  return [
    '/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts'), path.join(os.homedir(), '.local/share/fonts'),
  ];
}

async function collectFontFiles(roots) {
  const results = [];
  const pending = roots.map((root) => path.resolve(root));
  const visited = new Set();
  while (pending.length && results.length < MAX_SYSTEM_FONT_FILES) {
    const current = pending.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    let entries;
    try { entries = await fs.promises.readdir(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.isFile() && SYSTEM_FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) results.push(full);
      if (results.length >= MAX_SYSTEM_FONT_FILES) break;
    }
  }
  return results;
}

function safeSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'font';
}

function groupFaces(parsed, source, pathToFileURL, importedId) {
  const groups = new Map();
  for (const face of parsed) {
    const key = face.family;
    const group = groups.get(key) || [];
    group.push(face);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([family, faces]) => ({
    id: source === 'imported' ? importedId : `system:${family}`,
    family,
    source,
    cssFamily: source === 'imported' ? `MarkdownExplorer Imported ${importedId}` : family,
    available: true,
    faces: faces.map(({ style, minWeight, maxWeight, variable, sourcePath }) => ({
      style,
      minWeight,
      maxWeight,
      variable,
      ...(source === 'imported' ? { cssUrl: pathToFileURL(sourcePath).href } : {}),
    })),
  }));
}

function createFontService({
  appDataDir,
  platform = process.platform,
  systemFontRoots = defaultSystemFontRoots(platform),
  pathToFileURL = defaultPathToFileURL,
} = {}) {
  if (!appDataDir) throw new Error('appDataDir is required');
  const managedRoot = path.join(appDataDir, 'fonts');

  async function inspectMany(paths) {
    const parsed = [];
    for (const fontPath of paths) {
      try { parsed.push(...await inspectFontFile(fontPath)); } catch { /* ignore unreadable system fonts */ }
    }
    return parsed;
  }

  async function readImportedFamilies() {
    let dirs;
    try { dirs = await fs.promises.readdir(managedRoot, { withFileTypes: true }); } catch { return []; }
    const families = [];
    for (const dir of dirs) {
      if (!dir.isDirectory() || !/^font_[a-zA-Z0-9-]+$/.test(dir.name)) continue;
      const folder = path.join(managedRoot, dir.name);
      let names;
      try { names = await fs.promises.readdir(folder); } catch { continue; }
      const paths = names.filter((name) => IMPORT_FONT_EXTENSIONS.has(path.extname(name).toLowerCase())).map((name) => path.join(folder, name));
      const parsed = await inspectMany(paths);
      const grouped = groupFaces(parsed, 'imported', pathToFileURL, dir.name);
      families.push(...grouped);
    }
    return families;
  }

  async function listFonts() {
    const systemPaths = await collectFontFiles(systemFontRoots);
    const systemParsed = await inspectMany(systemPaths);
    const systems = groupFaces(systemParsed, 'system', pathToFileURL);
    const imported = await readImportedFamilies();
    return [...systems, ...imported].sort((a, b) => a.family.localeCompare(b.family));
  }

  async function importFontFiles(paths) {
    if (!Array.isArray(paths) || paths.length === 0) throw new Error('Choose at least one .ttf or .otf font file.');
    if (paths.some((filePath) => !IMPORT_FONT_EXTENSIONS.has(path.extname(filePath).toLowerCase()))) {
      throw new Error('Only .ttf and .otf font files can be imported.');
    }
    const parsed = [];
    for (const filePath of paths) parsed.push(...await inspectFontFile(filePath));
    const families = new Set(parsed.map((face) => face.family));
    if (families.size !== 1) throw new Error('Imported font files must belong to one font family.');

    const id = `font_${crypto.randomUUID()}`;
    const targetDir = path.join(managedRoot, id);
    await fs.promises.mkdir(targetDir, { recursive: true });
    try {
      const copiedPaths = [];
      for (let index = 0; index < paths.length; index += 1) {
        const original = paths[index];
        const target = path.join(targetDir, `${String(index + 1).padStart(2, '0')}-${safeSegment(path.basename(original))}`);
        await fs.promises.copyFile(original, target);
        copiedPaths.push(target);
      }
      const copiedParsed = [];
      for (const filePath of copiedPaths) copiedParsed.push(...await inspectFontFile(filePath));
      const family = groupFaces(copiedParsed, 'imported', pathToFileURL, id)[0];
      return family;
    } catch (error) {
      await fs.promises.rm(targetDir, { recursive: true, force: true });
      throw error;
    }
  }

  async function removeImportedFont(id) {
    if (!/^font_[a-zA-Z0-9-]+$/.test(String(id || ''))) throw new Error('Invalid imported font id.');
    await fs.promises.rm(path.join(managedRoot, id), { recursive: true, force: true });
  }

  return { listFonts, importFontFiles, removeImportedFont };
}

module.exports = {
  inspectFontBuffer,
  inspectFontFile,
  defaultSystemFontRoots,
  createFontService,
};
