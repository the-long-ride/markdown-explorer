import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHistoryClient } from '../../../../ui/src/history/historyClient';

function harness(timeoutMs = 1000) {
  let listener: ((message: any) => void) | null = null;
  const posted: any[] = [];
  const unsubscribe = vi.fn();
  const bridge = {
    postMessage: (message: any) => posted.push(message),
    onMessage: (fn: (message: any) => void) => { listener = fn; return unsubscribe; },
  } as any;
  let id = 0;
  const client = createHistoryClient(bridge, () => `r${++id}`, timeoutMs);
  return { client, posted, unsubscribe, send: (message: any) => listener!(message) };
}

afterEach(() => vi.useRealTimers());

describe('history client message handling', () => {
  it('resolves and rejects git comparisons', async () => {
    const { client, posted, send } = harness();
    const ok = client.compareGitRevisions({ kind: 'working' } as any, { kind: 'revision', oid: 'a' } as any);
    expect(posted[0]).toMatchObject({ command: 'compareGitRevisions', requestId: 'r1' });
    send({ command: 'gitRevisionResult', requestId: 'r1', ok: true });
    send({ command: 'gitComparisonResult', requestId: 'r1', ok: true, leftSource: 'L', rightSource: 'R', leftLabel: 'l', rightLabel: 'r' });
    await expect(ok).resolves.toMatchObject({ leftSource: 'L', rightSource: 'R' });
    const bad = client.compareGitRevisions({} as any, {} as any);
    send({ command: 'gitComparisonResult', requestId: 'r2', ok: true, leftSource: 'L' });
    await expect(bad).rejects.toThrow('Unable to compare Git revisions');
    const reason = client.compareGitRevisions({} as any, {} as any);
    send({ command: 'gitComparisonResult', requestId: 'r3', ok: false, reason: 'nope' });
    await expect(reason).rejects.toThrow('nope');
  });

  it('handles revision, history and file results including failures', async () => {
    const { client, send } = harness();
    const history = client.listDocumentHistory('a.md');
    send({ command: 'documentHistoryResult', requestId: 'r1', ok: false });
    await expect(history).rejects.toThrow('Unable to read document history');
    const revision = client.readGitRevision('oid', 'a.md');
    send({ command: 'gitRevisionResult', requestId: 'r2', ok: true, snapshot: { source: 'x' } });
    await expect(revision).resolves.toEqual({ source: 'x' });
    const missing = client.readGitRevision('oid', 'a.md');
    send({ command: 'gitRevisionResult', requestId: 'r3', ok: true });
    await expect(missing).rejects.toThrow();
    const repo = client.listRepositoryHistory({ limit: 5, before: 'b', offset: 2, allRefs: true });
    send({ command: 'repositoryHistoryResult', requestId: 'r4', ok: false });
    await expect(repo).rejects.toThrow('Unable to read repository history');
    const files = client.listRevisionFiles('oid');
    send({ command: 'revisionFilesResult', requestId: 'r5', ok: false });
    await expect(files).rejects.toThrow('Unable to list revision files');
    const file = client.readRevisionFile('oid', 'a.md');
    send({ command: 'revisionFileResult', requestId: 'r6', ok: false, reason: 'gone' });
    await expect(file).rejects.toThrow('gone');
  });

  it('ignores unrelated messages, times out and rejects after dispose', async () => {
    vi.useFakeTimers();
    const { client, send, unsubscribe } = harness(50);
    const pending = client.listRevisionFiles('oid');
    send({ command: 'other' });
    send({ command: 'revisionFilesResult', requestId: 42 });
    send({ command: 'revisionFilesResult', requestId: 'unknown', ok: true });
    send({ command: 'documentHistoryResult', requestId: 'r1', ok: true });
    vi.advanceTimersByTime(60);
    await expect(pending).rejects.toThrow('History request timed out');
    const waiting = client.listRepositoryHistory();
    client.dispose();
    client.dispose();
    await expect(waiting).rejects.toThrow('disposed');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(client.isDisposed()).toBe(true);
    await expect(client.readRevisionFile('o', 'p')).rejects.toThrow('disposed');
  });
});
