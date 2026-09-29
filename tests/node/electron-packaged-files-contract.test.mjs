import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const electronRoot = fileURLToPath(new URL('../../electron/', import.meta.url));
const packageJson = JSON.parse(readFileSync(new URL('../../electron/package.json', import.meta.url), 'utf8'));
const globs = packageJson.build.files.filter((entry) => typeof entry === 'string');

test('packaged Electron files include every runtime source directory', () => {
  const runtimeDirectories = readdirSync(electronRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !['node_modules', 'dist', 'build', 'release'].includes(entry.name))
    .map((entry) => entry.name)
    .filter((name) => readdirSync(new URL(`../../electron/${name}/`, import.meta.url)).some((file) => file.endsWith('.js')));

  const missing = runtimeDirectories.filter((name) => !globs.some((glob) => glob.startsWith(`${name}/`)));
  assert.deepEqual(missing, []);
});
