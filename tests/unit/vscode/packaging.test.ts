import { createRequire } from 'node:module';
import path from 'node:path';
import { expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { bundleExtension } = require('../../../vscode/scripts/bundle-extension.js');
const { main: copyUi } = require('../../../vscode/scripts/copy-ui.js');
const { extensionRoot, verifyPackageRuntime, verifyCompiledActivation } = require('../../../vscode/scripts/verify-package-runtime.js');

test('bundles the compiled host without embedding runtime-only dependencies', async () => {
  const inputFile = path.join(extensionRoot, 'out', 'vscode', 'src', 'extension.js');
  const outputFile = path.join(extensionRoot, 'out', 'vscode', 'src', 'core', 'extension.bundle.js');
  const fsImpl = { existsSync: vi.fn(() => false) };
  const esbuildImpl = { build: vi.fn(async () => {}) };
  const logger = { log: vi.fn() };
  await expect(bundleExtension({ fsImpl, esbuildImpl, logger })).rejects.toThrow(inputFile);
  expect(esbuildImpl.build).not.toHaveBeenCalled();

  fsImpl.existsSync.mockReturnValue(true);
  await expect(bundleExtension({ fsImpl, esbuildImpl, logger })).resolves.toBe(outputFile);
  expect(esbuildImpl.build).toHaveBeenCalledWith(expect.objectContaining({
    entryPoints: [inputFile], outfile: outputFile, bundle: true, platform: 'node', format: 'cjs',
    external: ['vscode', '@the-long-ride/markdown-them', 'yaml'],
  }));
});

test('copies built assets and prunes only VS Code-excluded artifacts', () => {
  const root = path.dirname(extensionRoot);
  const uiDist = path.join(root, 'ui', 'dist');
  const uiAssets = path.join(root, 'ui', 'assets');
  const dist = path.join(extensionRoot, 'ui', 'dist');
  const assets = path.join(extensionRoot, 'ui', 'assets');
  const relativeAssets = path.join('dist', 'assets');
  const generatedHost = path.join(extensionRoot, 'out', 'vscode', 'src', 'core', 'panelInsights.js');
  const entry = (name: string, directory = false) => ({ name, isDirectory: () => directory });
  const entries = new Map([
    [uiDist, [entry('index.html'), entry('assets', true)]],
    [path.join(uiDist, 'assets'), [entry('app.js'), entry('insights.worker-test.js')]],
    [uiAssets, [entry('app.svg'), entry('font.ttf')]],
    [path.join(dist, 'assets'), [entry('app.js'), entry('insights.worker-test.js')]],
  ]);
  const existing = new Set([...entries.keys(), generatedHost, dist]);
  const fsImpl = {
    existsSync: (file: string) => existing.has(file),
    mkdirSync: vi.fn((file: string) => { existing.add(file); }),
    readdirSync: (file: string) => entries.get(file) ?? [],
    copyFileSync: vi.fn(),
    rmSync: vi.fn((file: string) => { existing.delete(file); }),
  };
  vi.spyOn(console, 'log').mockImplementation(() => {});

  copyUi(fsImpl);

  expect(fsImpl.rmSync.mock.calls.map(([file]) => file)).toEqual([
    dist, generatedHost, path.join(extensionRoot, 'ui', relativeAssets, 'insights.worker-test.js'),
  ]);
  expect(fsImpl.mkdirSync.mock.calls.map(([file]) => file)).toEqual([dist, assets]);
  expect(fsImpl.copyFileSync.mock.calls.map(([, destination]) => destination)).toEqual([
    path.join(dist, 'index.html'), path.join(dist, 'assets', 'app.js'),
    path.join(dist, 'assets', 'insights.worker-test.js'), path.join(assets, 'app.svg'),
  ]);
});

test('exits unsuccessfully when copying package assets fails', () => {
  const error = new Error('destination unavailable');
  const report = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw error; });
  expect(() => copyUi({
    existsSync: () => true,
    rmSync: () => { throw error; },
  })).toThrow(error);
  expect(report).toHaveBeenCalledWith('Failed to copy UI artifacts:', error);
  expect(exit).toHaveBeenCalledWith(1);
});

test('checks the bundled entry, vendored dependencies and webview entry together', () => {
  const files = [
    path.join(extensionRoot, 'out', 'vscode', 'src', 'core', 'extension.bundle.js'),
    path.join(extensionRoot, 'out', 'vscode', 'src', 'vendor', 'markdown-them.cjs'),
    path.join(extensionRoot, 'out', 'node_modules', 'yaml', 'index.js'),
    path.join(extensionRoot, 'ui', 'dist', 'index.html'),
  ];
  const logger = { log: vi.fn(), error: vi.fn() };
  const existsSync = vi.fn((file: string) => files.includes(file));
  expect(verifyPackageRuntime({ fsImpl: { existsSync }, logger })).toEqual({ ok: true, missingFiles: [] });
  expect(existsSync.mock.calls.flat()).toEqual(files);

  existsSync.mockImplementation((file) => file === files[0]);
  expect(verifyPackageRuntime({ fsImpl: { existsSync }, logger }).missingFiles).toEqual(
    files.slice(1).map((file) => path.relative(extensionRoot, file)),
  );
});

test('loads the manifest and accepts a compiled host with all contributed commands', () => {
  const manifest = require('../../../vscode/package.json');
  const requireImpl = vi.fn(() => ({
    _doActivate(context: any, vscode: any) {
      expect(vscode.window.activeTextEditor).toBeUndefined();
      expect(vscode.workspace.getConfiguration().get('preview')).toBe(false);
      vscode.workspace.onDidSaveTextDocument().dispose();
      const watcher = vscode.workspace.createFileSystemWatcher();
      watcher.onDidCreate();
      watcher.onDidChange();
      watcher.onDidDelete();
      watcher.dispose();
      for (const { command } of manifest.contributes.commands) {
        const registration = vscode.commands.registerCommand(command, () => {});
        context.subscriptions.push(registration);
        registration.dispose();
      }
    },
  }));
  expect(verifyCompiledActivation({ requireImpl, logger: { log: vi.fn() } }))
    .toEqual({ ok: true, missingCommands: [] });
  expect(requireImpl.mock.calls.flat()).toEqual([
    path.resolve(extensionRoot, manifest.main),
    path.resolve(extensionRoot, 'out/vscode/src/core/panel.js'),
  ]);
});

test.each([
  [{}, 'does not export _doActivate'],
  [{ _doActivate() { throw 'activation failed'; } }, 'activation failed'],
  [{ _doActivate() {} }, 'did not register contributed commands'],
])('reports the commands missing when compiled activation fails: %s', (extension, errorMessage) => {
  const error = vi.fn();
  expect(verifyCompiledActivation({
    manifest: { main: './entry.js', contributes: { commands: [{ command: 'markdownExplorer.open' }] } },
    requireImpl: () => extension,
    logger: { error },
  })).toMatchObject({ ok: false, missingCommands: ['markdownExplorer.open'] });
  expect(error).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
});
