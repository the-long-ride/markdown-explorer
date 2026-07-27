import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';

import { handleRequest, runProtocol } from '../../tauri/sidecar/mdthem-sidecar/protocol.mjs';

test('sidecar converts a valid request with the injected markdown-them adapter', async () => {
  const calls = [];
  const response = await handleRequest(
    { id: 'request-1', command: 'convert', path: '/tmp/slides.pptx' },
    async (filePath) => {
      calls.push(filePath);
      return '# Slides';
    },
  );

  assert.deepEqual(calls, ['/tmp/slides.pptx']);
  assert.deepEqual(response, { id: 'request-1', ok: true, markdown: '# Slides' });
});

test('sidecar returns a protocol error for unknown commands', async () => {
  const response = await handleRequest(
    { id: 'request-2', command: 'inspect', path: '/tmp/file.docx' },
    async () => '# unused',
  );

  assert.equal(response.id, 'request-2');
  assert.equal(response.ok, false);
  assert.match(response.error, /unknown command/i);
});

test('sidecar returns conversion errors without crashing the process', async () => {
  const response = await handleRequest(
    { id: 'request-3', command: 'convert', path: '/tmp/file.pdf' },
    async () => {
      throw new Error('converter exploded');
    },
  );

  assert.deepEqual(response, {
    id: 'request-3',
    ok: false,
    error: 'converter exploded',
  });
});

test('sidecar rejects missing file paths before calling markdown-them', async () => {
  let called = false;
  const response = await handleRequest(
    { id: 'request-4', command: 'convert' },
    async () => {
      called = true;
      return '# unused';
    },
  );

  assert.equal(called, false);
  assert.equal(response.ok, false);
  assert.match(response.error, /path/i);
});


test('sidecar waits for an async conversion after stdin closes', async () => {
  let output = '';
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });

  await runProtocol({
    input: Readable.from([
      JSON.stringify({ id: 'request-5', command: 'convert', path: '/tmp/deck.pptx' }) + '\n',
    ]),
    output: sink,
    errorOutput: sink,
    convert: async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return '# Finished deck';
    },
  });

  const lines = output.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.deepEqual(lines, [
    { id: 'request-5', ok: true, markdown: '# Finished deck' },
  ]);
});

test('sidecar entry process loads markdown-them and returns one response before exiting', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { spawn } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');

  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mdthem-sidecar-process-'));
  fs.copyFileSync(
    path.join(repoRoot, 'tauri/sidecar/mdthem-sidecar/index.mjs'),
    path.join(root, 'index.mjs'),
  );
  fs.copyFileSync(
    path.join(repoRoot, 'tauri/sidecar/mdthem-sidecar/protocol.mjs'),
    path.join(root, 'protocol.mjs'),
  );
  const packageDir = path.join(
    root,
    'node_modules',
    '@the-long-ride',
    'markdown-them',
  );
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify({ type: 'module', exports: './index.mjs' }),
  );
  fs.writeFileSync(
    path.join(packageDir, 'index.mjs'),
    `export async function generateMarkdown(filePath) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return '# Converted ' + filePath;
    }`,
  );

  const child = spawn(process.execPath, [path.join(root, 'index.mjs')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  child.stdin.end(
    `${JSON.stringify({ id: 'process-1', command: 'convert', path: '/tmp/deck.pptx' })}\n`,
  );

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });

  assert.equal(exitCode, 0, stderr);
  assert.deepEqual(JSON.parse(stdout.trim()), {
    id: 'process-1',
    ok: true,
    markdown: '# Converted /tmp/deck.pptx',
  });
});
