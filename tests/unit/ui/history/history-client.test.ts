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

const commit = {
  oid: 'c'.repeat(40),
  shortOid: 'ccccccc',
  parentOids: ['b'.repeat(40)],
  author: 'Test User',
  authoredAt: '2026-09-13T00:00:00Z',
  subject: 'feat: repository history',
  refs: ['HEAD -> main'],
  isHead: true,
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

  it('lists paginated repository history through the correlated repository result', async () => {
    const transport = createBridge();
    const client = createHistoryClient(transport.bridge, () => 'repo-1');
    let settled = false;
    const pending = client.listRepositoryHistory(50, 100).then((value) => {
      settled = true;
      return value;
    });

    expect(transport.sent[0]).toEqual({ command: 'listRepositoryHistory', requestId: 'repo-1', limit: 50, offset: 100 });
    transport.emit({ command: 'revisionFilesResult', requestId: 'repo-1', ok: true, files: [] });
    await Promise.resolve();
    expect(settled).toBe(false);
    transport.emit({ command: 'repositoryHistoryResult', requestId: 'repo-1', ok: true, commits: [commit] });
    await expect(pending).resolves.toEqual([commit]);
    client.dispose();
  });

  it('lists and reads files from a selected revision', async () => {
    const transport = createBridge();
    const ids = ['files-1', 'file-2'];
    const client = createHistoryClient(transport.bridge, () => ids.shift()!);
    const oid = 'd'.repeat(40);

    const filesPending = client.listRevisionFiles(oid);
    expect(transport.sent[0]).toEqual({ command: 'listRevisionFiles', requestId: 'files-1', oid });
    transport.emit({ command: 'revisionFilesResult', requestId: 'files-1', ok: true, files: [{ path: 'docs/a.md' }] });
    await expect(filesPending).resolves.toEqual([{ path: 'docs/a.md' }]);

    const filePending = client.readRevisionFile(oid, 'docs/a.md');
    expect(transport.sent[1]).toEqual({ command: 'readRevisionFile', requestId: 'file-2', oid, path: 'docs/a.md' });
    transport.emit({ command: 'revisionFileResult', requestId: 'file-2', ok: true, snapshot: { oid, path: 'docs/a.md', source: '# historical' } });
    await expect(filePending).resolves.toEqual({ oid, path: 'docs/a.md', source: '# historical' });
    client.dispose();
  });

  it('rejects repository snapshot host failures with their exact reason', async () => {
    const transport = createBridge();
    const ids = ['repo-fail', 'files-fail', 'file-fail'];
    const client = createHistoryClient(transport.bridge, () => ids.shift()!);

    const repository = client.listRepositoryHistory();
    transport.emit({ command: 'repositoryHistoryResult', requestId: 'repo-fail', ok: false, commits: [], reason: 'unsupported-runtime' });
    await expect(repository).rejects.toThrow(/unsupported-runtime/);

    const files = client.listRevisionFiles('e'.repeat(40));
    transport.emit({ command: 'revisionFilesResult', requestId: 'files-fail', ok: false, files: [], reason: 'invalid-revision' });
    await expect(files).rejects.toThrow(/invalid-revision/);

    const file = client.readRevisionFile('f'.repeat(40), 'docs/a.md');
    transport.emit({ command: 'revisionFileResult', requestId: 'file-fail', ok: false, reason: 'git-command-failed' });
    await expect(file).rejects.toThrow(/git-command-failed/);
    client.dispose();
  });
});
