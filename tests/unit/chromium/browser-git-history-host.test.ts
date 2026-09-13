import { describe, expect, it, vi } from 'vitest';
import { handleBrowserGitHistoryCommand } from '../../../chromium-xtension/src/browser-git-history-host';

describe('browser Git history host', () => {
  it('reports Git history as unsupported without process execution', async () => {
    const send = vi.fn();

    await expect(handleBrowserGitHistoryCommand({ command: 'getGitCapability', requestId: 'cap-1' }, send)).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith({
      command: 'gitCapabilityResult',
      requestId: 'cap-1',
      capability: { supported: false, reason: 'unsupported-runtime' },
    });
  });

  it.each([
    ['listDocumentHistory', 'documentHistoryResult', { ok: false, revisions: [], reason: 'unsupported-runtime' }],
    ['readGitRevision', 'gitRevisionResult', { ok: false, reason: 'unsupported-runtime' }],
    ['compareGitRevisions', 'gitComparisonResult', { ok: false, reason: 'unsupported-runtime' }],
  ] as const)('rejects %s safely', async (command, responseCommand, response) => {
    const send = vi.fn();

    await expect(handleBrowserGitHistoryCommand({ command, requestId: 'req-1' }, send)).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith({ command: responseCommand, requestId: 'req-1', ...response });
  });

  it('ignores unrelated messages', async () => {
    const send = vi.fn();
    await expect(handleBrowserGitHistoryCommand({ command: 'ready' }, send)).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
