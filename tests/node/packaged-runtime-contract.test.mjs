import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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
