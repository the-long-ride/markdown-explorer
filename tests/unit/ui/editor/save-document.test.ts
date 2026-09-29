import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEditableDocumentSession,
  replaceWorkingSource,
} from '../../../../ui/src/editor/documentSession';
import { requestSaveDocument } from '../../../../ui/src/editor/saveDocument';
import type { HostMessage, WebviewMessage } from '../../../../ui/src/types';

function fakeBridge(onPost: (message: WebviewMessage, emit: (message: HostMessage) => void) => void) {
  const listeners = new Set<(message: HostMessage) => void>();
  const emit = (message: HostMessage) => listeners.forEach((listener) => listener(message));
  return {
    postMessage: vi.fn((message: WebviewMessage) => onPost(message, emit)),
    onMessage: vi.fn((handler: (message: HostMessage) => void) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    }),
  } as any;
}

describe('requestSaveDocument', () => {
  it('serializes the original line ending and resolves only the matching request', async () => {
    const session = replaceWorkingSource(
      createEditableDocumentSession('/docs/a.md', '# A\r\n', '10:5'),
      '# B\n',
    );
    const bridge = fakeBridge((message, emit) => {
      if (message.command !== 'saveDocument') return;
      queueMicrotask(() => {
        emit({
          command: 'saveDocumentResult',
          requestId: 'other',
          filePath: '/docs/a.md',
          ok: true,
          revision: '20:5',
        });
        emit({
          command: 'saveDocumentResult',
          requestId: message.requestId,
          filePath: '/docs/a.md',
          ok: true,
          revision: '30:5',
        });
      });
    });

    const result = await requestSaveDocument(bridge, session, {
      requestId: 'save-1',
      timeoutMs: 100,
    });

    expect(bridge.postMessage).toHaveBeenCalledWith({
      command: 'saveDocument',
      requestId: 'save-1',
      filePath: '/docs/a.md',
      source: '# B\r\n',
      expectedRevision: '10:5',
      force: undefined,
    });
    expect(result.requestId).toBe('save-1');
    expect(result.revision).toBe('30:5');
  });

  it('returns a write-failed result when the host never replies', async () => {
    const bridge = fakeBridge(() => {});
    const session = createEditableDocumentSession('/docs/a.md', '# A', '10:3');
    const result = await requestSaveDocument(bridge, session, {
      requestId: 'save-timeout',
      timeoutMs: 1,
    });
    expect(result).toMatchObject({
      command: 'saveDocumentResult',
      requestId: 'save-timeout',
      filePath: '/docs/a.md',
      ok: false,
      reason: 'write-failed',
    });
  });
});

describe('requestSaveDocument late results', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('keeps listening after a timeout and reports a late success through onLateResult', async () => {
    vi.useFakeTimers();
    let emitResult: (message: HostMessage) => void = () => {};
    const bridge = fakeBridge((_message, emit) => { emitResult = emit; });
    const session = replaceWorkingSource(createEditableDocumentSession('/docs/a.md', '# A', '10:3'), '# B');
    const onLateResult = vi.fn();
    const promise = requestSaveDocument(bridge, session, {
      requestId: 'save-late', timeoutMs: 10, lateTimeoutMs: 1_000, onLateResult,
    });
    await vi.advanceTimersByTimeAsync(11);
    await expect(promise).resolves.toMatchObject({ ok: false, reason: 'write-failed' });

    emitResult({ command: 'saveDocumentResult', requestId: 'other', filePath: '/docs/a.md', ok: true, revision: '9:9' });
    expect(onLateResult).not.toHaveBeenCalled();
    emitResult({ command: 'saveDocumentResult', requestId: 'save-late', filePath: '/docs/a.md', ok: true, revision: '20:3' });
    expect(onLateResult).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'save-late', ok: true, revision: '20:3' }));

    emitResult({ command: 'saveDocumentResult', requestId: 'save-late', filePath: '/docs/a.md', ok: true, revision: '21:3' });
    expect(onLateResult).toHaveBeenCalledTimes(1);
  });

  it('stops listening once the late window has elapsed', async () => {
    vi.useFakeTimers();
    let emitResult: (message: HostMessage) => void = () => {};
    const bridge = fakeBridge((_message, emit) => { emitResult = emit; });
    const session = createEditableDocumentSession('/docs/a.md', '# A', '10:3');
    const onLateResult = vi.fn();
    const promise = requestSaveDocument(bridge, session, {
      requestId: 'save-expired', timeoutMs: 10, lateTimeoutMs: 100, onLateResult,
    });
    await vi.advanceTimersByTimeAsync(11);
    await promise;
    await vi.advanceTimersByTimeAsync(200);
    emitResult({ command: 'saveDocumentResult', requestId: 'save-expired', filePath: '/docs/a.md', ok: true, revision: '20:3' });
    expect(onLateResult).not.toHaveBeenCalled();
    expect(bridge.onMessage).toHaveBeenCalledTimes(1);
  });

  it('does not keep listening after a normal reply', async () => {
    const onLateResult = vi.fn();
    const bridge = fakeBridge((message, emit) => {
      if (message.command !== 'saveDocument') return;
      queueMicrotask(() => emit({ command: 'saveDocumentResult', requestId: message.requestId, filePath: '/docs/a.md', ok: true, revision: '20:3' }));
    });
    const session = createEditableDocumentSession('/docs/a.md', '# A', '10:3');
    await requestSaveDocument(bridge, session, { requestId: 'save-ok', onLateResult });
    expect(onLateResult).not.toHaveBeenCalled();
  });
});
