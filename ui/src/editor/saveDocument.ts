import type { PlatformBridge } from '../platform/bridge';
import type { DocumentRevisionToken, SaveDocumentResultMessage } from '../types';
import {
  serializeDocumentSource,
  type EditableDocumentSession,
} from './documentSession';

/** How long a save reply is awaited before the caller is told the save failed. */
export const SAVE_DOCUMENT_TIMEOUT_MS = 10_000;
/**
 * After a timeout the host may still complete the write (slow network drive,
 * antivirus scan). Keep listening this long so the late success can be applied
 * instead of leaving the session with a stale revision.
 */
export const SAVE_DOCUMENT_LATE_RESULT_WINDOW_MS = 60_000;

export interface SaveDocumentRequestOptions {
  readonly force?: boolean;
  readonly expectedRevision?: DocumentRevisionToken | null;
  readonly requestId?: string;
  readonly timeoutMs?: number;
  /** Upper bound (from request start) for applying a reply that arrives after the timeout. */
  readonly lateTimeoutMs?: number;
  /** Called at most once when the host replies after the timeout result was already returned. */
  readonly onLateResult?: (result: SaveDocumentResultMessage) => void;
}

type SaveBridge = Pick<PlatformBridge, 'postMessage' | 'onMessage'>;

export function requestSaveDocument(
  bridge: SaveBridge,
  session: EditableDocumentSession,
  options: SaveDocumentRequestOptions = {},
): Promise<SaveDocumentResultMessage> {
  const requestId = options.requestId
    ?? `save-document-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timeoutMs = options.timeoutMs ?? SAVE_DOCUMENT_TIMEOUT_MS;
  const lateTimeoutMs = options.lateTimeoutMs ?? SAVE_DOCUMENT_LATE_RESULT_WINDOW_MS;
  const expectedRevision = Object.prototype.hasOwnProperty.call(options, 'expectedRevision')
    ? options.expectedRevision ?? null
    : session.revision;

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
    let lateTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
    const stopListening = () => {
      globalThis.clearTimeout(timer);
      globalThis.clearTimeout(lateTimer);
      unsubscribe();
    };
    const finish = (result: SaveDocumentResultMessage) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      resolve(result);
    };
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'saveDocumentResult' || message.requestId !== requestId) return;
      if (!settled) {
        finish(message);
        stopListening();
        return;
      }
      stopListening();
      options.onLateResult?.(message);
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
      if (!options.onLateResult) {
        stopListening();
        return;
      }
      lateTimer = globalThis.setTimeout(stopListening, Math.max(0, lateTimeoutMs - timeoutMs));
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
