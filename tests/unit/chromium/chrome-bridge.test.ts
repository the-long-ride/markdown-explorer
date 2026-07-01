import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createChromeBridge } from '../../../ui/src/platform/chrome';

describe('createChromeBridge', () => {
  let bus: EventTarget;

  beforeEach(() => {
    bus = new EventTarget();
    (globalThis as any).window = { __chromeExtBus: bus, localStorage: {} };
    (globalThis as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    } as any;
    (globalThis as any).navigator = {
      clipboard: { writeText: () => Promise.resolve() },
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
    delete (globalThis as any).navigator;
  });

  it('throws when __chromeExtBus is missing', () => {
    (globalThis as any).window = {};
    expect(() => createChromeBridge()).toThrow('__chromeExtBus is not available');
  });

  it('creates bridge when bus is present', () => {
    const bridge = createChromeBridge();
    expect(bridge).toBeDefined();
    expect(typeof bridge.postMessage).toBe('function');
    expect(typeof bridge.onMessage).toBe('function');
    expect(typeof bridge.getState).toBe('function');
    expect(typeof bridge.setState).toBe('function');
    expect(typeof bridge.copyToClipboard).toBe('function');
  });

  it('postMessage dispatches webview-message on bus', () => {
    const bridge = createChromeBridge();
    const received: any[] = [];
    bus.addEventListener('webview-message', ((e: Event) => {
      received.push((e as CustomEvent).detail);
    }) as EventListener);
    bridge.postMessage({ command: 'ready' } as any);
    expect(received).toHaveLength(1);
    expect(received[0].command).toBe('ready');
  });

  it('onMessage receives host-message from bus', () => {
    const bridge = createChromeBridge();
    const received: any[] = [];
    bridge.onMessage((msg) => received.push(msg));
    bus.dispatchEvent(new CustomEvent('host-message', { detail: { command: 'readyAck' } }));
    expect(received).toHaveLength(1);
    expect(received[0].command).toBe('readyAck');
  });

  it('onMessage unsubscribe stops receiving messages', () => {
    const bridge = createChromeBridge();
    const received: any[] = [];
    const unsub = bridge.onMessage((msg) => received.push(msg));
    bus.dispatchEvent(new CustomEvent('host-message', { detail: { command: 'a' } }));
    expect(received).toHaveLength(1);
    unsub();
    bus.dispatchEvent(new CustomEvent('host-message', { detail: { command: 'b' } }));
    expect(received).toHaveLength(1);
  });

  it('getState returns undefined when no state stored', () => {
    const bridge = createChromeBridge();
    expect(bridge.getState()).toBeUndefined();
  });

  it('setState stores and getState retrieves', () => {
    (globalThis as any).localStorage = {
     getItem: (key: string) => key === 'markdown-explorer-chrome-state' ? JSON.stringify({ foo: 'bar' }) : null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    } as any;
    const bridge = createChromeBridge();
    bridge.setState({ foo: 'bar' });
    const state = bridge.getState<{ foo: string }>();
    expect(state).toBeDefined();
    expect(state!.foo).toBe('bar');
  });

  it('getState returns undefined on invalid JSON', () => {
    (globalThis as any).localStorage = {
      getItem: () => 'not-json{{{',
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    } as any;
    const bridge = createChromeBridge();
    expect(bridge.getState()).toBeUndefined();
  });

  it('copyToClipboard calls navigator.clipboard.writeText', () => {
    const writeText = (..._args: any[]) => Promise.resolve();
    (globalThis as any).navigator = { clipboard: { writeText } };
    const bridge = createChromeBridge();
    expect(() => bridge.copyToClipboard('test')).not.toThrow();
  });
});
