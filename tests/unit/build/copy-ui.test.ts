import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { copyDirRecursive, main } = require('../../../vscode/scripts/copy-ui.js');

const rootDir = path.resolve(__dirname, '..', '..', '..');
const uiDistSrc = path.join(rootDir, 'ui', 'dist');
const uiAssetsSrc = path.join(rootDir, 'ui', 'assets');
const vscodeUiDistDest = path.join(rootDir, 'vscode', 'ui', 'dist');
const vscodeUiAssetsDest = path.join(rootDir, 'vscode', 'ui', 'assets');

function makeFileEntry(name: string) {
  return { name, isDirectory: () => false, isFile: () => true };
}

function makeDirEntry(name: string) {
  return { name, isDirectory: () => true, isFile: () => false };
}

function makeMockFs(overrides: Record<string, any> = {}) {
  const log = {
    exists: [] as string[][],
    readdir: [] as string[][],
    mkdir: [] as string[][],
    copyFile: [] as string[][],
    rm: [] as string[][],
  };
  const fss = {
    existsSync: overrides.existsSync ?? ((p: string) => { log.exists.push([p]); return true; }),
    readdirSync: overrides.readdirSync ?? ((dir: string, opts: any) => { log.readdir.push([dir]); return []; }),
    mkdirSync: overrides.mkdirSync ?? ((dir: string, opts: any) => { log.mkdir.push([dir, JSON.stringify(opts)]); }),
    copyFileSync: overrides.copyFileSync ?? ((src: string, dest: string) => { log.copyFile.push([src, dest]); }),
    rmSync: overrides.rmSync ?? ((dir: string, opts: any) => { log.rm.push([dir, JSON.stringify(opts)]); }),
  };
  return { fss, log };
}

describe('copyDirRecursive', () => {
  test('returns early when source does not exist', () => {
    const { fss, log } = makeMockFs({ existsSync: () => false });
    copyDirRecursive('/fake/src', '/fake/dest', fss);
    expect(log.readdir).toHaveLength(0);
    expect(log.copyFile).toHaveLength(0);
  });

  test('copies files and creates dest directory', () => {
    const src = path.join(rootDir, 'testsrc');
    const dest = path.join(rootDir, 'testdest');
    const indexHtml = makeFileEntry('index.html');
    const bundleJs = makeFileEntry('bundle.js');
    const { fss, log } = makeMockFs({
      readdirSync: (dir: string) => {
        if (dir === src) return [indexHtml, bundleJs];
        return [];
      },
      existsSync: (p: string) => p === src,
    });
    copyDirRecursive(src, dest, fss);
    expect(log.copyFile).toContainEqual([path.join(src, 'index.html'), path.join(dest, 'index.html')]);
    expect(log.copyFile).toContainEqual([path.join(src, 'bundle.js'), path.join(dest, 'bundle.js')]);
    expect(log.mkdir).toContainEqual([dest, JSON.stringify({ recursive: true })]);
  });

  test('skips .ttf files', () => {
    const src = path.join(rootDir, 'testsrc');
    const dest = path.join(rootDir, 'testdest');
    const ttfFile = makeFileEntry('font.ttf');
    const cssFile = makeFileEntry('style.css');
    const { fss, log } = makeMockFs({
      readdirSync: (dir: string) => {
        if (dir === src) return [ttfFile, cssFile];
        return [];
      },
      existsSync: (p: string) => p === src,
    });
    copyDirRecursive(src, dest, fss);
    expect(log.copyFile).toHaveLength(1);
    expect(log.copyFile).toContainEqual([path.join(src, 'style.css'), path.join(dest, 'style.css')]);
  });

  test('recursively copies subdirectories', () => {
    const src = path.join(rootDir, 'testsrc');
    const dest = path.join(rootDir, 'testdest');
    const subDir = makeDirEntry('sub');
    const nestedFile = makeFileEntry('deep.txt');
    const { fss, log } = makeMockFs({
      readdirSync: (dir: string) => {
        if (dir === src) return [subDir];
        if (dir === path.join(src, 'sub')) return [nestedFile];
        return [];
      },
      existsSync: (p: string) => p === src || p === path.join(src, 'sub'),
    });
    copyDirRecursive(src, dest, fss);
    expect(log.copyFile).toContainEqual([path.join(src, 'sub', 'deep.txt'), path.join(dest, 'sub', 'deep.txt')]);
  });

  test('skips mkdirSync when dest directory already exists', () => {
    const src = path.join(rootDir, 'testsrc');
    const dest = path.join(rootDir, 'testdest');
    const indexHtml = makeFileEntry('index.html');
    const { fss, log } = makeMockFs({
      readdirSync: (dir: string) => {
        if (dir === src) return [indexHtml];
        return [];
      },
      existsSync: () => true,
    });
    copyDirRecursive(src, dest, fss);
    expect(log.mkdir).toHaveLength(0);
    expect(log.copyFile).toContainEqual([path.join(src, 'index.html'), path.join(dest, 'index.html')]);
  });

  test('empty source directory has no files to copy', () => {
    const src = path.join(rootDir, 'testsrc');
    const dest = path.join(rootDir, 'testdest');
    const { fss, log } = makeMockFs({ existsSync: () => true, readdirSync: () => [] });
    copyDirRecursive(src, dest, fss);
    expect(log.copyFile).toHaveLength(0);
    expect(log.mkdir).toHaveLength(0);
  });
});

describe('main', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('removes existing dest directories before copying', () => {
    const { fss, log } = makeMockFs({ existsSync: () => true, readdirSync: () => [] });
    main(fss);
    expect(log.rm).toContainEqual([vscodeUiDistDest, JSON.stringify({ recursive: true, force: true })]);
    expect(log.rm).toContainEqual([vscodeUiAssetsDest, JSON.stringify({ recursive: true, force: true })]);
  });

  test('skips rmSync when dest directories do not exist', () => {
    const { fss, log } = makeMockFs({ existsSync: () => false, readdirSync: () => [] });
    main(fss);
    expect(log.rm).toHaveLength(0);
  });

  test('calls process.exit(1) on error', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const { fss } = makeMockFs({
      existsSync: () => true,
      rmSync: () => { throw new Error('rm failed'); },
    });
    main(fss);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('copies files from ui/dist and ui/assets', () => {
    const indexHtml = makeFileEntry('index.html');
    const { fss, log } = makeMockFs({
      existsSync: (p: string) => !p.includes('vscode'),
      readdirSync: (dir: string) => {
        if (dir === uiDistSrc) return [indexHtml];
        if (dir === uiAssetsSrc) return [];
        return [];
      },
    });
    main(fss);
    expect(log.copyFile.length).toBeGreaterThanOrEqual(1);
    expect(log.rm).toHaveLength(0);
  });
});
