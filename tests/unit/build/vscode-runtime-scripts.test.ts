import { createRequire } from 'node:module';
import { describe, expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { findMissingRuntimeFiles, verifyPackageRuntime, verifyCompiledActivation } = require('../../../vscode/scripts/verify-package-runtime.js');

const { bundleMarkdownThem, bundleYaml } = require('../../../vscode/scripts/bundle-markdown-them.js');

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

  test('accepts a compiled extension that registers every contributed command', () => {
    const registeredCommands: string[] = [];
    const extension = {
      _doActivate(context: any, vscode: any) {
        for (const command of ['markdownExplorer.open', 'markdownExplorer.openFile']) {
          context.subscriptions.push(vscode.commands.registerCommand(command, () => {}));
        }
      },
    };
    const logger = { log: vi.fn(), error: vi.fn() };
    const result = verifyCompiledActivation({
      root: '/extension',
      requireImpl: vi.fn(() => extension),
      manifest: {
        main: './out/vscode/src/extension.js',
        contributes: { commands: [{ command: 'markdownExplorer.open' }, { command: 'markdownExplorer.openFile' }] },
      },
      registerCommand: (command: string) => {
        registeredCommands.push(command);
        return { dispose: vi.fn() };
      },
      logger,
    });

    expect(result).toEqual({ ok: true, missingCommands: [] });
    expect(registeredCommands).toEqual(['markdownExplorer.open', 'markdownExplorer.openFile']);
    expect(logger.log).toHaveBeenCalledWith('Verified compiled extension activation for 2 commands.');
  });

  test('rejects a compiled extension that omits a contributed command', () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const result = verifyCompiledActivation({
      root: '/extension',
      requireImpl: vi.fn(() => ({ _doActivate() {} })),
      manifest: {
        main: './out/vscode/src/extension.js',
        contributes: { commands: [{ command: 'markdownExplorer.open' }] },
      },
      logger,
    });

    expect(result.ok).toBe(false);
    expect(result.missingCommands).toEqual(['markdownExplorer.open']);
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

  test('bundles yaml to a package-local node_modules resolution path', async () => {
    const fsImpl = { mkdirSync: vi.fn() };
    const esbuildImpl = { build: vi.fn(async () => undefined) };
    const logger = { log: vi.fn() };
    const result = await bundleYaml({
      fsImpl, esbuildImpl, root: '/repo', outputDirectory: '/repo/out/node_modules/yaml',
      outputFile: '/repo/out/node_modules/yaml/index.js', logger,
    });

    expect(fsImpl.mkdirSync).toHaveBeenCalledWith('/repo/out/node_modules/yaml', { recursive: true });
    expect(esbuildImpl.build).toHaveBeenCalledWith(expect.objectContaining({
      outfile: '/repo/out/node_modules/yaml/index.js', bundle: true, platform: 'node', format: 'cjs',
    }));
    expect(result).toBe('/repo/out/node_modules/yaml/index.js');
    expect(logger.log).toHaveBeenCalledWith('Bundled yaml runtime to out/node_modules/yaml/index.js');
  });

  test('rejects a compiled extension when the panel runtime cannot load', () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const result = verifyCompiledActivation({
      root: '/extension',
      requireImpl: vi.fn((file: string) => {
        if (file.replaceAll('\\', '/').endsWith('core/panel.js')) throw new Error("Cannot find module 'yaml'");
        return { _doActivate() {} };
      }),
      manifest: {
        main: './out/vscode/src/extension.js',
        contributes: { commands: [] },
      },
      logger,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual(expect.any(Error));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Cannot find module 'yaml'"));
  });
});
