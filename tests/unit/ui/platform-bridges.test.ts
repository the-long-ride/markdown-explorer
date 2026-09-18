import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createChromeBridge } from '../../../ui/src/platform/chrome';
import { createElectronBridge } from '../../../ui/src/platform/electron';
import { createVsCodeBridge } from '../../../ui/src/platform/vscode';

describe('createChromeBridge', () => {
  beforeEach(() => {
    delete (window as any).__chromeExtBus;
  });

  test('throws without __chromeExtBus', () => {
    expect(() => createChromeBridge()).toThrow('__chromeExtBus');
  });

  test('returns bridge with all methods when bus exists', () => {
    (window as any).__chromeExtBus = new EventTarget();
    const bridge = createChromeBridge();
    expect(typeof bridge.postMessage).toBe('function');
    expect(typeof bridge.onMessage).toBe('function');
    expect(typeof bridge.getState).toBe('function');
    expect(typeof bridge.setState).toBe('function');
    expect(typeof bridge.copyToClipboard).toBe('function');
  });

  test('postMessage dispatches CustomEvent on bus', () => {
    const bus = new EventTarget();
    (window as any).__chromeExtBus = bus;
    const bridge = createChromeBridge();
    let received: any;
    bus.addEventListener('webview-message', (e: any) => { received = e.detail; });
    bridge.postMessage({ command: 'test' });
    expect(received).toEqual({ command: 'test' });
  });

  test('onMessage listens for host-message on bus', () => {
    const bus = new EventTarget();
    (window as any).__chromeExtBus = bus;
    const bridge = createChromeBridge();
    let received: any;
    const unsub = bridge.onMessage((msg) => { received = msg; });
    bus.dispatchEvent(new CustomEvent('host-message', { detail: { command: 'update' } }));
    expect(received).toEqual({ command: 'update' });
    unsub();
  });

  test('onMessage unsubscribe stops receiving', () => {
    const bus = new EventTarget();
    (window as any).__chromeExtBus = bus;
    const bridge = createChromeBridge();
    let count = 0;
    const unsub = bridge.onMessage(() => { count++; });
    unsub();
    bus.dispatchEvent(new CustomEvent('host-message', { detail: {} }));
    expect(count).toBe(0);
  });

  test('getState reads from localStorage', () => {
    (window as any).__chromeExtBus = new EventTarget();
    localStorage.setItem('markdown-explorer-chrome-state', JSON.stringify({ a: 1 }));
    const bridge = createChromeBridge();
    expect(bridge.getState()).toEqual({ a: 1 });
  });

  test('setState writes to localStorage', () => {
    (window as any).__chromeExtBus = new EventTarget();
    const bridge = createChromeBridge();
    bridge.setState({ b: 2 });
    expect(JSON.parse(localStorage.getItem('markdown-explorer-chrome-state')!)).toEqual({ b: 2 });
  });

  test('getState with invalid JSON returns undefined', () => {
    (window as any).__chromeExtBus = new EventTarget();
    localStorage.setItem('markdown-explorer-chrome-state', 'not-json{{');
    const bridge = createChromeBridge();
    expect(bridge.getState()).toBeUndefined();
  });

  test('setState with error silently catches', () => {
    (window as any).__chromeExtBus = new EventTarget();
    const bridge = createChromeBridge();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => bridge.setState({ x: 1 })).not.toThrow();
    spy.mockRestore();
  });

  test('copyToClipboard calls navigator.clipboard.writeText', () => {
    (window as any).__chromeExtBus = new EventTarget();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const bridge = createChromeBridge();
    bridge.copyToClipboard('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
  });
});

describe('createElectronBridge', () => {
  beforeEach(() => {
    delete (window as any).electronAPI;
  });

  test('throws without electronAPI', () => {
    expect(() => createElectronBridge()).toThrow('electronAPI');
  });

  test('returns bridge when API exists', () => {
    (window as any).electronAPI = { postMessage: vi.fn(), onMessage: vi.fn() };
    const bridge = createElectronBridge();
    expect(typeof bridge.postMessage).toBe('function');
    expect(typeof bridge.onMessage).toBe('function');
  });

  test('postMessage calls api.postMessage', () => {
    const postMessage = vi.fn();
    (window as any).electronAPI = { postMessage, onMessage: vi.fn() };
    const bridge = createElectronBridge();
    bridge.postMessage({ command: 'open' });
    expect(postMessage).toHaveBeenCalledWith({ command: 'open' });
  });

  test('onMessage calls api.onMessage and returns unsubscribe', () => {
    const unsub = vi.fn();
    const onMessage = vi.fn().mockReturnValue(unsub);
    (window as any).electronAPI = { postMessage: vi.fn(), onMessage };
    const bridge = createElectronBridge();
    const handler = vi.fn();
    const result = bridge.onMessage(handler);
    expect(onMessage).toHaveBeenCalledWith(handler);
    expect(typeof result).toBe('function');
  });

  test('getState reads from localStorage', () => {
    (window as any).electronAPI = { postMessage: vi.fn(), onMessage: vi.fn() };
    localStorage.setItem('markdown-explorer-ui-state', JSON.stringify({ x: 42 }));
    const bridge = createElectronBridge();
    expect(bridge.getState()).toEqual({ x: 42 });
  });

  test('setState writes to localStorage', () => {
    (window as any).electronAPI = { postMessage: vi.fn(), onMessage: vi.fn() };
    const bridge = createElectronBridge();
    bridge.setState({ y: 99 });
    expect(JSON.parse(localStorage.getItem('markdown-explorer-ui-state')!)).toEqual({ y: 99 });
  });

  test('copyToClipboard posts copyCode message', () => {
    const postMessage = vi.fn();
    (window as any).electronAPI = { postMessage, onMessage: vi.fn() };
    const bridge = createElectronBridge();
    bridge.copyToClipboard('copy-me');
    expect(postMessage).toHaveBeenCalledWith({ command: 'copyCode', text: 'copy-me' });
  });
});

describe('createVsCodeBridge', () => {
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      postMessage: vi.fn(),
      getState: vi.fn(),
      setState: vi.fn(),
    };
    vi.stubGlobal('acquireVsCodeApi', () => mockApi);
  });

  afterEach(() => {
    (globalThis as any).acquireVsCodeApi = undefined;
  });

  test('returns bridge with all methods', () => {
    const bridge = createVsCodeBridge();
    expect(typeof bridge.postMessage).toBe('function');
    expect(typeof bridge.onMessage).toBe('function');
    expect(typeof bridge.getState).toBe('function');
    expect(typeof bridge.setState).toBe('function');
    expect(typeof bridge.copyToClipboard).toBe('function');
  });

  test('postMessage calls api.postMessage', () => {
    const bridge = createVsCodeBridge();
    bridge.postMessage({ command: 'navigate' });
    expect(mockApi.postMessage).toHaveBeenCalledWith({ command: 'navigate' });
  });

  test('onMessage filters messages with command property', () => {
    const bridge = createVsCodeBridge();
    const handler = vi.fn();
    bridge.onMessage(handler);
    window.dispatchEvent(new MessageEvent('message', { data: { command: 'update' } }));
    expect(handler).toHaveBeenCalledWith({ command: 'update' });
  });

  test('onMessage ignores messages without command property', () => {
    const bridge = createVsCodeBridge();
    const handler = vi.fn();
    bridge.onMessage(handler);
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'resize' } }));
    expect(handler).not.toHaveBeenCalled();
  });

  test('onMessage returns unsubscribe function', () => {
    const bridge = createVsCodeBridge();
    const handler = vi.fn();
    const unsub = bridge.onMessage(handler);
    unsub();
    window.dispatchEvent(new MessageEvent('message', { data: { command: 'x' } }));
    expect(handler).not.toHaveBeenCalled();
  });

  test('getState delegates to api.getState', () => {
    mockApi.getState.mockReturnValue({ foo: 'bar' });
    const bridge = createVsCodeBridge();
    expect(bridge.getState()).toEqual({ foo: 'bar' });
  });

  test('setState delegates to api.setState', () => {
    const bridge = createVsCodeBridge();
    bridge.setState({ foo: 'bar' });
    expect(mockApi.setState).toHaveBeenCalledWith({ foo: 'bar' });
  });

  test('copyToClipboard posts copyCode message', () => {
    const bridge = createVsCodeBridge();
    bridge.copyToClipboard('txt');
    expect(mockApi.postMessage).toHaveBeenCalledWith({ command: 'copyCode', text: 'txt' });
  });
});
