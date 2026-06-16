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
    const item = {
      path,
      name,
      handle,
      lastOpened: Date.now()
    };
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
  if ((await (handle as any).queryPermission(opts)) === 'granted') {
    return true;
  }
  if ((await (handle as any).requestPermission(opts)) === 'granted') {
    return true;
  }
  return false;
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  const win = window as any;
  if (typeof win.showDirectoryPicker !== 'function') {
    throw new Error('File System Access API is not supported in this browser.');
  }
  return await win.showDirectoryPicker();
}

/**
 * Resolves a relative path (forward-slash delimited) against a root directory handle.
 * Returns the file handle, or null if not found or if it is a directory.
 */
export async function resolveFileHandle(
  root: FileSystemDirectoryHandle,
  relativePath: string
): Promise<FileSystemFileHandle | null> {
  try {
    const parts = relativePath.split('/').filter(Boolean);
    let currentDir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i]);
    }
    return await currentDir.getFileHandle(parts[parts.length - 1]);
  } catch (err) {
    return null;
  }
}

/**
 * Resolves a relative path to a directory handle, or null if not found.
 */
export async function resolveDirectoryHandle(
  root: FileSystemDirectoryHandle,
  relativePath: string
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const parts = relativePath.split('/').filter(Boolean);
    let currentDir = root;
    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part);
    }
    return currentDir;
  } catch (err) {
    return null;
  }
}

export async function readTextFile(root: FileSystemDirectoryHandle, relativePath: string): Promise<string> {
  const fileHandle = await resolveFileHandle(root, relativePath);
  if (!fileHandle) {
    throw new Error(`File not found: ${relativePath}`);
  }
  const file = await fileHandle.getFile();
  return await file.text();
}

export async function readBlobUrl(root: FileSystemDirectoryHandle, relativePath: string): Promise<string> {
  const fileHandle = await resolveFileHandle(root, relativePath);
  if (!fileHandle) {
    throw new Error(`File not found: ${relativePath}`);
  }
  const file = await fileHandle.getFile();
  return URL.createObjectURL(file);
}
