import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import DesktopScanner from '../../../electron/workspace/scanner.js';

const roots: string[] = [];
function workspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-empty-'));
  roots.push(root);
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('DesktopScanner empty folders', () => {
  it('adds truly empty folders and skips folders with only unsupported files', async () => {
    const root = workspace();
    fs.mkdirSync(path.join(root, 'blank'));
    fs.mkdirSync(path.join(root, 'outer', 'inner'), { recursive: true });
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'assets', 'logo.png'), 'picture');
    fs.mkdirSync(path.join(root, 'node_modules', 'empty'), { recursive: true });
    fs.writeFileSync(path.join(root, 'readme.md'), '# Readme');

    const { tree, emptyDirs } = await DesktopScanner.scan(root);

    expect([...emptyDirs].sort()).toEqual(['blank', 'outer/inner']);
    expect(tree.children.map((child: any) => child.path).sort()).toEqual(['blank', 'outer']);
    expect(tree.children.find((child: any) => child.path === 'outer').children[0].path).toBe('outer/inner');
    expect(DesktopScanner.hasEmptyFolder(tree)).toBe(true);
  });

  it('reports no empty folder for a files-only tree', () => {
    const tree = DesktopScanner.buildTree([{ parts: ['a', 'b.md'], modifiedAt: 1 }]);
    expect(DesktopScanner.hasEmptyFolder(tree)).toBe(false);
  });

  it('tolerates a missing tree when checking for empty folders', () => {
    expect(DesktopScanner.hasEmptyFolder(null)).toBe(false);
  });
});
