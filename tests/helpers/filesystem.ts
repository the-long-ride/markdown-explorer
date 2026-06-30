import { vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function createFilesystemMock(existingFiles?: Record<string, string>) {
  const files = new Map<string, string>(Object.entries(existingFiles ?? {}));
  const dirs = new Set<string>();

  for (const filePath of files.keys()) {
    let dir = path.dirname(filePath);
    while (dir !== path.dirname(dir)) {
      dirs.add(dir);
      dir = path.dirname(dir);
    }
  }

  const mockFs = {
    existsSync: vi.fn((p: string) => files.has(p) || dirs.has(p)),
    readFileSync: vi.fn((p: string, encoding?: string) => {
      if (encoding !== 'utf8' && encoding !== undefined) {
        throw new Error(`test mock: readFileSync only supports utf8 encoding`);
      }
      if (!files.has(p)) {
        const err = new Error(`ENOENT: no such file or directory, open '${p}'`);
        (err as any).code = 'ENOENT';
        throw err;
      }
      return files.get(p);
    }),
    writeFileSync: vi.fn((p: string, content: string) => {
      files.set(p, content);
      let dir = path.dirname(p);
      while (dir !== path.dirname(dir)) {
        dirs.add(dir);
        dir = path.dirname(dir);
      }
    }),
    mkdirSync: vi.fn((p: string, options?: any) => {
      dirs.add(p);
    }),
    statSync: vi.fn((p: string) => {
      if (!files.has(p) && !dirs.has(p)) {
        const err = new Error(`ENOENT: no such file or directory, stat '${p}'`);
        (err as any).code = 'ENOENT';
        throw err;
      }
      return {
        isFile: () => files.has(p),
        isDirectory: () => dirs.has(p),
        size: files.get(p)?.length ?? 0,
        mtime: new Date(),
      };
    }),
    readdirSync: vi.fn((p: string) => {
      const entries: string[] = [];
      for (const filePath of files.keys()) {
        const dir = path.dirname(filePath);
        if (dir === p) entries.push(path.basename(filePath));
      }
      for (const dirPath of dirs) {
        const dir = path.dirname(dirPath);
        if (dir === p && dirPath !== p) entries.push(path.basename(dirPath));
      }
      return entries;
    }),
    watch: vi.fn(() => ({ close: vi.fn() })),
    unlinkSync: vi.fn((p: string) => {
      files.delete(p);
    }),
    rmSync: vi.fn((p: string) => {
      files.delete(p);
      dirs.delete(p);
    }),
  };

  return { fs: mockFs, files, dirs };
}

export function createTempDir(prefix = 'test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeTempFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}
