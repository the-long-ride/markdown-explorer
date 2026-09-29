import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createNativeCloseGuard } = require('../../../electron/core/native-close-guard.js');

type FakeWebContents = ReturnType<typeof makeEmitter> & {
  isCrashed?: () => boolean;
  isDestroyed?: () => boolean;
  isLoading?: () => boolean;
};

function makeEmitter() {
  const handlers: Record<string, Function[]> = {};
  return {
    on: vi.fn((event: string, handler: Function) => {
      (handlers[event] ??= []).push(handler);
    }),
    trigger(event: string, ...args: unknown[]) {
      for (const handler of handlers[event] ?? []) handler(...args);
    },
  };
}

function makeWindow() {
  const handlers: Record<string, Function[]> = {};
  return {
    webContents: makeEmitter() as FakeWebContents,
    close: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      (handlers[event] ??= []).push(handler);
    }),
    trigger(event: string, ...args: unknown[]) {
      for (const handler of handlers[event] ?? []) handler(...args);
    },
  };
}

function makeEvent() {
  return { preventDefault: vi.fn() };
}

describe('Electron native close guard', () => {
  it('defers a native Windows close until the renderer approves app quit', () => {
    const window = makeWindow();
    const app = { quit: vi.fn() };
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app, getMainWindow: () => window, sendHostMessage, platform: 'win32' });
    guard.attachWindow(window);

    const event = makeEvent();
    window.trigger('close', event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(app.quit).not.toHaveBeenCalled();
    expect(sendHostMessage).toHaveBeenCalledWith(expect.objectContaining({
      command: 'nativeCloseRequested',
      intent: 'app',
      requestId: expect.any(String),
    }));

    const request = sendHostMessage.mock.calls[0][0];
    expect(guard.confirm(request)).toBe(true);
    expect(app.quit).toHaveBeenCalledTimes(1);
  });

  it('defers macOS window close but does not turn it into an app quit', () => {
    const window = makeWindow();
    const app = { quit: vi.fn() };
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app, getMainWindow: () => window, sendHostMessage, platform: 'darwin' });
    guard.attachWindow(window);

    const firstEvent = makeEvent();
    window.trigger('close', firstEvent);
    const request = sendHostMessage.mock.calls[0][0];
    expect(request.intent).toBe('window');

    expect(guard.confirm(request)).toBe(true);
    expect(window.close).toHaveBeenCalledTimes(1);
    expect(app.quit).not.toHaveBeenCalled();

    const approvedEvent = makeEvent();
    window.trigger('close', approvedEvent);
    expect(approvedEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('intercepts before-quit until the matching renderer approval arrives', () => {
    const window = makeWindow();
    const app = { quit: vi.fn() };
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app, getMainWindow: () => window, sendHostMessage, platform: 'linux' });

    const event = makeEvent();
    expect(guard.handleBeforeQuit(event)).toBe(false);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(sendHostMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'nativeCloseRequested', intent: 'app' }));

    const request = sendHostMessage.mock.calls[0][0];
    expect(guard.confirm(request)).toBe(true);
    expect(app.quit).toHaveBeenCalledTimes(1);
    expect(guard.handleBeforeQuit(makeEvent())).toBe(true);
  });

  it('routes an explicit app-quit request through the same renderer approval request', () => {
    const window = makeWindow();
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app: { quit: vi.fn() }, getMainWindow: () => window, sendHostMessage, platform: 'win32' });

    guard.requestAppQuit();
    guard.requestAppQuit();

    expect(sendHostMessage).toHaveBeenCalledTimes(1);
    expect(sendHostMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'nativeCloseRequested', intent: 'app' }));
  });

  it('clears a canceled request so a later close attempt starts a fresh request', () => {
    const window = makeWindow();
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app: { quit: vi.fn() }, getMainWindow: () => window, sendHostMessage, platform: 'darwin' });
    guard.attachWindow(window);

    window.trigger('close', makeEvent());
    const windowRequest = sendHostMessage.mock.calls[0][0];
    expect(windowRequest.intent).toBe('window');
    expect(guard.cancel(windowRequest)).toBe(true);

    guard.requestAppQuit();
    const appRequest = sendHostMessage.mock.calls[1][0];
    expect(appRequest.intent).toBe('app');
    expect(appRequest.requestId).not.toBe(windowRequest.requestId);
  });

  it('routes the renderer title-bar close through the renderer approval request', () => {
    const window = makeWindow();
    const app = { quit: vi.fn() };
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app, getMainWindow: () => window, sendHostMessage, platform: 'win32' });
    guard.attachWindow(window);

    expect(guard.closeApprovedWindow).toBeUndefined();
    guard.requestWindowClose();
    expect(window.close).not.toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();
    expect(guard.isAppQuitApproved()).toBe(false);
    expect(sendHostMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'nativeCloseRequested', intent: 'app' }));

    const request = sendHostMessage.mock.calls[0][0];
    expect(guard.confirm(request)).toBe(true);
    expect(app.quit).toHaveBeenCalledTimes(1);
  });

  it('uses a window intent for the renderer title-bar close on macOS', () => {
    const window = makeWindow();
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app: { quit: vi.fn() }, getMainWindow: () => window, sendHostMessage, platform: 'darwin' });
    guard.requestWindowClose();
    expect(sendHostMessage.mock.calls[0][0].intent).toBe('window');
  });

  it('re-sends the pending request when close is requested again', () => {
    const window = makeWindow();
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app: { quit: vi.fn() }, getMainWindow: () => window, sendHostMessage, platform: 'win32' });
    guard.attachWindow(window);

    window.trigger('close', makeEvent());
    window.trigger('close', makeEvent());
    expect(sendHostMessage).toHaveBeenCalledTimes(2);
    expect(sendHostMessage.mock.calls[1][0]).toEqual(sendHostMessage.mock.calls[0][0]);
  });

  it('upgrades a pending macOS window close to an app quit when Cmd+Q arrives', () => {
    const window = makeWindow();
    const app = { quit: vi.fn() };
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app, getMainWindow: () => window, sendHostMessage, platform: 'darwin' });
    guard.attachWindow(window);

    window.trigger('close', makeEvent());
    const windowRequest = sendHostMessage.mock.calls[0][0];
    expect(windowRequest.intent).toBe('window');

    const quitEvent = makeEvent();
    expect(guard.handleBeforeQuit(quitEvent)).toBe(false);
    expect(quitEvent.preventDefault).toHaveBeenCalled();

    expect(guard.confirm(windowRequest)).toBe(true);
    expect(app.quit).toHaveBeenCalledTimes(1);
    expect(window.close).not.toHaveBeenCalled();
    expect(guard.handleBeforeQuit(makeEvent())).toBe(true);
  });

  it('allows close when the renderer process is gone during a pending request', () => {
    const window = makeWindow();
    const app = { quit: vi.fn() };
    const guard = createNativeCloseGuard({ app, getMainWindow: () => window, sendHostMessage: vi.fn(), platform: 'win32' });
    guard.attachWindow(window);

    window.trigger('close', makeEvent());
    window.webContents.trigger('render-process-gone', {}, { reason: 'crashed' });
    expect(app.quit).toHaveBeenCalledTimes(1);
    expect(guard.isAppQuitApproved()).toBe(true);
  });

  it('clears the pending request when the main frame navigates or reloads', () => {
    const window = makeWindow();
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app: { quit: vi.fn() }, getMainWindow: () => window, sendHostMessage, platform: 'win32' });
    guard.attachWindow(window);

    window.trigger('close', makeEvent());
    const first = sendHostMessage.mock.calls[0][0];
    window.webContents.trigger('did-start-navigation', { isMainFrame: true, isSameDocument: false, url: 'app://reload' });
    expect(guard.confirm(first)).toBe(false);

    window.trigger('close', makeEvent());
    const second = sendHostMessage.mock.calls[1][0];
    expect(second.requestId).not.toBe(first.requestId);
  });

  it('ignores same-document and subframe navigations', () => {
    const window = makeWindow();
    const sendHostMessage = vi.fn();
    const app = { quit: vi.fn() };
    const guard = createNativeCloseGuard({ app, getMainWindow: () => window, sendHostMessage, platform: 'win32' });
    guard.attachWindow(window);

    window.trigger('close', makeEvent());
    const request = sendHostMessage.mock.calls[0][0];
    window.webContents.trigger('did-start-navigation', { isMainFrame: true, isSameDocument: true });
    window.webContents.trigger('did-start-navigation', { isMainFrame: false, isSameDocument: false });
    expect(guard.confirm(request)).toBe(true);
    expect(app.quit).toHaveBeenCalledTimes(1);
  });

  it('allows close immediately when the renderer is crashed, destroyed, or still loading', () => {
    for (const state of ['crashed', 'destroyed', 'loading'] as const) {
      const window = makeWindow();
      if (state === 'crashed') window.webContents.isCrashed = () => true;
      if (state === 'destroyed') window.webContents.isDestroyed = () => true;
      if (state === 'loading') window.webContents.isLoading = () => true;
      const app = { quit: vi.fn() };
      const sendHostMessage = vi.fn();
      const guard = createNativeCloseGuard({ app, getMainWindow: () => window, sendHostMessage, platform: 'win32' });
      guard.attachWindow(window);

      window.trigger('close', makeEvent());
      expect(sendHostMessage).not.toHaveBeenCalled();
      expect(app.quit).toHaveBeenCalledTimes(1);
    }
  });

  it('asks natively when the renderer is unresponsive during a pending close', async () => {
    const window = makeWindow();
    const app = { quit: vi.fn() };
    const dialog = { showMessageBox: vi.fn(async () => ({ response: 0 })) };
    const guard = createNativeCloseGuard({ app, dialog, getMainWindow: () => window, sendHostMessage: vi.fn(), platform: 'win32' });
    guard.attachWindow(window);

    window.trigger('close', makeEvent());
    window.trigger('unresponsive');
    await vi.waitFor(() => expect(app.quit).toHaveBeenCalledTimes(1));
    expect(dialog.showMessageBox).toHaveBeenCalledTimes(1);
  });

  it('falls back to a native prompt when close is repeated after the renderer did not answer in time', async () => {
    vi.useFakeTimers();
    try {
      const window = makeWindow();
      const app = { quit: vi.fn() };
      const dialog = { showMessageBox: vi.fn(async () => ({ response: 1 })) };
      const sendHostMessage = vi.fn();
      const guard = createNativeCloseGuard({ app, dialog, getMainWindow: () => window, sendHostMessage, platform: 'win32', responseTimeoutMs: 10000 });
      guard.attachWindow(window);

      window.trigger('close', makeEvent());
      vi.advanceTimersByTime(10001);
      window.trigger('close', makeEvent());
      expect(dialog.showMessageBox).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      await Promise.resolve();
      expect(app.quit).not.toHaveBeenCalled();

      // Cancel in the native prompt clears the stale request; the next close starts fresh.
      window.trigger('close', makeEvent());
      const last = sendHostMessage.mock.calls.at(-1)[0];
      expect(last.requestId).not.toBe(sendHostMessage.mock.calls[0][0].requestId);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores stale or mismatched renderer confirmations', () => {
    const window = makeWindow();
    const app = { quit: vi.fn() };
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app, getMainWindow: () => window, sendHostMessage, platform: 'win32' });
    guard.requestAppQuit();
    const request = sendHostMessage.mock.calls[0][0];

    expect(guard.confirm({ ...request, requestId: 'wrong' })).toBe(false);
    expect(guard.confirm({ ...request, intent: 'window' })).toBe(false);
    expect(app.quit).not.toHaveBeenCalled();
  });
});
