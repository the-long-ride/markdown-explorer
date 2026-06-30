import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import DesktopScanner from '../../../desktop/scanner.js';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

describe('DesktopScanner', () => {
  test('extractMdxTitle prefers frontmatter title', () => {
    const title = DesktopScanner.extractMdxTitle([
      '---',
      'title: "Frontmatter Title"',
      '---',
      '',
      "export const title = 'Ignored';",
    ].join('\n'));

    expect(title).toEqual('Frontmatter Title');
  });

  test('extractTitle falls back to markdown heading when MDX metadata is absent', () => {
    const rootDir = makeTempDir('mdx-title-');
    const filePath = path.join(rootDir, 'sample.mdx');
    writeFile(filePath, ['Intro', '', '# Visible Heading'].join('\n'));

    expect(DesktopScanner.extractTitle(filePath, true)).toEqual('Visible Heading');
  });

  test('scan ignores excluded folders and unsupported files', async () => {
    const rootDir = makeTempDir('scanner-scan-');
    writeFile(path.join(rootDir, 'docs', 'guide.md'), '# Guide');
    writeFile(path.join(rootDir, '.git', 'ignored.md'), '# Git');
    writeFile(path.join(rootDir, 'node_modules', 'pkg.md'), '# Pkg');
    writeFile(path.join(rootDir, 'notes.txt'), 'plain text');
    writeFile(path.join(rootDir, 'image.png'), 'not supported');

    const { flat, tree } = await DesktopScanner.scan(rootDir);

    expect(
      flat.map((entry: any) => entry.relativePath).sort(),
    ).toEqual(
      [path.join('docs', 'guide.md'), 'notes.txt'].sort(),
    );
    expect(tree.children.length).toBe(1);
    expect(tree.children[0].name).toBe('docs');
  });

  test('extractTitle reads headings found within the initial title chunk', () => {
    const rootDir = makeTempDir('scanner-chunk-');
    const filePath = path.join(rootDir, 'long.md');
    const prefix = 'a'.repeat(70 * 1024);
    writeFile(filePath, `${prefix}\n# Late Heading`);

    expect(DesktopScanner.extractTitle(filePath, false)).toBeNull();
  });
});
