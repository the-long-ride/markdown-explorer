import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateVscodeReadme } from '../../scripts/sync-readme.mjs';

describe('readme-sync contract', () => {
  const rootReadmePath = resolve(__dirname, '../../README.md');
  const vscodeReadmePath = resolve(__dirname, '../../vscode/README.md');

  it('keeps vscode/README.md synchronized with root README.md while retaining VS Code tutorial and absolute URLs', () => {
    const rootReadme = readFileSync(rootReadmePath, 'utf8');
    const vscodeReadme = readFileSync(vscodeReadmePath, 'utf8');

    // 1. VS Code README must contain the VS Code extension specific tutorial
    expect(vscodeReadme).toContain('## VS Code Extension Tutorial');
    expect(vscodeReadme).toContain('Markdown Explorer: Open Docs Viewer');
    expect(vscodeReadme).toContain('Markdown Explorer: Toggle Docs Viewer');

    // 2. Relative doc and license links must be rewritten to absolute GitHub URLs for Marketplace compatibility
    expect(vscodeReadme).not.toMatch(/href="docs\//);
    expect(vscodeReadme).not.toMatch(/\]\(docs\//);
    expect(vscodeReadme).not.toMatch(/\]\(LICENSE\)/);
    expect(vscodeReadme).toContain('https://github.com/the-long-ride/markdown-explorer/blob/main/docs/');
    expect(vscodeReadme).toContain('https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE');

    // 3. Generating from root README must match vscode/README.md content
    const expectedVscodeReadme = generateVscodeReadme(rootReadme, vscodeReadme);
    const normalizeEol = (str: string) => str.replace(/\r\n/g, '\n').trim();

    expect(normalizeEol(vscodeReadme)).toBe(normalizeEol(expectedVscodeReadme));
  });
});
