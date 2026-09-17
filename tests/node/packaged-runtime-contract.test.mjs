import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { findMissingRuntimeFiles, requiredRuntimeFiles, verifyPackageRuntime } = require('../../vscode/scripts/verify-package-runtime.js');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('VSIX explicitly includes compiled extension runtime output', () => {
  const vscodeIgnore = read('vscode/.vscodeignore');
  assert.match(vscodeIgnore, /^!out\/$/m);
  assert.match(vscodeIgnore, /^!out\/\*\*$/m);
  assert.match(vscodeIgnore, /^!ui\/$/m);
  assert.match(vscodeIgnore, /^!ui\/dist\/$/m);
  assert.match(vscodeIgnore, /^!ui\/dist\/\*\*$/m);
  assert.match(vscodeIgnore, /^!ui\/assets\/$/m);
  assert.match(vscodeIgnore, /^!ui\/assets\/\*\*$/m);
});

test('markdown-them bundle is emitted beside the compiled document converter runtime', () => {
  const bundleScript = read('vscode/scripts/bundle-markdown-them.js');
  assert.match(
    bundleScript,
    /path\.join\(rootDir,\s*'vscode',\s*'out',\s*'vscode',\s*'src',\s*'vendor'\)/s,
  );
});

test('VSIX packaging verifies every runtime artifact before invoking vsce', () => {
  const packageJson = JSON.parse(read('vscode/package.json'));
  const verifyScript = read('vscode/scripts/verify-package-runtime.js');
  assert.match(packageJson.scripts.package, /verify-package-runtime\.js/);
  assert.match(verifyScript, /path\.join\('out', 'vscode', 'src', 'extension\.js'\)/);
  assert.match(verifyScript, /markdown-them\.cjs/);
  assert.match(verifyScript, /path\.join\('ui', 'dist', 'index\.html'\)/);
  assert.match(verifyScript, /verifyCompiledActivation/);
  assert.match(verifyScript, /node_modules.*yaml.*index\.js/);
});

// Regression gate for the 1.6.7 user report: packaging must reject a VSIX that
// omits the compiled extension entrypoint or bundled markdown-them dependency.
test('runtime gate reports missing compiled or bundled dependency artifacts', () => {
  const present = new Set(requiredRuntimeFiles.slice(0, -1).map(relativePath => path.join('/extension', relativePath)));
  const fakeFs = { existsSync: filePath => present.has(path.normalize(filePath)) };

  assert.deepEqual(
    findMissingRuntimeFiles({ fsImpl: fakeFs, root: '/extension' }),
    [requiredRuntimeFiles.at(-1)],
  );
});

// Cross-check every required artifact independently so a future package change
// cannot protect only the exact missing-file combination from the 1.6.7 report.
for (const missingRuntimeFile of requiredRuntimeFiles) {
  test(`runtime gate identifies missing ${missingRuntimeFile}`, () => {
    const missingPath = path.normalize(path.join('/extension', missingRuntimeFile));
    const fakeFs = {
      existsSync: filePath => path.normalize(filePath) !== missingPath,
    };

    assert.deepEqual(
      findMissingRuntimeFiles({ fsImpl: fakeFs, root: '/extension' }),
      [missingRuntimeFile],
    );
    assert.deepEqual(
      verifyPackageRuntime({
        fsImpl: fakeFs,
        root: '/extension',
        logger: { log: () => {}, error: () => {} },
      }),
      { ok: false, missingFiles: [missingRuntimeFile] },
    );
  });
}

test('runtime gate reports all missing artifacts in declaration order', () => {
  assert.deepEqual(
    findMissingRuntimeFiles({ fsImpl: { existsSync: () => false }, root: '/extension' }),
    requiredRuntimeFiles,
  );
});

test('runtime gate accepts a complete extension runtime', () => {
  const result = verifyPackageRuntime({
    fsImpl: { existsSync: () => true },
    root: '/extension',
    logger: { log: () => {}, error: () => {} },
  });

  assert.deepEqual(result, { ok: true, missingFiles: [] });
});

test('CI runs the focused packaging and updater contract tests', () => {
  const rootPackageJson = JSON.parse(read('package.json'));
  const testWorkflow = read('.github/workflows/test.yml');
  assert.equal(
    rootPackageJson.scripts['test:update-contracts'],
    'node --test tests/node/packaged-runtime-contract.test.mjs tests/node/tauri-updater-contract.test.mjs',
  );
  assert.match(testWorkflow, /pnpm run test:update-contracts/);
});
