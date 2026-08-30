import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createPanelInsightsHost } from '../../../vscode/src/core/panelInsights';

const roots: string[] = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

function workspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'mdn-vscode-insights-'));
  roots.push(root);
  const write = (relativePath: string, data: string) => {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, data);
    return target;
  };
  return { root, write };
}

describe('VS Code Insights host', () => {
  it('uses stat-only resource probes and bounded source reads', async () => {
    const ws = workspace();
    const documentPath = ws.write('docs/a.md', '# A');
    ws.write('img/a.png', 'PNG');
    ws.write('large.md', 'x'.repeat(2048));
    const posted: any[] = [];
    const readFileSync = vi.fn(fs.readFileSync);
    const host = createPanelInsightsHost({
      fs: { ...fs, readFileSync } as typeof fs,
      pathApi: path,
      workspaceRoot: () => ws.root,
      postMessage: (message) => posted.push(message),
    });

    await host.probeWorkspaceResource({ requestId: 'p', documentPath, resourcePath: '../img/a.png' });
    expect(readFileSync).not.toHaveBeenCalled();
    expect(posted.at(-1)).toMatchObject({ status: 'exists', kind: 'file', sizeBytes: 3 });

    await host.readInsightsDocumentSource({ requestId: 's', relativePath: 'large.md', softLimitBytes: 1024 });
    expect(posted.at(-1)).toMatchObject({ command: 'insightsDocumentSourceResult', requestId: 's', status: 'too-large' });
  });

  it('streams every eligible file instead of inheriting sidebar scan caps', async () => {
    const ws = workspace();
    for (let i = 0; i < 1005; i += 1) ws.write(`notes/${i}.md`, `# ${i}`);
    const posted: any[] = [];
    const host = createPanelInsightsHost({ fs, pathApi: path, workspaceRoot: () => ws.root, postMessage: m => posted.push(m) });

    await host.scanInsightsWorkspace({ requestId: 'scan' });

    expect(posted.filter(m => m.command === 'insightsScanBatch').flatMap(m => m.entries)).toHaveLength(1005);
    expect(posted.find(m => m.command === 'insightsScanComplete')).toMatchObject({ totalEntries: 1005, truncated: false });
  });
});
