import { describe, expect, it, vi } from 'vitest';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';
import { createHistoryClient } from '../../../../ui/src/history/historyClient';

function createBridge() {
  let handler: ((message: HostMessage) => void) | null = null;
  const sent: WebviewMessage[] = [];
  const bridge: PlatformBridge = {
    postMessage(message) { sent.push(message); },
    onMessage(next) { handler = next; return () => { handler = null; }; },
    getState: vi.fn(),
    setState: vi.fn(),
    copyToClipboard: vi.fn(),
  };
  return {
    bridge,
    sent,
    emit(message: HostMessage) { handler?.(message); },
  };
}

const revision = {
  oid: 'a'.repeat(40),
  shortOid: 'aaaaaaa',
  author: 'Test User',
  authoredAt: '2026-09-07T00:00:00Z',
  subject: 'docs: update',
  path: 'docs/a.md',
};

describe('history client', () => {
  it('resolves only the matching history request id', async () => {
    const transport = createBridge();
    const client = createHistoryClient(transport.bridge, (() => {
      let id = 0;
      return () => `history-${++id}`;
    })());

    let settled = false;
    const pending = client.listDocumentHistory('/docs/a.md').then((value) => {
      settled = true;
      return value;
    });
    expect(transport.sent[0]).toMatchObject({ command: 'listDocumentHistory', requestId: 'history-1', filePath: '/docs/a.md' });

    transport.emit({ command: 'documentHistoryResult', requestId: 'wrong', ok: true, revisions: [] });
    await Promise.resolve();
    expect(settled).toBe(false);

    transport.emit({ command: 'documentHistoryResult', requestId: 'history-1', ok: true, revisions: [revision] });
    await expect(pending).resolves.toEqual([revision]);
    client.dispose();
  });

  it('normalizes unsupported Git capability without throwing', async () => {
    const transport = createBridge();
    const client = createHistoryClient(transport.bridge, () => 'cap-1');
    const pending = client.getCapability();
    transport.emit({
      command: 'gitCapabilityResult',
      requestId: 'cap-1',
      capability: { supported: false, reason: 'unsupported-runtime' },
    });
    await expect(pending).resolves.toEqual({ supported: false, reason: 'unsupported-runtime' });
    client.dispose();
  });

  it('rejects a failed revision read without affecting other requests', async () => {
    const transport = createBridge();
    const ids = ['read-1', 'cap-2'];
    const client = createHistoryClient(transport.bridge, () => ids.shift()!);
    const read = client.readGitRevision('b'.repeat(40), 'docs/a.md');
    const capability = client.getCapability();

    transport.emit({ command: 'gitRevisionResult', requestId: 'read-1', ok: false, reason: 'revision-unavailable' });
    transport.emit({ command: 'gitCapabilityResult', requestId: 'cap-2', capability: { supported: true, repositoryRoot: '/repo' } });

    await expect(read).rejects.toThrow(/revision-unavailable/);
    await expect(capability).resolves.toEqual({ supported: true, repositoryRoot: '/repo' });
    client.dispose();
  });
});
