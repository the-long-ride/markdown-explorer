import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createExternalLinkChecker } = require('../../../electron/core/runtime-insights-external.js');

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
});
