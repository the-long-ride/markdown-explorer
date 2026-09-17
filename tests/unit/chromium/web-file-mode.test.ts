import { describe, expect, it, vi } from 'vitest';
import { handleWebFileUtilityMessage } from '../../../website-app/src/web-file-utility-router';

import {
  WORKSPACE_SCAN_BATCH_SIZE,
  WORKSPACE_SCAN_REVEAL_DELAY_MS,
} from '../../../website-app/src/web-file-mode';

describe('demo file-mode workspace loading', () => {
  it('reveals the workspace shell after the shared 3-second threshold', () => {
    expect(WORKSPACE_SCAN_REVEAL_DELAY_MS).toBe(3000);
  });

  it('publishes cumulative workspace refreshes in 32-file batches', () => {
    expect(WORKSPACE_SCAN_BATCH_SIZE).toBe(32);
  });

  it('returns an in-workspace Markdown snapshot for Scope View', async () => {
    const send = vi.fn();
    const file = { fsPath: '/workspace/guide.md', relativePath: 'guide.md' } as any;
    const read = vi.fn(async () => '# Web guide');

    await handleWebFileUtilityMessage(
      { command: 'loadSearchPreview', requestId: 'scope-web-1', filePath: file.fsPath },
      {
        getSearchIndex: () => ({ read } as any),
        getSingleFileHandle: () => null,
        getFlatList: () => [file],
        getActiveWorkspacePath: () => '/workspace',
        getWorkspaceTree: () => null,
        getActiveHandle: () => null,
        send,
      },
    );

    expect(read).toHaveBeenCalledWith('guide.md');
    expect(send).toHaveBeenCalledWith({
      command: 'searchPreviewResult',
      requestId: 'scope-web-1',
      ok: true,
      filePath: file.fsPath,
      markdownSource: '# Web guide',
    });
  });

  it('rejects an unavailable Scope View snapshot without navigating', async () => {
    const send = vi.fn();
    const file = { fsPath: '/workspace/guide.md', relativePath: 'guide.md' } as any;

    await handleWebFileUtilityMessage(
      { command: 'loadSearchPreview', requestId: 'scope-web-outside', filePath: '/other/guide.md' },
      {
        getSearchIndex: () => ({ read: vi.fn() } as any),
        getSingleFileHandle: () => null,
        getFlatList: () => [file],
        getActiveWorkspacePath: () => '/workspace',
        getWorkspaceTree: () => null,
        getActiveHandle: () => null,
        send,
      },
    );

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      command: 'searchPreviewResult',
      requestId: 'scope-web-outside',
      ok: false,
      reason: 'outside-workspace',
    }));
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'navigate' }));
  });
});
