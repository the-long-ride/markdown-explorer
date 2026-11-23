import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';

const require = createRequire(import.meta.url);
const { createExternalLinkChecker, createExternalLinkHost, isPrivateAddress, parseRetryAfter } = require('../../../electron/core/runtime-insights-external.js');

function response(status: number, headers: Record<string, string> = {}) {
  return { status, headers };
}

describe('Electron Insights external link checker', () => {
  it('refuses a private DNS result before opening a connection', async () => {
    const resolveHost = vi.fn(async () => ['127.0.0.1']);
    const request = vi.fn();
    const checker = createExternalLinkChecker({ resolveHost, request });

    const result = await checker.check('http://example.test/', {
      requestId: 'private', timeoutMs: 1000, approvedPrivateOrigins: [],
    });

    expect(result).toMatchObject({
      status: 'unchecked',
      requiresPrivateOriginConfirmation: true,
      privateOrigin: 'http://example.test',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('pins the validated address and revalidates every redirect target', async () => {
    const resolveHost = vi.fn(async (host: string) => host === 'public.test' ? ['203.0.113.10'] : ['10.0.0.8']);
    const request = vi.fn(async ({ url, address }: any) => {
      expect(address).toBe('203.0.113.10');
      expect(url).toBe('https://public.test/');
      return response(302, { location: 'http://private.test/' });
    });
    const checker = createExternalLinkChecker({ resolveHost, request });

    const result = await checker.check('https://public.test/', {
      requestId: 'redirect', timeoutMs: 1000, approvedPrivateOrigins: [],
    });

    expect(result).toMatchObject({
      status: 'unchecked',
      requiresPrivateOriginConfirmation: true,
      privateOrigin: 'http://private.test',
    });
    expect(resolveHost).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    [200, 'reachable'], [302, 'reachable'], [401, 'reachable-auth-required'], [403, 'reachable-auth-required'],
    [404, 'broken'], [410, 'broken'], [429, 'rate-limited'], [503, 'server-error'],
  ])('classifies HTTP %i as %s', async (status, expected) => {
    const checker = createExternalLinkChecker({
      resolveHost: vi.fn(async () => ['203.0.113.10']),
      request: vi.fn(async () => response(status as number)),
    });
    expect((await checker.check('https://public.test/', { requestId: String(status), timeoutMs: 1000 })).status).toBe(expected);
  });

  it('uses anonymous HEAD and falls back to bounded GET when HEAD is unsupported', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response(405))
      .mockResolvedValueOnce(response(200));
    const checker = createExternalLinkChecker({
      resolveHost: vi.fn(async () => ['203.0.113.10']),
      request,
    });

    const result = await checker.check('https://public.test/path', { requestId: 'fallback', timeoutMs: 1000 });

    expect(result.status).toBe('reachable');
    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: 'HEAD', address: '203.0.113.10', headers: expect.not.objectContaining({ cookie: expect.anything(), authorization: expect.anything() }),
    }));
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ method: 'GET', maxBodyBytes: 0 }));
  });

  it('marks HTTPS to HTTP redirects as an insecure downgrade', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response(302, { location: 'http://public.test/final' }))
      .mockResolvedValueOnce(response(200));
    const checker = createExternalLinkChecker({ resolveHost: vi.fn(async () => ['203.0.113.10']), request });
    const result = await checker.check('https://public.test/', { requestId: 'downgrade', timeoutMs: 1000 });
    expect(result).toMatchObject({ status: 'reachable', insecureDowngrade: true, finalUrl: 'http://public.test/final' });
  });

  it.each([
    ['0.1.2.3', true], ['10.1.2.3', true], ['100.63.0.1', false], ['100.64.0.1', true],
    ['100.128.0.1', false], ['169.254.0.1', true], ['169.253.0.1', false],
    ['172.15.0.1', false], ['172.16.0.1', true], ['172.32.0.1', false],
    ['192.168.0.1', true], ['192.167.0.1', false], ['198.18.0.1', true], ['198.19.0.1', true],
    ['198.20.0.1', false], ['224.0.0.1', true], ['::', true], ['::1', true],
    ['fc00::1', true], ['fd00::1', true], ['fe80::1%eth0', true], ['2001:db8::1', false],
    ['::ffff:127.0.0.1', true], ['::ffff:203.0.113.10', false], ['not-an-ip', true],
  ])('classifies destination %s as private=%s', (address, expected) => {
    expect(isPrivateAddress(address)).toBe(expected);
  });

  it.each([
    [undefined, undefined], ['1.25', 1250], ['invalid', undefined],
    ['Wed, 01 Jan 2025 00:00:05 GMT', 5000], ['Tue, 31 Dec 2024 23:59:59 GMT', 0],
  ])('interprets Retry-After %s', (header, delay) => {
    expect(parseRetryAfter(header, Date.UTC(2025, 0, 1))).toBe(delay);
  });

  it('does not contact unsupported URLs or unapproved localhost origins', async () => {
    const resolveHost = vi.fn().mockResolvedValue(['203.0.113.10']);
    const request = vi.fn().mockResolvedValue(response(200));
    const checker = createExternalLinkChecker({ resolveHost, request });
    await expect(checker.check()).resolves.toMatchObject({ reason: 'invalid-url' });
    await expect(checker.check('file:///document.md')).resolves.toMatchObject({ reason: 'unsupported-scheme' });
    expect(resolveHost).not.toHaveBeenCalled();
    for (const url of ['http://localhost./', 'https://docs.localhost/']) {
      await expect(checker.check(url)).resolves.toMatchObject({ reason: 'private-origin-confirmation-required' });
    }
    expect(request).not.toHaveBeenCalled();
    await expect(checker.check('https://docs.localhost/', { approvedPrivateOrigins: ['https://docs.localhost'] }))
      .resolves.toMatchObject({ status: 'reachable' });
  });

  it('distinguishes DNS errors, empty results, network errors, and cancellation', async () => {
    const resolveHost = vi.fn().mockResolvedValue(['203.0.113.10']);
    const request = vi.fn();
    const checker = createExternalLinkChecker({ resolveHost, request });
    const url = 'https://example.test/';
    resolveHost.mockRejectedValueOnce(new Error('DNS failed')).mockRejectedValueOnce('DNS string').mockRejectedValueOnce(null)
      .mockResolvedValueOnce(undefined).mockResolvedValueOnce([]);
    for (const reason of ['DNS failed', 'DNS string', 'dns-failure', 'dns-empty', 'dns-empty']) {
      await expect(checker.check(url)).resolves.toMatchObject({ status: 'unreachable', reason });
    }
    expect(request).not.toHaveBeenCalled();
    request.mockRejectedValueOnce(new Error('network failed')).mockRejectedValueOnce('network string').mockRejectedValueOnce(null)
      .mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
    for (const reason of ['network failed', 'network string', 'network-error']) {
      await expect(checker.check(url)).resolves.toMatchObject({ status: 'unreachable', reason });
    }
    await expect(checker.check(url)).resolves.toMatchObject({ status: 'unchecked', reason: 'cancelled' });
    const controller = new AbortController();
    request.mockImplementationOnce(() => {
      controller.abort();
      throw new Error('connection closed');
    });
    await expect(checker.check(url, { signal: controller.signal })).resolves.toMatchObject({ reason: 'cancelled' });
    await expect(checker.check(url, { signal: controller.signal })).resolves.toMatchObject({ reason: 'cancelled' });
    expect(request).toHaveBeenCalledTimes(5);
  });

  it.each([
    ['http://[', 'invalid-redirect'], ['file:///doc.md', 'unsupported-redirect-scheme'],
    ['/loop', 'redirect-limit'],
  ])('terminates redirect %s with %s', async (location, reason) => {
    const request = vi.fn().mockResolvedValue(response(302, { Location: location }));
    const checker = createExternalLinkChecker({ resolveHost: async () => ['203.0.113.10'], request });
    await expect(checker.check('http://example.test/')).resolves.toMatchObject({ reason, httpStatus: 302 });
    expect(request).toHaveBeenCalledTimes(reason === 'redirect-limit' ? 6 : 1);
  });

  it('retries a server error once, resets the retry after a redirect, and forwards rate-limit delays', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response(503)).mockResolvedValueOnce(response(302, { Location: '/next' }))
      .mockResolvedValueOnce(response(502)).mockResolvedValueOnce(response(429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce({ status: undefined, headers: undefined });
    const checker = createExternalLinkChecker({ resolveHost: async () => ['203.0.113.10'], request });
    await expect(checker.check('https://example.test/')).resolves.toMatchObject({
      status: 'rate-limited', retryAfterMs: 2000, finalUrl: 'https://example.test/next',
    });
    await expect(checker.check('https://example.test/')).resolves.toMatchObject({ status: 'unreachable', httpStatus: undefined });
  });
});

describe('Electron Insights anonymous HTTP transport', () => {
  function transport() {
    const client = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(), end: vi.fn(),
      destroy: vi.fn((error: Error) => client.emit('error', error)),
    });
    const dns = vi.spyOn(require('node:dns').promises, 'lookup').mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
    const http = vi.spyOn(require('node:http'), 'request').mockReturnValue(client);
    const https = vi.spyOn(require('node:https'), 'request').mockReturnValue(client);
    return { client, dns, http, https, checker: createExternalLinkChecker() };
  }

  it.each(['http', 'https'])('pins DNS results and discards response bodies over %s', async (protocol) => {
    const { client, dns, http, https, checker } = transport();
    const pending = checker.check(`${protocol}://example.test:8080/path?q=1`);
    const request = protocol === 'https' ? https : http;
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    const [options, callback] = request.mock.calls[0] as [any, Function];
    expect(dns).toHaveBeenCalledExactlyOnceWith('example.test', { all: true, verbatim: true });
    expect(options).toMatchObject({
      path: '/path?q=1', port: '8080', method: 'HEAD', agent: false, servername: protocol === 'https' ? 'example.test' : undefined,
      headers: { accept: '*/*', 'user-agent': 'Markdown Explorer/Insights' },
    });
    const lookupCallback = vi.fn();
    options.lookup('example.test', {}, lookupCallback);
    expect(lookupCallback).toHaveBeenCalledExactlyOnceWith(null, '203.0.113.10', 4);
    const reply = { statusCode: 200, headers: { 'Set-Cookie': ['one', 'two'], unused: null }, destroy: vi.fn() };
    callback(reply);
    callback(reply);
    client.emit('error', new Error('late failure'));
    expect(reply.destroy).toHaveBeenCalledOnce();
    await expect(pending).resolves.toMatchObject({ status: 'reachable' });
  });

  it('destroys requests on timeout and abort', async () => {
    const { client, https, checker } = transport();
    const timed = checker.check('https://example.test/', { timeoutMs: 17 });
    await vi.waitFor(() => expect(client.setTimeout).toHaveBeenCalledOnce());
    expect(https.mock.calls[0]?.[0]).toMatchObject({ port: undefined });
    expect(client.setTimeout).toHaveBeenCalledWith(17, expect.any(Function));
    client.setTimeout.mock.calls[0][1]();
    await expect(timed).resolves.toMatchObject({ status: 'unreachable', reason: 'ETIMEDOUT' });

    const controller = new AbortController();
    const inFlight = checker.check('https://example.test/', { signal: controller.signal });
    await vi.waitFor(() => expect(client.end).toHaveBeenCalledTimes(2));
    controller.abort();
    await expect(inFlight).resolves.toMatchObject({ status: 'unchecked', reason: 'cancelled' });
  });

  it('does not send a request if cancelled during DNS lookup', async () => {
    const { client, dns, checker } = transport();
    const controller = new AbortController();
    dns.mockImplementationOnce(async () => {
      controller.abort();
      return [{ address: '203.0.113.10', family: 4 }];
    });
    await expect(checker.check('http://example.test/', { signal: controller.signal })).resolves.toMatchObject({ reason: 'cancelled' });
    expect(client.destroy).toHaveBeenCalledOnce();
    expect(client.end).not.toHaveBeenCalled();
  });
});

describe('Electron Insights external link request queue', () => {
  function harness() {
    const pending: { url: string; signal: AbortSignal; finish: () => void }[] = [];
    const request = vi.fn(({ url, signal }) => new Promise(resolve => pending.push({ url, signal, finish: () => resolve(response(200)) })));
    const sendHostMessage = vi.fn();
    const host = createExternalLinkHost({ resolveHost: async () => ['203.0.113.10'], request, sendHostMessage });
    return { host, pending, request, sendHostMessage };
  }

  it('deduplicates URLs, limits global and per-origin concurrency, and reports invalid URLs', async () => {
    const { host, pending, sendHostMessage } = harness();
    const urls = ['https://a.test/1', 'https://a.test/2', 'https://a.test/3', 'https://b.test/1', 'https://c.test/1', 'bad-url'];
    const checking = host.checkExternalLinks({ requestId: 'batch', urls: [...urls, urls[0]] });
    await vi.waitFor(() => expect(pending.map(item => item.url)).toEqual([urls[0], urls[1], urls[3], urls[4]]));
    pending[3].finish();
    await vi.waitFor(() => expect(sendHostMessage).toHaveBeenCalledWith(expect.objectContaining({ url: 'bad-url', reason: 'invalid-url' })));
    expect(pending).toHaveLength(4);
    pending[0].finish();
    await vi.waitFor(() => expect(pending[4]?.url).toBe(urls[2]));
    pending.forEach(item => item.finish());
    await checking;
    expect(sendHostMessage).toHaveBeenCalledTimes(7);
    expect(sendHostMessage).toHaveBeenLastCalledWith({ command: 'externalLinkCheckComplete', requestId: 'batch', cancelled: false });
  });

  it('cancels a superseded batch and suppresses late results after cancellation and disposal', async () => {
    const { host, pending, sendHostMessage } = harness();
    const urls = ['https://a.test/1'];
    const first = host.checkExternalLinks({ requestId: 'batch', urls });
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    const second = host.checkExternalLinks({ requestId: 'batch', urls });
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0].signal.aborted).toBe(true);
    pending[0].finish();
    await first;
    host.cancelExternalLinkChecks({});
    host.cancelExternalLinkChecks({ requestId: 'batch' });
    expect(pending[1].signal.aborted).toBe(true);
    const third = host.checkExternalLinks({ urls });
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    host.dispose();
    expect(pending[2].signal.aborted).toBe(true);
    pending[1].finish();
    pending[2].finish();
    await Promise.all([second, third]);
    expect(sendHostMessage.mock.calls).toEqual([
      [{ command: 'externalLinkCheckComplete', requestId: 'batch', cancelled: true }],
      [{ command: 'externalLinkCheckComplete', requestId: 'batch', cancelled: true }],
      [{ command: 'externalLinkCheckComplete', requestId: '', cancelled: true }],
    ]);
    await expect(createExternalLinkHost().checkExternalLinks({})).resolves.toBeUndefined();
  });
});
