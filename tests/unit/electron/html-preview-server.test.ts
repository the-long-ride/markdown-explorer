import { afterEach, describe, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const { createHtmlPreviewServer, injectLifecycleScript, MAX_DOCUMENT_BYTES } = require('../../../electron/core/html-preview-server.js');

const activeServers: Array<{ dispose(): Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(activeServers.splice(0).map((server) => server.dispose()));
});

describe('html preview server', () => {
  test('injects heartbeat and close lifecycle requests', () => {
    const html = injectLifecycleScript('<!doctype html><body>Hello</body>', 'abc-token');
    expect(html).toContain('/heartbeat/');
    expect(html).toContain('/close/');
    expect(html).toContain('abc-token');
    expect(html.indexOf('data-mdn-preview-session')).toBeLessThan(html.indexOf('</body>'));
  });


  test('injects lifecycle code before a headless CSP meta element', () => {
    const html = injectLifecycleScript(`<html><meta http-equiv="Content-Security-Policy" content="script-src 'none'"><body>Preview</body></html>`, 'abc-token');
    expect(html.indexOf('data-mdn-preview-session')).toBeLessThan(html.indexOf('Content-Security-Policy'));
  });

  test('serves an in-memory document and removes it on close', async () => {
    const server = createHtmlPreviewServer({ randomUUID: () => 'fixed-token' });
    activeServers.push(server);
    const opened: string[] = [];
    const url = await server.open('<!doctype html><body>Preview</body>', async (value: string) => opened.push(value));

    expect(url).toBe(opened[0]);
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/preview\/fixed-token$/);
    expect(server.sessionCount).toBe(1);

    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Preview');

    const closeResponse = await fetch(url.replace('/preview/', '/close/'), { method: 'POST' });
    expect(closeResponse.status).toBe(204);
    expect(server.sessionCount).toBe(0);
  });

  test('expires sessions without a heartbeat', async () => {
    let clock = 100;
    const server = createHtmlPreviewServer({
      randomUUID: () => 'expiring-token',
      now: () => clock,
      heartbeatTimeoutMs: 50,
      cleanupIntervalMs: 10_000,
    });
    activeServers.push(server);
    await server.open('<body>Preview</body>', async () => {});
    clock = 151;
    server.pruneSessions();
    expect(server.sessionCount).toBe(0);
  });

  test('shares a listening server, reports absent sessions, and caps a live preview lifetime', async () => {
    let clock = 100;
    let token = 0;
    const server = createHtmlPreviewServer({
      randomUUID: () => `token-${++token}`, now: () => clock, heartbeatTimeoutMs: 10, maxLifetimeMs: 15,
    });
    activeServers.push(server);
    const open = vi.fn();
    const [first, second] = await Promise.all([
      server.open('<html><head></head><body>One</body></html>', open),
      server.open('<body>Two</body>', open),
    ]);
    expect(first).not.toBe(second);
    expect(new URL(first).origin).toBe(server.origin);
    const firstResponse = await fetch(first);
    expect(firstResponse.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await firstResponse.text()).toContain('<head><script data-mdn-preview-session>');
    expect((await fetch(server.origin)).status).toBe(404);
    expect((await fetch(first.replace('token-1', 'missing'))).status).toBe(404);
    expect((await fetch(first.replace('/preview/token-1', '/heartbeat/missing'), { method: 'POST' })).status).toBe(404);
    clock = 109;
    expect((await fetch(first.replace('/preview/', '/heartbeat/'), { method: 'POST' })).status).toBe(204);
    clock = 111;
    server.pruneSessions();
    expect(server.sessionCount).toBe(1);
    clock = 116;
    server.pruneSessions();
    expect(server.sessionCount).toBe(0);
  });

  test('rejects blank, malformed, and oversized documents without starting a listener', async () => {
    const createServer = vi.fn();
    const server = createHtmlPreviewServer({ createServer });
    const launch = vi.fn();
    for (const input of [null, ' ']) {
      await expect(server.open(input, launch)).rejects.toThrow(TypeError);
    }
    await expect(server.open('é'.repeat(MAX_DOCUMENT_BYTES / 2 + 1), launch)).rejects.toThrow(RangeError);
    await server.dispose();
    expect(createServer).not.toHaveBeenCalled();
    expect(launch).not.toHaveBeenCalled();
  });

  test('removes a preview when opening its browser window fails', async () => {
    const server = createHtmlPreviewServer();
    activeServers.push(server);
    const launch = vi.fn().mockRejectedValue(new Error('cannot open browser'));
    await expect(server.open('<body>Preview</body>', launch)).rejects.toThrow('cannot open browser');
    expect(server.sessionCount).toBe(0);
    expect((await fetch(launch.mock.calls[0][0])).status).toBe(404);
  });

  test.each([null, 'named-pipe', new Error('bind failed')])('does not open an unavailable preview listener (%s)', async (address) => {
    const listener = Object.assign(new EventEmitter(), {
      listen: vi.fn(() => address instanceof Error ? listener.emit('error', address) : listener.emit('listening')),
      address: vi.fn(() => address), close: (callback: () => void) => callback(),
    });
    const server = createHtmlPreviewServer({ createServer: () => listener });
    activeServers.push(server);
    const launch = vi.fn();
    await expect(server.open('<body>Preview</body>', launch)).rejects.toThrow(address instanceof Error ? 'bind failed' : 'preview server address');
    expect(launch).not.toHaveBeenCalled();
  });
});
