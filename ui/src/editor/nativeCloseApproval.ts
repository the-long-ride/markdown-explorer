import type { PlatformBridge } from '../platform/bridge';

/**
 * The renderer close button asks the user about unsaved changes itself, then
 * posts `window-close`. The host answers that with a `nativeCloseRequested`
 * round trip; without this marker the user would be asked a second time (or a
 * stale dirty snapshot would block the close right after they chose to discard).
 */
const APPROVAL_TTL_MS = 5_000;
let approvedUntil = 0;

export function approveNextNativeClose(now: number = Date.now()): void {
  approvedUntil = now + APPROVAL_TTL_MS;
}

/** Returns true (once) when the user has just approved closing through the UI guard. */
export function consumeNativeCloseApproval(now: number = Date.now()): boolean {
  const approved = now <= approvedUntil;
  approvedUntil = 0;
  return approved;
}

/**
 * Shared handler for every renderer-drawn close button: run the unsaved-changes
 * guard first and only then ask the host to close the window.
 */
export function requestWindowClose(
  bridge: Pick<PlatformBridge, 'postMessage'>,
  guard: (commit: () => void, cancel?: () => void) => void,
): void {
  guard(() => {
    approveNextNativeClose();
    bridge.postMessage({ command: 'window-close' });
  });
}
