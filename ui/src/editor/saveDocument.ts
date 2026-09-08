import type { PlatformBridge } from '../platform/bridge';
import type { DocumentRevisionToken, SaveDocumentResultMessage } from '../types';
import {
  serializeDocumentSource,
  type EditableDocumentSession,
} from './documentSession';

export interface SaveDocumentRequestOptions {
  readonly force?: boolean;
  readonly expectedRevision?: DocumentRevisionToken | null;
  readonly requestId?: string;
  readonly timeoutMs?: number;
}

type SaveBridge = Pick<PlatformBridge, 'postMessage' | 'onMessage'>;

export function requestSaveDocument(
  bridge: SaveBridge,
  session: EditableDocumentSession,
  options: SaveDocumentRequestOptions = {},
): Promise<SaveDocumentResultMessage> {
  const requestId = options.requestId
    ?? `save-document-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const expectedRevision = Object.prototype.hasOwnProperty.call(options, 'expectedRevision')
    ? options.expectedRevision ?? null
    : session.revision;

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof globalThis.setTimeout>;
    const finish = (result: SaveDocumentResultMessage) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'saveDocumentResult' || message.requestId !== requestId) return;
      finish(message);
    });
    timer = globalThis.setTimeout(() => {
      finish({
        command: 'saveDocumentResult',
        requestId,
        filePath: session.filePath,
        ok: false,
        reason: 'write-failed',
        error: 'Timed out waiting for save result.',
      });
    }, timeoutMs);

    bridge.postMessage({
      command: 'saveDocument',
      requestId,
      filePath: session.filePath,
      source: serializeDocumentSource(session.source, session.lineEnding),
      expectedRevision,
      force: options.force,
    });
  });
}
