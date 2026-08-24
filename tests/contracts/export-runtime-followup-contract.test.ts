import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('export runtime follow-up CSS', () => {
  it('does not override the shared app-modal safe-region top offset for Export Center', () => {
    const css = read('ui/src/styles/global/global-export-runtime-followup.css');
    const exportCenterBlock = css.match(/\.export-center\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(exportCenterBlock).not.toContain('--topbar-h');
    expect(exportCenterBlock).not.toMatch(/justify-content:\s*flex-start/);
  });

  it('targets the current right-side file list instead of the retired TOC class', () => {
    const css = read('ui/src/styles/global/global-export-runtime-followup.css');
    expect(css).toContain('.mdn-export-file-list');
    expect(css).not.toContain('.mdn-export-toc');
  });

  it('keeps the shared collapsed code body as the only vertical scroll owner', () => {
    const css = read('ui/src/styles/global/global-export-runtime-followup.css');
    const body = css.match(/\.mdn-codeblock\[data-collapsed="true"\] \.mdn-codeblock-body\s*\{([^}]*)\}/s)?.[1] ?? '';
    const pre = css.match(/\.mdn-codeblock\[data-collapsed="true"\] \.mdn-pre\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(body).toMatch(/overflow-y:\s*auto/);
    expect(pre).toMatch(/overflow-y:\s*hidden/);
  });
});
