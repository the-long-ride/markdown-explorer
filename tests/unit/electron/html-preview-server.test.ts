import { afterEach, describe, expect, test } from 'vitest';

const { createHtmlPreviewServer, injectLifecycleScript } = require('../../../electron/core/html-preview-server.js');

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
});
