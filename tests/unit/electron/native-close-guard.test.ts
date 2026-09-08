import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createNativeCloseGuard } = require('../../../electron/core/native-close-guard.js');

function makeWindow() {
  const handlers: Record<string, Function[]> = {};
  return {
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

  it('routes tray quit through the same renderer approval request', () => {
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

  it('lets the already-guarded renderer title-bar close pass without another prompt', () => {
    const window = makeWindow();
    const app = { quit: vi.fn() };
    const sendHostMessage = vi.fn();
    const guard = createNativeCloseGuard({ app, getMainWindow: () => window, sendHostMessage, platform: 'win32' });
    guard.attachWindow(window);

    guard.closeApprovedWindow();
    expect(window.close).toHaveBeenCalledTimes(1);

    const event = makeEvent();
    window.trigger('close', event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(sendHostMessage).not.toHaveBeenCalled();

    expect(guard.handleBeforeQuit(makeEvent())).toBe(true);
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
