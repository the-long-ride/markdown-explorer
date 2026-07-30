import { createRequire } from 'node:module';
import { describe, expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { findMissingRuntimeFiles, verifyPackageRuntime } = require('../../../vscode/scripts/verify-package-runtime.js');

const { bundleMarkdownThem } = require('../../../vscode/scripts/bundle-markdown-them.js');

describe('VS Code runtime packaging scripts', () => {
  test('reports every missing runtime artifact without terminating the test process', () => {
    const fsImpl = { existsSync: vi.fn((file: string) => file.endsWith('extension.js')) };
    const requiredFiles = ['extension.js', 'vendor/markdown-them.cjs', 'ui/index.html'];
    expect(findMissingRuntimeFiles({ fsImpl, root: '/extension', requiredFiles })).toEqual([
      'vendor/markdown-them.cjs', 'ui/index.html',
    ]);
    const logger = { log: vi.fn(), error: vi.fn() };
    const result = verifyPackageRuntime({ fsImpl, root: '/extension', requiredFiles, logger });
    expect(result).toEqual({ ok: false, missingFiles: ['vendor/markdown-them.cjs', 'ui/index.html'] });
    expect(logger.error).toHaveBeenCalledTimes(3);
  });

  test('accepts a complete runtime package', () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const result = verifyPackageRuntime({
      fsImpl: { existsSync: vi.fn(() => true) }, root: '/extension', requiredFiles: ['a', 'b'], logger,
    });
    expect(result).toEqual({ ok: true, missingFiles: [] });
    expect(logger.log).toHaveBeenCalledWith('Verified 2 VSIX runtime files.');
  });

  test('bundles markdown-them to the requested runtime path', async () => {
    const fsImpl = { mkdirSync: vi.fn() };
    const esbuildImpl = { build: vi.fn(async () => undefined) };
    const logger = { log: vi.fn() };
    const result = await bundleMarkdownThem({
      fsImpl, esbuildImpl, root: '/repo', outputDirectory: '/repo/out/vendor',
      outputFile: '/repo/out/vendor/markdown-them.cjs', logger,
    });
    expect(fsImpl.mkdirSync).toHaveBeenCalledWith('/repo/out/vendor', { recursive: true });
    expect(esbuildImpl.build).toHaveBeenCalledWith(expect.objectContaining({
      outfile: '/repo/out/vendor/markdown-them.cjs', bundle: true, platform: 'node', format: 'cjs',
    }));
    expect(result).toBe('/repo/out/vendor/markdown-them.cjs');
    expect(logger.log).toHaveBeenCalledWith('Bundled markdown-them runtime to out/vendor/markdown-them.cjs');
  });
});
