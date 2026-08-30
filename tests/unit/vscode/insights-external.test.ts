import { describe, expect, it, vi } from 'vitest';
import { createInsightsExternalChecker } from '../../../vscode/src/core/panelInsightsExternal';

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
});
