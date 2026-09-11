// =============================================================================
// chrome/src/file-access.ts — File System Access API helper functions
// =============================================================================

const DB_NAME = 'markdown-explorer-db';
const STORE_NAME = 'workspaces';

export type FileWriteResult =
  | { ok: true; revision: string; reason?: never }
  | {
      ok: false;
      reason: 'permission-denied' | 'missing' | 'outside-workspace' | 'conflict' | 'write-failed' | 'io-error';
      diskSource?: string;
      diskRevision?: string;
      error?: string;
    };

export type BrowserDocumentWriteResult = FileWriteResult;

export type BrowserDocumentWriteCapability =
  | { supported: true; revision: string }
  | { supported: false; revision: string | null; reason: 'permission-required' | 'unsupported-document' | 'read-only-runtime' };

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'path' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveHandleToIDB(path: string, handle: FileSystemDirectoryHandle, name: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const item = { path, name, handle, lastOpened: Date.now() };
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadHandlesFromIDB(): Promise<Array<{ path: string; name: string; handle: FileSystemDirectoryHandle; lastOpened: number }>> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteHandleFromIDB(path: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(path);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function verifyPermission(handle: FileSystemHandle, withWrite = false): Promise<boolean> {
  const opts = { mode: withWrite ? 'readwrite' : 'read' } as any;
  if ((await (handle as any).queryPermission(opts)) === 'granted') return true;
  return (await (handle as any).requestPermission(opts)) === 'granted';
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  const win = window as any;
  if (typeof win.showDirectoryPicker !== 'function') {
    throw new Error('File System Access API is not supported in this browser.');
  }
  return await win.showDirectoryPicker();
}

export async function pickFile(): Promise<FileSystemFileHandle> {
  const win = window as any;
  if (typeof win.showOpenFilePicker !== 'function') {
    throw new Error('File System Access API is not supported in this browser.');
  }
  const [handle] = await win.showOpenFilePicker();
  return handle;
}

function safePathParts(relativePath: string): string[] | null {
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) return null;
  return parts;
}

/** Resolves a workspace-relative path to a file handle without allowing traversal segments. */
export async function resolveFileHandle(
  root: FileSystemDirectoryHandle,
  relativePath: string
): Promise<FileSystemFileHandle | null> {
  try {
    const parts = safePathParts(relativePath);
    if (!parts) return null;
    let currentDir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i]);
    }
    return await currentDir.getFileHandle(parts[parts.length - 1]);
  } catch {
    return null;
  }
}

/** Resolves a relative path to a directory handle, or null if not found. */
export async function readTextFile(root: FileSystemDirectoryHandle, relativePath: string): Promise<string> {
  const fileHandle = await resolveFileHandle(root, relativePath);
  if (!fileHandle) throw new Error(`File not found: ${relativePath}`);
  const file = await fileHandle.getFile();
  return await file.text();
}

export async function readBlobUrl(root: FileSystemDirectoryHandle, relativePath: string): Promise<string> {
  const fileHandle = await resolveFileHandle(root, relativePath);
  if (!fileHandle) throw new Error(`File not found: ${relativePath}`);
  const file = await fileHandle.getFile();
  return URL.createObjectURL(file);
}

export async function readBinaryFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<{ bytes: Uint8Array; type: string; size: number } | null> {
  const handle = await resolveFileHandle(root, relativePath);
  if (!handle) return null;
  const file = await handle.getFile();
  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    type: file.type || '',
    size: file.size,
  };
}

export async function documentRevision(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return `${file.lastModified}:${file.size}`;
}

async function writeResolvedFileHandle(
  handle: FileSystemFileHandle,
  source: string,
  expectedRevision: string | null,
  force: boolean,
): Promise<FileWriteResult> {
  try {
    const file = await handle.getFile();
    const currentRevision = `${file.lastModified}:${file.size}`;
    if (!force && (expectedRevision === null || currentRevision !== expectedRevision)) {
      return {
        ok: false,
        reason: 'conflict',
        diskSource: await file.text(),
        diskRevision: currentRevision,
      };
    }
    const writable = await (handle as any).createWritable();
    await writable.write(source);
    await writable.close();
    return { ok: true, revision: await documentRevision(handle) };
  } catch (error) {
    if ((error as DOMException | undefined)?.name === 'NotFoundError') {
      return { ok: false, reason: 'missing' };
    }
    return { ok: false, reason: 'write-failed', error: String((error as Error)?.message || error) };
  }
}

export async function writeFileHandle(
  handle: FileSystemFileHandle,
  source: string,
  expectedRevision: string | null,
  force = false,
): Promise<FileWriteResult> {
  if (!(await verifyPermission(handle, true))) {
    return { ok: false, reason: 'permission-denied' };
  }
  return writeResolvedFileHandle(handle, source, expectedRevision, force);
}

export async function writeTextFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  source: string,
  expectedRevision: string | null,
  force = false,
): Promise<FileWriteResult> {
  if (!safePathParts(relativePath)) return { ok: false, reason: 'outside-workspace' };
  if (!(await verifyPermission(root, true))) return { ok: false, reason: 'permission-denied' };
  const handle = await resolveFileHandle(root, relativePath);
  if (!handle) return { ok: false, reason: 'missing' };
  return writeResolvedFileHandle(handle, source, expectedRevision, force);
}

export async function documentWriteCapability(
  handle: FileSystemFileHandle | FileSystemDirectoryHandle,
  relativePath?: string,
): Promise<BrowserDocumentWriteCapability> {
  try {
    const fileHandle = relativePath
      ? await resolveFileHandle(handle as FileSystemDirectoryHandle, relativePath)
      : handle as FileSystemFileHandle;
    if (!fileHandle) return { supported: false, revision: null, reason: 'read-only-runtime' };
    const revision = await documentRevision(fileHandle);
    const permission = await (fileHandle as any).queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      return { supported: false, revision, reason: 'permission-required' };
    }
    return { supported: true, revision };
  } catch {
    return { supported: false, revision: null, reason: 'read-only-runtime' };
  }
}
