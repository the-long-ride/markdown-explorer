import type { PlatformBridge } from '../platform/bridge';
import type {
  ExportWorkspaceResourceHostFailureReason,
  ExportWorkspaceResourceInfo,
} from '../types/hostMessages';

const DEFAULT_TIMEOUT_MS = 5_000;

export type ExportWorkspaceResourceReadFailureReason =
  | ExportWorkspaceResourceHostFailureReason
  | 'timeout';

export type ExportWorkspaceResourceReadResult =
  | {
      readonly ok: true;
      readonly relativePath: string;
      readonly mimeType: string;
      readonly bytes: Uint8Array;
    }
  | {
      readonly ok: false;
      readonly reason: ExportWorkspaceResourceReadFailureReason;
    };

function requestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function decodeBase64(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function listWorkspaceExportResources(
  bridge: PlatformBridge,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<readonly ExportWorkspaceResourceInfo[]> {
  const id = requestId('export-resource-list');
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      unsubscribe();
      callback();
    };
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'workspaceExportResourcesResult' || message.requestId !== id) return;
      finish(() => {
        if (message.ok) {
          resolve([...(message.resources ?? [])]);
          return;
        }
        reject(new Error(message.error || 'Unable to list workspace export resources'));
      });
    });
    const timer = globalThis.setTimeout(() => {
      finish(() => reject(new Error('Workspace export resource listing timed out')));
    }, timeoutMs);

    try {
      bridge.postMessage({ command: 'listWorkspaceExportResources', requestId: id });
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error('Unable to list workspace export resources')));
    }
  });
}

export function readWorkspaceExportResource(
  bridge: PlatformBridge,
  resourcePath: string,
  options: { documentPath?: string; timeoutMs?: number } = {},
): Promise<ExportWorkspaceResourceReadResult> {
  const id = requestId('export-resource-read');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ExportWorkspaceResourceReadResult) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'workspaceExportResourceResult' || message.requestId !== id) return;
      if (!message.ok) {
        finish({ ok: false, reason: message.reason ?? 'unreadable' });
        return;
      }
      if (!message.relativePath || !message.mimeType || typeof message.dataBase64 !== 'string') {
        finish({ ok: false, reason: 'unreadable' });
        return;
      }
      try {
        finish({
          ok: true,
          relativePath: message.relativePath,
          mimeType: message.mimeType,
          bytes: decodeBase64(message.dataBase64),
        });
      } catch {
        finish({ ok: false, reason: 'unreadable' });
      }
    });
    const timer = globalThis.setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);

    try {
      bridge.postMessage({
        command: 'readWorkspaceExportResource',
        requestId: id,
        resourcePath,
        ...(options.documentPath ? { documentPath: options.documentPath } : {}),
      });
    } catch {
      finish({ ok: false, reason: 'unsupported' });
    }
  });
}
