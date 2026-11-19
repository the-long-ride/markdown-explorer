import type { DesktopFontFamily, DesktopFontStyle } from '../../ui/src/desktop/fonts/fontModel';

const DB_NAME = 'markdown-explorer-browser-fonts';
const DB_VERSION = 1;
const STORE_NAME = 'fonts';
const ACCEPTED_EXTENSIONS = new Set(['ttf', 'otf', 'woff', 'woff2']);

interface StoredBrowserFontFace {
  fileName: string;
  blob: Blob;
  style: DesktopFontStyle;
  weight: number;
}

interface StoredBrowserFontFamily {
  id: string;
  family: string;
  faces: StoredBrowserFontFace[];
}

const objectUrls = new Map<string, string>();

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match?.[1]?.toLowerCase() ?? '';
}

export function isSupportedBrowserFontFileName(fileName: string): boolean {
  return ACCEPTED_EXTENSIONS.has(extensionOf(fileName));
}

const WEIGHT_RULES: Array<[RegExp, number]> = [
  [/\b(?:thin|hairline)\b/i, 100],
  [/\b(?:extra[\s_-]?light|ultra[\s_-]?light)\b/i, 200],
  [/\blight\b/i, 300],
  [/\b(?:medium)\b/i, 500],
  [/\b(?:semi[\s_-]?bold|demi[\s_-]?bold)\b/i, 600],
  [/\b(?:extra[\s_-]?bold|ultra[\s_-]?bold)\b/i, 800],
  [/\b(?:black|heavy)\b/i, 900],
  [/\bbold\b/i, 700],
  [/\b(?:regular|normal|book)\b/i, 400],
];

export function inferBrowserFontDescriptor(fileName: string): { family: string; style: DesktopFontStyle; weight: number } {
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  const normalized = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const style: DesktopFontStyle = /\b(?:italic|oblique)\b/i.test(normalized) ? 'italic' : 'normal';
  const weight = WEIGHT_RULES.find(([pattern]) => pattern.test(normalized))?.[1] ?? 400;
  const family = normalized
    .replace(/\b(?:italic|oblique|thin|hairline|extra\s*light|ultra\s*light|light|regular|normal|book|medium|semi\s*bold|demi\s*bold|bold|extra\s*bold|ultra\s*bold|black|heavy|variable\s*font|variablefont|wght)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Imported Font';
  return { family, style, weight };
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed.')), { once: true });
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed.')), { once: true });
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw new Error('Browser font storage is unavailable in this browser.');
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.addEventListener('upgradeneeded', () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
  });
  return requestAsPromise(request);
}

async function readStoredFamilies(): Promise<StoredBrowserFontFamily[]> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll() as IDBRequest<StoredBrowserFontFamily[]>;
    const records = await requestAsPromise(request);
    await transactionDone(transaction);
    return records;
  } finally {
    db.close();
  }
}

async function writeStoredFamily(record: StoredBrowserFontFamily): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

async function deleteStoredFamily(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

function revokeFamilyUrls(id: string): void {
  for (const [key, url] of objectUrls) {
    if (!key.startsWith(`${id}:`)) continue;
    URL.revokeObjectURL(url);
    objectUrls.delete(key);
  }
}

function objectUrlFor(id: string, face: StoredBrowserFontFace): string {
  const key = `${id}:${face.style}:${face.weight}:${face.fileName}`;
  const existing = objectUrls.get(key);
  if (existing) return existing;
  const url = URL.createObjectURL(face.blob);
  objectUrls.set(key, url);
  return url;
}

function toDesktopFontFamily(record: StoredBrowserFontFamily): DesktopFontFamily {
  return {
    id: record.id,
    family: record.family,
    source: 'imported',
    cssFamily: `MarkdownExplorer Browser ${record.id}`,
    available: true,
    faces: record.faces.map((face) => ({
      style: face.style,
      minWeight: face.weight,
      maxWeight: face.weight,
      variable: false,
      cssUrl: objectUrlFor(record.id, face),
    })),
  };
}

export async function listBrowserFonts(): Promise<DesktopFontFamily[]> {
  const records = await readStoredFamilies();
  return records
    .sort((a, b) => a.family.localeCompare(b.family))
    .map(toDesktopFontFamily);
}

function makeImportedId(): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 18);
  return `font_browser_${Date.now().toString(36)}_${random}`;
}

async function validateBrowserFont(file: File, descriptor: ReturnType<typeof inferBrowserFontDescriptor>): Promise<void> {
  if (typeof FontFace === 'undefined') return;
  const url = URL.createObjectURL(file);
  const probe = new FontFace(`MarkdownExplorer Font Probe ${Date.now()}`, `url("${url}")`, {
    style: descriptor.style,
    weight: String(descriptor.weight),
  });
  try {
    const loaded = await probe.load();
    document.fonts?.add(loaded);
    document.fonts?.delete(loaded);
  } catch {
    throw new Error('The selected file could not be loaded as a font.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function importBrowserFontFile(file: File): Promise<{ fonts: DesktopFontFamily[]; importedId: string }> {
  if (!isSupportedBrowserFontFileName(file.name)) {
    throw new Error('Only .ttf, .otf, .woff, and .woff2 font files can be imported.');
  }

  const descriptor = inferBrowserFontDescriptor(file.name);
  await validateBrowserFont(file, descriptor);
  const records = await readStoredFamilies();
  const existing = records.find((record) => record.family.localeCompare(descriptor.family, undefined, { sensitivity: 'accent' }) === 0);
  const id = existing?.id ?? makeImportedId();
  const nextFace: StoredBrowserFontFace = {
    fileName: file.name,
    blob: file,
    style: descriptor.style,
    weight: descriptor.weight,
  };
  const faces = [...(existing?.faces ?? [])].filter((face) => !(face.style === nextFace.style && face.weight === nextFace.weight));
  faces.push(nextFace);
  await writeStoredFamily({ id, family: descriptor.family, faces });
  revokeFamilyUrls(id);
  return { fonts: await listBrowserFonts(), importedId: id };
}

async function pickBrowserFontFile(): Promise<File | null> {
  const picker = (window as unknown as {
    showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]>;
  }).showOpenFilePicker;

  if (typeof picker === 'function') {
    try {
      const handles = await picker({
        multiple: false,
        types: [{
          description: 'Font files',
          accept: {
            'font/ttf': ['.ttf'],
            'font/otf': ['.otf'],
            'font/woff': ['.woff'],
            'font/woff2': ['.woff2'],
          },
        }],
      });
      return handles[0] ? handles[0].getFile() : null;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null;
      throw error;
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';
    input.hidden = true;
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

export async function importBrowserFont(): Promise<{ fonts: DesktopFontFamily[]; importedId?: string }> {
  const file = await pickBrowserFontFile();
  if (!file) return { fonts: await listBrowserFonts() };
  return importBrowserFontFile(file);
}

export async function removeBrowserFont(id: string): Promise<DesktopFontFamily[]> {
  if (!/^font_browser_[a-zA-Z0-9_]+$/.test(id)) throw new Error('Invalid imported browser font id.');
  await deleteStoredFamily(id);
  revokeFamilyUrls(id);
  return listBrowserFonts();
}
