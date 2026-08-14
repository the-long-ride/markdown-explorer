import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const EXPECTED_VSCODE_RANGE = '^1.85.0';
const EXPECTED_TYPES_VERSION = '1.85.0';

const readJson = async (path) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
const readWorkspace = async () => readFile(new URL('../../pnpm-workspace.yaml', import.meta.url), 'utf8');
const readLockfile = async () => readFile(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8');

const readVscodeImporter = (lockfile) => {
  const match = lockfile.match(/\r?\n  vscode:\r?\n([\s\S]*?)(?=\r?\n  [\w.-]+:\r?\n|\r?\npackages:\r?\n)/);
  assert.ok(match, 'pnpm lockfile must contain a vscode importer');
  return match[0];
};

test('VS Code API types stay aligned with the supported VS Code 1.85 baseline', async () => {
  const [vscodePackage, workspace, lockfile] = await Promise.all([
    readJson('vscode/package.json'),
    readWorkspace(),
    readLockfile(),
  ]);

  assert.equal(vscodePackage.engines.vscode, EXPECTED_VSCODE_RANGE);
  assert.equal(vscodePackage.devDependencies['@types/vscode'], EXPECTED_VSCODE_RANGE);
  assert.match(workspace, /overrides:[\s\S]*'@types\/vscode': 1\.85\.0/);

  const vscodeImporter = readVscodeImporter(lockfile);
  assert.match(vscodeImporter, /'@types\/vscode':\r?\n\s+specifier: \^?1\.85\.0\r?\n\s+version: 1\.85\.0/);
  assert.match(lockfile, /'@types\/vscode@1\.85\.0':/);
  assert.doesNotMatch(lockfile, /'@types\/vscode@1\.125\.0':/);
});
