import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveHandleToIDB,
  loadHandlesFromIDB,
  deleteHandleFromIDB,
  resolveFileHandle,
  verifyPermission,
  pickDirectory,
  readTextFile,
  readBlobUrl,
} from '../../../chromium-xtension/src/file-access';

function makeSerializableHandle(name: string): Record<string, unknown> {
  return { kind: 'directory', name, isFakeHandle: true };
}

describe('saveHandleToIDB + loadHandlesFromIDB', () => {
  it('saves and loads a handle', async () => {
    const handle = makeSerializableHandle('test-project');
    await saveHandleToIDB('/my-project', handle as any, 'test-project');
    const loaded = await loadHandlesFromIDB();
    const match = loaded.find((h) => h.path === '/my-project');
    expect(match).toBeDefined();
    expect(match!.name).toBe('test-project');
    expect(typeof match!.lastOpened).toBe('number');
  });

  it('loads empty array when no handles saved', async () => {
    const loaded = await loadHandlesFromIDB();
    expect(Array.isArray(loaded)).toBe(true);
  });

  it('overwrites existing handle on same path', async () => {
    const handle1 = makeSerializableHandle('project-v1');
    const handle2 = makeSerializableHandle('project-v2');
    await saveHandleToIDB('/project-same', handle1 as any, 'project-v1');
    await saveHandleToIDB('/project-same', handle2 as any, 'project-v2');
    const loaded = await loadHandlesFromIDB();
    const matches = loaded.filter((h) => h.path === '/project-same');
    expect(matches).toHaveLength(1);
  });

  it('saves multiple handles for different paths', async () => {
    const h1 = makeSerializableHandle('a');
    const h2 = makeSerializableHandle('b');
    await saveHandleToIDB('/multi-p1', h1 as any, 'proj-a');
    await saveHandleToIDB('/multi-p2', h2 as any, 'proj-b');
    const loaded = await loadHandlesFromIDB();
    const paths = loaded.map((h) => h.path);
    expect(paths).toContain('/multi-p1');
    expect(paths).toContain('/multi-p2');
  });

  it('saves lastOpened as a number', async () => {
    const handle = makeSerializableHandle('timestamped');
    await saveHandleToIDB('/timestamped', handle as any, 'timestamped');
    const loaded = await loadHandlesFromIDB();
    const match = loaded.find((h) => h.path === '/timestamped');
    expect(match).toBeDefined();
    expect(Number.isFinite(match!.lastOpened)).toBe(true);
  });
});

describe('deleteHandleFromIDB', () => {
  it('deletes a saved handle', async () => {
    const handle = makeSerializableHandle('deletable');
    await saveHandleToIDB('/to-delete', handle as any, 'deletable');
    await deleteHandleFromIDB('/to-delete');
    const loaded = await loadHandlesFromIDB();
    expect(loaded.find((h) => h.path === '/to-delete')).toBeUndefined();
  });

  it('does not throw when deleting nonexistent path', async () => {
    await expect(deleteHandleFromIDB('/nonexistent')).resolves.toBeUndefined();
  });
});

describe('resolveFileHandle', () => {
  it('resolves a file in root directory', async () => {
    const root: any = {
      getFileHandle: async (name: string) => ({ kind: 'file', name, getFile: async () => ({ text: async () => 'content' }) }),
      getDirectoryHandle: async () => { throw new Error('not a dir'); },
    };
    const handle = await resolveFileHandle(root as any, 'readme.md');
    expect(handle).not.toBeNull();
  });

  it('returns null when getFileHandle throws', async () => {
    const root: any = {
      getFileHandle: async () => { throw new DOMException('Not found', 'NotFoundError'); },
      getDirectoryHandle: async () => { throw new DOMException('Not found', 'NotFoundError'); },
    };
    const handle = await resolveFileHandle(root as any, 'nonexistent.md');
    expect(handle).toBeNull();
  });

  it('resolves a file in subdirectory', async () => {
    const subDir: any = {
      getFileHandle: async (name: string) => ({ kind: 'file', name, getFile: async () => ({ text: async () => 'guide' }) }),
      getDirectoryHandle: async () => { throw new Error('not a dir'); },
    };
    const root: any = {
      getDirectoryHandle: async () => subDir,
      getFileHandle: async () => { throw new Error('not in root'); },
    };
    const handle = await resolveFileHandle(root as any, 'docs/guide.md');
    expect(handle).not.toBeNull();
  });

  it('returns null for empty path', async () => {
    const root: any = {
      getFileHandle: async (name: string) => {
        if (!name) throw new Error('empty');
        return { kind: 'file', name };
      },
      getDirectoryHandle: async () => { throw new Error('not found'); },
    };
    const handle = await resolveFileHandle(root as any, '');
    expect(handle).toBeNull();
  });
});

describe('verifyPermission', () => {
  it('returns true when queryPermission grants', async () => {
    const handle: any = { queryPermission: async () => 'granted' };
    const result = await verifyPermission(handle);
    expect(result).toBe(true);
  });

  it('returns true when requestPermission grants after query denies', async () => {
    const handle: any = {
      queryPermission: async () => 'prompt',
      requestPermission: async () => 'granted',
    };
    const result = await verifyPermission(handle);
    expect(result).toBe(true);
  });

  it('returns false when both permissions are denied', async () => {
    const handle: any = {
      queryPermission: async () => 'denied',
      requestPermission: async () => 'denied',
    };
    const result = await verifyPermission(handle);
    expect(result).toBe(false);
  });

  it('passes readwrite mode when withWrite=true', async () => {
    let capturedOpts: any;
    const handle: any = {
      queryPermission: async (opts: any) => {
        capturedOpts = opts;
        return 'granted';
      },
    };
    await verifyPermission(handle, true);
    expect(capturedOpts.mode).toBe('readwrite');
  });
});

describe('pickDirectory', () => {
  it('throws when showDirectoryPicker is unavailable', async () => {
    const original = (window as any).showDirectoryPicker;
    (window as any).showDirectoryPicker = undefined;
    await expect(pickDirectory()).rejects.toThrow('File System Access API is not supported');
    (window as any).showDirectoryPicker = original;
  });

  it('returns the selected directory handle', async () => {
    const original = (window as any).showDirectoryPicker;
    const mockHandle = { kind: 'directory', name: 'test' };
    (window as any).showDirectoryPicker = async () => mockHandle;
    const result = await pickDirectory();
    expect(result).toBe(mockHandle);
    (window as any).showDirectoryPicker = original;
  });
});

describe('readTextFile', () => {
  it('reads text from a resolved file', async () => {
    const root: any = {
      getFileHandle: async () => ({
        getFile: async () => ({ text: async () => 'hello world' }),
      }),
      getDirectoryHandle: async () => { throw new Error('not a dir'); },
    };
    const text = await readTextFile(root, 'readme.md');
    expect(text).toBe('hello world');
  });

  it('throws when file is not found', async () => {
    const root: any = {
      getFileHandle: async () => { throw new DOMException('Not found', 'NotFoundError'); },
    };
    await expect(readTextFile(root, 'missing.md')).rejects.toThrow('File not found');
  });
});

describe('readBlobUrl', () => {
  it('returns a blob URL from a resolved file', async () => {
    const root: any = {
      getFileHandle: async () => ({
        getFile: async () => new File(['content'], 'test.md', { type: 'text/plain' }),
      }),
      getDirectoryHandle: async () => { throw new Error('not a dir'); },
    };
    const url = await readBlobUrl(root, 'test.md');
    expect(typeof url).toBe('string');
    expect(url.startsWith('blob:')).toBe(true);
    URL.revokeObjectURL(url);
  });

  it('throws when file is not found', async () => {
    const root: any = {
      getFileHandle: async () => { throw new DOMException('Not found', 'NotFoundError'); },
    };
    await expect(readBlobUrl(root, 'missing.md')).rejects.toThrow('File not found');
  });
});
