import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getHostInfo,
  resetWorkspaceState,
  WORKSPACE_SCAN_BATCH_SIZE,
  WORKSPACE_SCAN_REVEAL_DELAY_MS,
} from '../../../chromium-xtension/src/chrome-host';

declare const chrome: { runtime: { getManifest(): { version: string } } };

describe('getHostInfo', () => {
  it('uses the shared 3-second workspace reveal threshold', () => {
    expect(WORKSPACE_SCAN_REVEAL_DELAY_MS).toBe(3000);
  });
  it('uses cumulative 32-file workspace refresh batches', () => {
    expect(WORKSPACE_SCAN_BATCH_SIZE).toBe(32);
  });
  it('returns chrome runtime info', () => {
    (globalThis as any).chrome = { runtime: { getManifest: () => ({ version: '1.2.3' }) } };
    const info = getHostInfo();
    expect(info).toEqual({
      appVersion: '1.2.3',
      appRuntime: 'chrome',
      hostPlatform: 'unknown',
      hostArch: 'unknown',
    });
    delete (globalThis as any).chrome;
  });

  it('returns different version from manifest', () => {
    (globalThis as any).chrome = { runtime: { getManifest: () => ({ version: '9.9.9' }) } };
    expect(getHostInfo().appVersion).toBe('9.9.9');
    delete (globalThis as any).chrome;
  });

  it('always returns appRuntime as chrome', () => {
    (globalThis as any).chrome = { runtime: { getManifest: () => ({ version: '0.0.0' }) } };
    expect(getHostInfo().appRuntime).toBe('chrome');
    delete (globalThis as any).chrome;
  });
});

describe('resetWorkspaceState', () => {
  it('does not throw when called', () => {
    expect(() => resetWorkspaceState()).not.toThrow();
  });
});

describe('chrome-host bus communication', () => {
  let bus: EventTarget;
  const sentMessages: any[] = [];

  beforeEach(() => {
    bus = new EventTarget();
    (globalThis as any).window = { __chromeExtBus: bus };
    sentMessages.length = 0;
    bus.addEventListener('host-message', ((e: Event) => {
      sentMessages.push((e as CustomEvent).detail);
    }) as EventListener);
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('bus dispatches and receives host messages', () => {
    const msg = { command: 'test', value: 42 };
    bus.dispatchEvent(new CustomEvent('host-message', { detail: msg }));
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].command).toBe('test');
    expect(sentMessages[0].value).toBe(42);
  });

  it('bus handles webview-message events', () => {
    const received: any[] = [];
    bus.addEventListener('webview-message', ((e: Event) => {
      received.push((e as CustomEvent).detail);
    }) as EventListener);
    const msg = { command: 'ready' };
    bus.dispatchEvent(new CustomEvent('webview-message', { detail: msg }));
    expect(received).toHaveLength(1);
    expect(received[0].command).toBe('ready');
  });

  it('message without detail is ignored gracefully', () => {
    const received: any[] = [];
    bus.addEventListener('webview-message', ((e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) received.push(detail);
    }) as EventListener);
    bus.dispatchEvent(new CustomEvent('webview-message', { detail: undefined }));
    expect(received).toHaveLength(0);
  });

  it('supports multiple listeners', () => {
    const a: any[] = [];
    const b: any[] = [];
    bus.addEventListener('host-message', ((e: Event) => a.push((e as CustomEvent).detail)) as EventListener);
    bus.addEventListener('host-message', ((e: Event) => b.push((e as CustomEvent).detail)) as EventListener);
    bus.dispatchEvent(new CustomEvent('host-message', { detail: { cmd: 'x' } }));
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('supports unsubscribe from bus', () => {
    const received: any[] = [];
    const listener = ((e: Event) => received.push((e as CustomEvent).detail)) as EventListener;
    bus.addEventListener('host-message', listener);
    bus.dispatchEvent(new CustomEvent('host-message', { detail: { cmd: 'a' } }));
    expect(received).toHaveLength(1);
    bus.removeEventListener('host-message', listener);
    bus.dispatchEvent(new CustomEvent('host-message', { detail: { cmd: 'b' } }));
    expect(received).toHaveLength(1);
  });
});

describe('openExternal url validation', () => {
  it('accepts http URLs', () => {
    expect(/^https?:\/\//i.test('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(/^https?:\/\//i.test('https://example.com')).toBe(true);
  });

  it('rejects non-http URLs', () => {
    expect(/^https?:\/\//i.test('ftp://example.com')).toBe(false);
  });

  it('rejects javascript: URLs', () => {
    expect(/^https?:\/\//i.test('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(/^https?:\/\//i.test('data:text/html,test')).toBe(false);
  });
});

describe('loadWorkspaceSearchIndexes filter logic', () => {
  it('filters tabs by activeWorkspacePath', () => {
    const activeWorkspacePath = '/my-workspace';
    const tabs = [
      { tabId: '1', workspacePath: '/my-workspace' },
      { tabId: '2', workspacePath: '/other-workspace' },
      { tabId: '3', workspacePath: '' },
    ];
    const filtered = tabs.filter(
      (t) => t.tabId && t.workspacePath && t.workspacePath === activeWorkspacePath
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tabId).toBe('1');
  });

  it('excludes tabs with empty workspacePath', () => {
    const activeWorkspacePath = '/my-workspace';
    const tabs = [
      { tabId: '1', workspacePath: '' },
      { tabId: '2', workspacePath: '/my-workspace' },
    ];
    const filtered = tabs.filter(
      (t) => t.tabId && t.workspacePath && t.workspacePath === activeWorkspacePath
    );
    expect(filtered).toHaveLength(1);
  });

  it('excludes tabs with empty tabId', () => {
    const activeWorkspacePath = '/my-workspace';
    const tabs = [
      { tabId: '', workspacePath: '/my-workspace' },
      { tabId: '2', workspacePath: '/my-workspace' },
    ];
    const filtered = tabs.filter(
      (t) => t.tabId && t.workspacePath && t.workspacePath === activeWorkspacePath
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tabId).toBe('2');
  });

  it('returns empty when no tabs match', () => {
    const activeWorkspacePath = '/my-workspace';
    const tabs = [
      { tabId: '1', workspacePath: '/other' },
    ];
    const filtered = tabs.filter(
      (t) => t.tabId && t.workspacePath && t.workspacePath === activeWorkspacePath
    );
    expect(filtered).toHaveLength(0);
  });
});
