import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DesktopScanner = require('../../electron/workspace/scanner.js');

test('DesktopScanner stops traversing when the workspace operation is cancelled', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mdx-scanner-cancel-'));
  try {
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        writeFile(path.join(root, `file-${String(index).padStart(2, '0')}.md`), `# File ${index}\n`),
      ),
    );

    let current = true;
    let discovered = 0;
    const result = await DesktopScanner.scan(root, {
      isCurrent: () => current,
      onFile() {
        discovered += 1;
        current = false;
      },
    });

    assert.equal(discovered, 1);
    assert.equal(result.flat.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
