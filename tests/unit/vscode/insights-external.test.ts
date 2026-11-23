import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import {
  classifyExternalStatus, createInsightsExternalChecker, createInsightsExternalHost,
  GLOBAL_CONCURRENCY, isPrivateAddress, MAX_REDIRECTS, ORIGIN_CONCURRENCY,
} from '../../../vscode/src/core/panelInsightsExternal';

describe('VS Code Insights external link checker', () => {
  it('requires approval before connecting to private space', async () => {
    const request = vi.fn();
    const checker = createInsightsExternalChecker({
      resolveHost: vi.fn(async () => ['192.168.1.5']),
      request,
    });

    const result = await checker.check('https://router.test/', {
      requestId: 'private', timeoutMs: 1000, approvedPrivateOrigins: [],
    });

    expect(result).toMatchObject({
      status: 'unchecked',
      requiresPrivateOriginConfirmation: true,
      privateOrigin: 'https://router.test',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('connects to the already validated address and strips application credentials', async () => {
    const request = vi.fn(async () => ({ status: 204, headers: {} }));
    const checker = createInsightsExternalChecker({
      resolveHost: vi.fn(async () => ['203.0.113.15']),
      request,
    });

    const result = await checker.check('https://example.test/', { requestId: 'public', timeoutMs: 1000 });

    expect(result.status).toBe('reachable');
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      address: '203.0.113.15',
      headers: expect.not.objectContaining({ cookie: expect.anything(), authorization: expect.anything() }),
    }));
  });

  it('revalidates redirects and stops before a newly-private origin', async () => {
    const resolveHost = vi.fn(async (host: string) => host === 'a.test' ? ['203.0.113.15'] : ['169.254.1.1']);
    const request = vi.fn(async () => ({ status: 302, headers: { location: 'http://b.test/' } }));
    const checker = createInsightsExternalChecker({ resolveHost, request });

    const result = await checker.check('https://a.test/', { requestId: 'redirect', timeoutMs: 1000 });

    expect(result).toMatchObject({
      status: 'unchecked',
      requiresPrivateOriginConfirmation: true,
      privateOrigin: 'http://b.test',
      insecureDowngrade: true,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports network failures as unreachable', async () => {
    const checker = createInsightsExternalChecker({
      resolveHost: vi.fn(async () => ['203.0.113.15']),
      request: vi.fn(async () => { throw new Error('ETIMEDOUT'); }),
    });
    expect((await checker.check('https://example.test/', { requestId: 'timeout', timeoutMs: 10 })).status).toBe('unreachable');
  });

  it.each([
    ['0.0.0.0', true], ['10.1.2.3', true], ['127.0.0.1', true],
    ['100.63.0.1', false], ['100.64.0.1', true], ['100.127.0.1', true], ['100.128.0.1', false],
    ['169.254.0.1', true], ['169.253.0.1', false], ['172.15.0.1', false], ['172.16.0.1', true],
    ['172.32.0.1', false], ['192.169.1.1', false], ['198.18.0.1', true], ['198.19.0.1', true],
    ['198.20.0.1', false], ['224.0.0.1', true], ['::', true], ['::1', true], ['FC00::1', true],
    ['fd00::1', true], ['fe80::1%eth0', true], ['::ffff:127.0.0.1', true],
    ['::ffff:203.0.113.2', false], ['2001:db8::1', false], ['not-an-ip', true],
  ])('classifies address %s independently of DNS', (address, expected) => {
    expect(isPrivateAddress(address)).toBe(expected);
  });

  it.each([
    [0, 'unreachable'], [199, 'unreachable'], [200, 'reachable'], [399, 'reachable'],
    [401, 'reachable-auth-required'], [403, 'reachable-auth-required'], [404, 'broken'],
    [410, 'broken'], [429, 'rate-limited'], [499, 'unreachable'], [500, 'server-error'],
    [599, 'server-error'], [600, 'unreachable'],
  ])('classifies status %s', (status, expected) => {
    expect(classifyExternalStatus(status)).toBe(expected);
  });

  const session = { requestId: 'check', timeoutMs: 0 };
  const url = 'https://example.test/page';
  const publicDns = async () => ['203.0.113.20'];

  it('rejects invalid inputs, unsupported schemes and already-cancelled checks without DNS', async () => {
    const resolveHost = vi.fn(publicDns);
    const checker = createInsightsExternalChecker({ resolveHost, request: vi.fn() });
    await expect(checker.check('', session)).resolves.toMatchObject({ reason: 'invalid-url' });
    await expect(checker.check('mailto:friend@example.test', session)).resolves.toMatchObject({ reason: 'unsupported-scheme' });
    await expect(checker.check(url, { ...session, signal: AbortSignal.abort() })).resolves.toMatchObject({ reason: 'cancelled' });
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it.each([
    [async () => [], 'dns-empty'],
    [async () => { throw new Error('DNS offline'); }, 'DNS offline'],
    [async () => { throw 'no resolver'; }, 'no resolver'],
  ])('preserves DNS failure classification and reason', async (resolveHost, reason) => {
    const request = vi.fn();
    const checker = createInsightsExternalChecker({ resolveHost, request });
    await expect(checker.check(url, session)).resolves.toMatchObject({ status: 'unreachable', reason });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([405, 501])('uses GET after a %s HEAD response and records Retry-After', async (status) => {
    const request = vi.fn(async ({ method }) => method === 'HEAD'
      ? { status, headers: {} }
      : { status: 429, headers: { 'Retry-After': ['1.25'], 'X-Unset': undefined } });
    const checker = createInsightsExternalChecker({ resolveHost: publicDns, request });
    await expect(checker.check(url, session)).resolves.toMatchObject({ status: 'rate-limited', httpStatus: 429, retryAfterMs: 1250 });
    expect(request.mock.calls.map(([req]) => req.method)).toEqual(['HEAD', 'GET']);
    expect(request.mock.lastCall?.[0]).toMatchObject({ maxBodyBytes: 0, timeoutMs: 10000 });
  });

  it.each([
    ['Thu, 01 Jan 2026 00:00:02 GMT', 2000],
    ['Thu, 01 Jan 1970 00:00:00 GMT', 0],
    ['not a date', undefined],
    [undefined, undefined],
  ])('retries a transient response once and interprets Retry-After %s', async (retryAfter, retryAfterMs) => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const request = vi.fn(async () => ({ status: 503, headers: { 'retry-after': retryAfter } }));
    const checker = createInsightsExternalChecker({ resolveHost: publicDns, request });
    await expect(checker.check(url, session)).resolves.toMatchObject({ status: 'server-error', retryAfterMs });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['http://[', 'unreachable', 'invalid-redirect', 1],
    ['mailto:a@example.test', 'unsupported', 'unsupported-redirect-scheme', 1],
    ['/page', 'unreachable', 'redirect-limit', MAX_REDIRECTS + 1],
  ])('bounds redirect processing for %s', async (location, status, reason, requests) => {
    const request = vi.fn(async () => ({ status: 302, headers: { location } }));
    const checker = createInsightsExternalChecker({ resolveHost: publicDns, request });
    await expect(checker.check(url, session)).resolves.toMatchObject({ status, reason });
    expect(request).toHaveBeenCalledTimes(requests);
  });

  it.each([
    [new DOMException('aborted', 'AbortError'), 'unchecked', 'cancelled'],
    ['transport failed', 'unreachable', 'transport failed'],
  ])('distinguishes transport cancellation from failure', async (error, status, reason) => {
    const checker = createInsightsExternalChecker({
      resolveHost: publicDns, request: async () => { throw error; },
    });
    await expect(checker.check(url, session)).resolves.toMatchObject({ status, reason });
  });

  it('uses the default transport for an explicitly approved loopback origin', async () => {
    const handled = vi.fn();
    const server = createServer((request, response) => {
      handled(request.method, request.url);
      response.writeHead(request.method === 'HEAD' ? 405 : 429, { 'Retry-After': '2' });
      response.end();
    });
    server.listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing test server port');
      const localhost = `http://localhost:${address.port}`;
      const checker = createInsightsExternalChecker();
      await expect(checker.check(localhost, session)).resolves.toMatchObject({
        status: 'unchecked', privateOrigin: localhost,
      });
      expect(handled).not.toHaveBeenCalled();
      const origin = `http://127.0.0.1:${address.port}`;
      const approved = createInsightsExternalChecker({ resolveHost: async () => ['127.0.0.1'] });
      await expect(approved.check(`${origin}/a?b=1`, {
        ...session, approvedPrivateOrigins: [origin], signal: new AbortController().signal,
      })).resolves.toMatchObject({ status: 'rate-limited', retryAfterMs: 2000 });
      expect(handled.mock.calls).toEqual([['HEAD', '/a?b=1'], ['GET', '/a?b=1']]);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});

describe('VS Code Insights external link scheduling', () => {
  it('deduplicates checks and enforces per-origin and global concurrency limits', async () => {
    const gates: Array<ReturnType<typeof Promise.withResolvers<{ status: number; headers: Record<string, string> }>>> = [];
    const request = vi.fn(() => {
      const gate = Promise.withResolvers<{ status: number; headers: Record<string, string> }>();
      gates.push(gate);
      return gate.promise;
    });
    const postMessage = vi.fn();
    const host = createInsightsExternalHost({ resolveHost: async () => ['203.0.113.20'], request, postMessage });
    const urls = ['https://a.test/1', 'https://a.test/2', 'https://a.test/3', 'https://b.test/1', 'https://b.test/2', 'https://c.test/1'];
    const checking = host.checkExternalLinks({ requestId: 'run', urls: [...urls, urls[0], 'invalid'] });
    await vi.waitFor(() => expect(gates).toHaveLength(GLOBAL_CONCURRENCY));
    const origins = request.mock.calls.map(([req]) => new URL(req.url).hostname);
    expect(origins.filter(origin => origin === 'a.test')).toHaveLength(ORIGIN_CONCURRENCY);
    for (const gate of gates) gate.resolve({ status: 200, headers: {} });
    await vi.waitFor(() => expect(gates).toHaveLength(urls.length));
    for (const gate of gates) gate.resolve({ status: 200, headers: {} });
    await checking;
    const results = postMessage.mock.calls.map(([message]) => message);
    expect(results.filter(message => message.command === 'externalLinkCheckResult').map(message => message.url))
      .toEqual(expect.arrayContaining([...urls, 'invalid']));
    expect(results).toHaveLength(urls.length + 2);
    expect(results.at(-1)).toEqual({ command: 'externalLinkCheckComplete', requestId: 'run', cancelled: false });
  });

  it('cancels superseded, explicitly cancelled and disposed requests without sending stale results', async () => {
    const request = vi.fn(({ signal }) => new Promise<{ status: number; headers: Record<string, string> }>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
    }));
    const postMessage = vi.fn();
    const host = createInsightsExternalHost({ resolveHost: async () => ['203.0.113.20'], request, postMessage });
    const start = (requestId: string) => host.checkExternalLinks({ requestId, urls: ['https://a.test/1'] });
    const old = start('same');
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const current = start('same');
    const other = start('other');
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    host.cancelExternalLinkChecks({ requestId: 'same' });
    host.cancelExternalLinkChecks({});
    host.dispose();
    await Promise.all([old, current, other]);
    await host.checkExternalLinks({});
    expect(postMessage.mock.calls.flat()).toEqual([
      { command: 'externalLinkCheckComplete', requestId: 'same', cancelled: true },
      { command: 'externalLinkCheckComplete', requestId: 'same', cancelled: true },
      { command: 'externalLinkCheckComplete', requestId: 'other', cancelled: true },
      { command: 'externalLinkCheckComplete', requestId: '', cancelled: false },
    ]);
  });
});
