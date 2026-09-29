import { useEffect, useRef } from 'react';
import type { EditableDocumentSession } from './documentSession';
import { consumeNativeCloseApproval } from './nativeCloseApproval';
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
  // Read the latest sessions/guard at request time so the listener is registered
  // once instead of being torn down and re-attached on every keystroke.
  const latestRef = useRef({ sessions, guardUnsavedChanges });
  latestRef.current = { sessions, guardUnsavedChanges };

  useEffect(() => bridge.onMessage((message) => {
    if (message?.command !== 'nativeCloseRequested') return;
    const request = message as NativeCloseHostMessage;
    if (!request.requestId || (request.intent !== 'window' && request.intent !== 'app')) return;

    const confirm = (extra: { cancelled?: true } = {}) => bridge.postMessage({
      command: 'confirmNativeClose',
      requestId: request.requestId,
      intent: request.intent,
      ...extra,
    });

    // The renderer close button already ran the unsaved-changes prompt and the
    // user approved leaving; do not ask again.
    if (consumeNativeCloseApproval()) {
      confirm();
      return;
    }
    const dirtyPaths = collectDirtyDocumentPaths(latestRef.current.sessions);
    if (dirtyPaths.length === 0) {
      confirm();
      return;
    }
    latestRef.current.guardUnsavedChanges(dirtyPaths, () => confirm(), () => confirm({ cancelled: true }));
  }), [bridge]);
}
