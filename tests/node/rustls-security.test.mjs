import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// https://github.com/rustls/rustls/security/advisories/GHSA-2mjx-qc3c-rqvc
// A downgrade into the affected range must fail this contract.
test('locked Rustls excludes GHSA-2mjx-qc3c-rqvc affected versions', async () => {
  const lockfile = await readFile(new URL('../../tauri/Cargo.lock', import.meta.url), 'utf8');
  const versions = [...lockfile.matchAll(/^name = "rustls"\r?\nversion = "([^"]+)"/gm)]
    .map((match) => match[1]);
  assert.ok(versions.length > 0, 'expected a locked Rustls dependency');
  for (const version of versions) {
    const [major, minor, patch] = version.split('.').map(Number);
    assert.ok(
      !(major === 0 && minor === 23 && patch >= 13 && patch < 45),
      `rustls@${version} is affected by GHSA-2mjx-qc3c-rqvc; update to 0.23.45 or later`,
    );
  }
});
