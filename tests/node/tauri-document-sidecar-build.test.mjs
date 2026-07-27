import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  deployArguments,
  prepareDocumentSidecar,
  resolveTargetTriple,
} from '../../tauri/scripts/prepare-document-sidecar.mjs';

test('prepare sidecar uses pnpm 11 portable deploy argument order', () => {
  assert.deepEqual(deployArguments('markdown-explorer-mdthem-sidecar', '/tmp/app'), [
    '--filter',
    'markdown-explorer-mdthem-sidecar',
    '--prod',
    'deploy',
    '--legacy',
    '/tmp/app',
  ]);
});


test('prepare sidecar prefers the Tauri target triple from the build environment', () => {
  let spawned = false;
  const target = resolveTargetTriple({
    env: { TAURI_ENV_TARGET_TRIPLE: 'aarch64-apple-darwin' },
    spawn() {
      spawned = true;
      return { status: 0, stdout: 'wrong-target' };
    },
  });

  assert.equal(target, 'aarch64-apple-darwin');
  assert.equal(spawned, false);
});

test('prepare sidecar falls back to the Rust host triple', () => {
  const target = resolveTargetTriple({
    env: {},
    spawn(command, args) {
      assert.equal(command, 'rustc');
      assert.deepEqual(args, ['--print', 'host-tuple']);
      return { status: 0, stdout: 'x86_64-unknown-linux-gnu\n' };
    },
  });

  assert.equal(target, 'x86_64-unknown-linux-gnu');
});

test('prepare sidecar stages a portable app and private Node runtime', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mdthem-sidecar-build-'));
  const sidecarDir = path.join(root, 'sidecar');
  const distDir = path.join(sidecarDir, 'dist');
  const fakeNode = path.join(root, 'node');
  const binaryDir = path.join(root, 'binaries');
  fs.mkdirSync(sidecarDir, { recursive: true });
  fs.writeFileSync(fakeNode, 'node-runtime');
  fs.writeFileSync(
    path.join(sidecarDir, 'package.json'),
    JSON.stringify({
      name: 'markdown-explorer-mdthem-sidecar',
      dependencies: { '@the-long-ride/markdown-them': '^1.3.1' },
    }),
  );

  const calls = [];
  const result = prepareDocumentSidecar({
    repoRootPath: root,
    sidecarDirectory: sidecarDir,
    outputDirectory: distDir,
    binaryDirectory: binaryDir,
    nodeExecutable: fakeNode,
    targetTriple: 'x86_64-unknown-linux-gnu',
    platform: 'linux',
    spawn(command, args, options) {
      calls.push({ command, args, options });
      const target = args.at(-1);
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, 'index.mjs'), '// deployed app');
      return { status: 0 };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'pnpm');
  assert.equal(calls[0].options.cwd, root);
  assert.equal(result.appDir, path.join(distDir, 'app'));
  assert.equal(
    result.sidecarBinaryPath,
    path.join(binaryDir, 'markdown-them-node-x86_64-unknown-linux-gnu'),
  );
  assert.equal(fs.readFileSync(result.sidecarBinaryPath, 'utf8'), 'node-runtime');
  assert.equal(fs.existsSync(path.join(distDir, 'runtime')), false);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8')).converter,
    '@the-long-ride/markdown-them',
  );
});
