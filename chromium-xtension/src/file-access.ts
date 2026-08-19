// =============================================================================
// chrome/src/file-access.ts — File System Access API helper functions
// =============================================================================

const DB_NAME = 'markdown-explorer-db';
const STORE_NAME = 'workspaces';

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

export interface BrowserWorkspaceFileInfo {
  relativePath: string;
  size: number;
}

export async function listWorkspaceFiles(root: FileSystemDirectoryHandle): Promise<BrowserWorkspaceFileInfo[]> {
  const resources: BrowserWorkspaceFileInfo[] = [];
  const visit = async (directory: FileSystemDirectoryHandle, prefix: string) => {
    for await (const handle of (directory as any).values() as AsyncIterable<FileSystemHandle>) {
      if (handle.name === '.git') continue;
      const relativePath = prefix ? `${prefix}/${handle.name}` : handle.name;
      if (handle.kind === 'directory') {
        await visit(handle as FileSystemDirectoryHandle, relativePath);
        continue;
      }
      if (handle.kind !== 'file') continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      resources.push({ relativePath, size: file.size });
    }
  };
  await visit(root, '');
  resources.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return resources;
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
