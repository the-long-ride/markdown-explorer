import { afterEach, describe, expect, test, vi } from 'vitest';
import { HtmlPreviewServer } from '../../../vscode/src/core/htmlPreviewServer';

describe('VS Code HTML preview server', () => {
  const openExternal = vi.fn(async (_url: string) => {});
  let server: HtmlPreviewServer;

  afterEach(async () => {
    await server?.dispose();
  });

  test('serves simultaneous previews on one loopback server and closes sessions independently', async () => {
    server = new HtmlPreviewServer(openExternal);
    const [first, second] = await Promise.all([
      server.open('<html><head></head><body>First</body></html>'),
      server.open('<html lang="en"><body>Second</body></html>'),
    ]);
    const third = await server.open('<p>Fragment</p>');
    const origin = new URL(first).origin;
    expect(origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(new URL(second).origin).toBe(origin);
    expect(new URL(third).origin).toBe(origin);
    expect(openExternal).toHaveBeenCalledTimes(3);
    for (const url of [first, second, third]) expect(openExternal).toHaveBeenCalledWith(url);
    expect(new Set([first, second, third]).size).toBe(3);

    const page = await fetch(first);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(page.headers.get('cache-control')).toContain('no-store');
    expect(await page.text()).toContain('<head><script data-mdn-preview-session>');
    expect(await (await fetch(second)).text()).toContain('<html lang="en"><script data-mdn-preview-session>');
    expect(await (await fetch(third)).text()).toMatch(/^<script data-mdn-preview-session>.*<p>Fragment<\/p>$/);

    const heartbeat = first.replace('/preview/', '/heartbeat/');
    const close = first.replace('/preview/', '/close/');
    expect((await fetch(heartbeat, { method: 'POST' })).status).toBe(204);
    expect((await fetch(close, { method: 'POST' })).status).toBe(204);
    expect((await fetch(heartbeat, { method: 'POST' })).status).toBe(404);
    expect(await (await fetch(first)).text()).toBe('Preview expired');
    expect((await fetch(second)).status).toBe(200);
    expect(await (await fetch(origin)).text()).toBe('Not found');
  });

  test('rejects missing and oversized documents before launching a browser', async () => {
    server = new HtmlPreviewServer(openExternal);
    await expect(server.open(null as unknown as string)).rejects.toThrow(TypeError);
    await expect(server.open(' \n')).rejects.toThrow(TypeError);
    await expect(server.open('é'.repeat(4 * 1024 * 1024 + 1))).rejects.toThrow(RangeError);
    expect(openExternal).not.toHaveBeenCalled();
  });

  test('invalidates the preview URL when opening the browser fails', async () => {
    const error = new Error('browser unavailable');
    server = new HtmlPreviewServer(openExternal);
    openExternal.mockRejectedValueOnce(error);
    await expect(server.open('<p>Failed</p>')).rejects.toBe(error);
    const [url] = openExternal.mock.calls[0];
    expect(await (await fetch(url)).text()).toBe('Preview expired');
  });

  test('expires idle sessions while retaining sessions with a recent heartbeat', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    server = new HtmlPreviewServer(openExternal);
    const idle = await server.open('<p>Idle</p>');
    const active = await server.open('<p>Active</p>');
    vi.advanceTimersByTime(90_000);
    const heartbeat = active.replace('/preview/', '/heartbeat/');
    expect((await fetch(heartbeat, { method: 'POST' })).status).toBe(204);
    vi.advanceTimersByTime(45_000);
    expect((await fetch(idle)).status).toBe(404);
    expect((await fetch(active)).status).toBe(200);
    await server.dispose();
  });
});
