import { useEffect } from 'react';
import type { EditableDocumentSession } from './documentSession';
import { collectDirtyDocumentPaths } from './unsavedGuards';

type NativeCloseIntent = 'window' | 'app';

type NativeCloseHostMessage = {
  readonly command: 'nativeCloseRequested';
  readonly requestId: string;
  readonly intent: NativeCloseIntent;
};

type NativeCloseBridge = {
  readonly onMessage: (handler: (message: any) => void) => () => void;
  readonly postMessage: (message: any) => void;
};

interface UseNativeCloseGuardOptions {
  readonly bridge: NativeCloseBridge;
  readonly sessions: Readonly<Record<string, EditableDocumentSession>>;
  readonly guardUnsavedChanges: (filePaths: string[], commit: () => void, cancel?: () => void) => void;
}

export function useNativeCloseGuard({ bridge, sessions, guardUnsavedChanges }: UseNativeCloseGuardOptions) {
  useEffect(() => bridge.onMessage((message) => {
    if (message?.command !== 'nativeCloseRequested') return;
    const request = message as NativeCloseHostMessage;
    if (!request.requestId || (request.intent !== 'window' && request.intent !== 'app')) return;

    const dirtyPaths = collectDirtyDocumentPaths(sessions);
    guardUnsavedChanges(dirtyPaths, () => {
      bridge.postMessage({
        command: 'confirmNativeClose',
        requestId: request.requestId,
        intent: request.intent,
      });
    }, () => {
      bridge.postMessage({
        command: 'confirmNativeClose',
        requestId: request.requestId,
        intent: request.intent,
        cancelled: true,
      });
    });
  }), [bridge, guardUnsavedChanges, sessions]);
}
