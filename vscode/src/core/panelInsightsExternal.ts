import { promises as dns } from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 5;
const GLOBAL_CONCURRENCY = 4;
const ORIGIN_CONCURRENCY = 2;
const DEFAULT_TIMEOUT_MS = 10_000;
const ANONYMOUS_HEADERS = Object.freeze({ accept: '*/*', 'user-agent': 'Markdown Explorer/Insights' });

type CheckStatus =
  | 'reachable'
  | 'reachable-auth-required'
  | 'broken'
  | 'rate-limited'
  | 'server-error'
  | 'unreachable'
  | 'unchecked'
  | 'unsupported';

interface CheckResult {
  url: string;
  status: CheckStatus;
  httpStatus?: number;
  finalUrl?: string;
  checkedAt?: string;
  insecureDowngrade?: boolean;
  reason?: string;
  retryAfterMs?: number;
  privateOrigin?: string;
  requiresPrivateOriginConfirmation?: boolean;
}

interface CheckSession {
  requestId: string;
  timeoutMs: number;
  approvedPrivateOrigins?: readonly string[];
  signal?: AbortSignal;
}

interface TransportRequest {
  url: string;
  method: 'HEAD' | 'GET';
  address: string;
  headers: Record<string, string>;
  timeoutMs: number;
  signal?: AbortSignal;
  maxBodyBytes?: number;
}

interface TransportResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
}

interface CheckerDeps {
  resolveHost?: (hostname: string) => Promise<string[]>;
  request?: (request: TransportRequest) => Promise<TransportResponse>;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function isPrivateIpv6(address: string): boolean {
  const value = String(address || '').toLowerCase().split('%', 1)[0];
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fc') || value.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(value)) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

function isPrivateHostname(hostname: string): boolean {
  const value = hostname.toLowerCase().replace(/\.$/, '');
  return value === 'localhost' || value.endsWith('.localhost');
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const entries = await dns.lookup(hostname, { all: true, verbatim: true });
  return entries.map(entry => entry.address);
}

function headersToRecord(headers: Record<string, string | string[] | number | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (Array.isArray(value)) result[key.toLowerCase()] = value.join(', ');
    else if (value != null) result[key.toLowerCase()] = String(value);
  }
  return result;
}

function defaultRequest(options: TransportRequest): Promise<TransportResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(options.url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const family = isIP(options.address);
    let settled = false;
    const request = transport.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method,
      headers: { ...ANONYMOUS_HEADERS, ...options.headers },
      servername: parsed.protocol === 'https:' ? parsed.hostname : undefined,
      lookup: (_hostname: string, _lookupOptions: unknown, callback: (...args: any[]) => void) => {
        callback(null, options.address, family);
      },
      agent: false,
    }, response => {
      if (settled) return;
      settled = true;
      const headers = headersToRecord(response.headers as Record<string, string | string[] | number | undefined>);
      if ((options.maxBodyBytes ?? 0) <= 0) response.destroy(); else response.resume();
      resolve({ status: response.statusCode || 0, headers });
    });
    request.setTimeout(Math.max(1, options.timeoutMs || DEFAULT_TIMEOUT_MS), () => {
      const error = new Error('ETIMEDOUT');
      request.destroy(error);
    });
    request.on('error', error => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    if (options.signal) {
      if (options.signal.aborted) {
        const error = new Error('ABORT_ERR');
        error.name = 'AbortError';
        request.destroy(error);
        return;
      }
      options.signal.addEventListener('abort', () => {
        const error = new Error('ABORT_ERR');
        error.name = 'AbortError';
        request.destroy(error);
      }, { once: true });
    }
    request.end();
  });
}

export function classifyExternalStatus(status: number): CheckStatus {
  if (status >= 200 && status < 400) return 'reachable';
  if (status === 401 || status === 403) return 'reachable-auth-required';
  if (status === 404 || status === 410) return 'broken';
  if (status === 429) return 'rate-limited';
  if (status >= 500 && status <= 599) return 'server-error';
  return 'unreachable';
}

function parseRetryAfter(value: string | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - now) : undefined;
}

export function createInsightsExternalChecker(deps: CheckerDeps = {}) {
  const resolveHost = deps.resolveHost ?? defaultResolveHost;
  const request = deps.request ?? defaultRequest;

  const checkedRequest = (url: URL, address: string, method: 'HEAD' | 'GET', session: CheckSession) => request({
    url: url.toString(),
    method,
    address,
    headers: { ...ANONYMOUS_HEADERS },
    timeoutMs: session.timeoutMs || DEFAULT_TIMEOUT_MS,
    signal: session.signal,
    maxBodyBytes: method === 'GET' ? 0 : undefined,
  });

  async function check(input: string, session: CheckSession): Promise<CheckResult> {
    const originalUrl = String(input || '');
    const checkedAt = new Date().toISOString();
    let current: URL;
    try { current = new URL(originalUrl); }
    catch { return { url: originalUrl, status: 'unsupported', checkedAt, reason: 'invalid-url' }; }
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      return { url: originalUrl, status: 'unsupported', checkedAt, reason: 'unsupported-scheme' };
    }

    const approved = new Set((session.approvedPrivateOrigins ?? []).map(String));
    let insecureDowngrade = false;
    let redirects = 0;
    let transientRetries = 0;

    while (true) {
      if (session.signal?.aborted) return { url: originalUrl, status: 'unchecked', checkedAt, reason: 'cancelled' };
      const origin = current.origin;
      let addresses: string[];
      try { addresses = await resolveHost(current.hostname); }
      catch (error) {
        return { url: originalUrl, status: 'unreachable', finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: String(error instanceof Error ? error.message : error) };
      }
      if (!addresses.length) return { url: originalUrl, status: 'unreachable', finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: 'dns-empty' };
      if ((isPrivateHostname(current.hostname) || addresses.some(isPrivateAddress)) && !approved.has(origin)) {
        return {
          url: originalUrl,
          status: 'unchecked',
          finalUrl: current.toString(),
          checkedAt,
          insecureDowngrade,
          privateOrigin: origin,
          requiresPrivateOriginConfirmation: true,
          reason: 'private-origin-confirmation-required',
        };
      }

      const address = addresses[0];
      let response: TransportResponse;
      try {
        response = await checkedRequest(current, address, 'HEAD', session);
        if (response.status === 405 || response.status === 501) response = await checkedRequest(current, address, 'GET', session);
      } catch (error) {
        if (session.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          return { url: originalUrl, status: 'unchecked', finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: 'cancelled' };
        }
        return { url: originalUrl, status: 'unreachable', finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: String(error instanceof Error ? error.message : error) };
      }

      const status = Number(response.status) || 0;
      const headers = headersToRecord(response.headers);
      const location = headers.location;
      if (status >= 300 && status < 400 && location) {
        if (redirects >= MAX_REDIRECTS) {
          return { url: originalUrl, status: 'unreachable', httpStatus: status, finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: 'redirect-limit' };
        }
        let next: URL;
        try { next = new URL(location, current); }
        catch { return { url: originalUrl, status: 'unreachable', httpStatus: status, finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: 'invalid-redirect' }; }
        if (next.protocol !== 'http:' && next.protocol !== 'https:') {
          return { url: originalUrl, status: 'unsupported', httpStatus: status, finalUrl: next.toString(), checkedAt, insecureDowngrade, reason: 'unsupported-redirect-scheme' };
        }
        if (current.protocol === 'https:' && next.protocol === 'http:') insecureDowngrade = true;
        current = next;
        redirects += 1;
        transientRetries = 0;
        continue;
      }
      if (status >= 500 && status <= 599 && transientRetries < 1) {
        transientRetries += 1;
        continue;
      }
      return {
        url: originalUrl,
        status: classifyExternalStatus(status),
        httpStatus: status || undefined,
        finalUrl: current.toString(),
        checkedAt,
        insecureDowngrade,
        retryAfterMs: status === 429 || status >= 500 ? parseRetryAfter(headers['retry-after']) : undefined,
      };
    }
  }

  return { check };
}

interface ExternalHostDeps extends CheckerDeps {
  postMessage: (message: any) => void | PromiseLike<unknown>;
}

export function createInsightsExternalHost(deps: ExternalHostDeps) {
  const checker = createInsightsExternalChecker(deps);
  const requests = new Map<string, AbortController>();

  async function checkExternalLinks(message: any): Promise<void> {
    const requestId = String(message.requestId || '');
    requests.get(requestId)?.abort();
    const controller = new AbortController();
    requests.set(requestId, controller);
    const inputUrls: string[] = (Array.isArray(message.urls) ? message.urls : []).map((url: unknown) => String(url));
    const queue = [...new Set<string>(inputUrls)].map((url: string) => ({
      url,
      origin: (() => { try { return new URL(url).origin; } catch { return ''; } })(),
    }));
    const activeOrigins = new Map<string, number>();
    let active = 0;

    await new Promise<void>(resolve => {
      const schedule = () => {
        if (controller.signal.aborted || (queue.length === 0 && active === 0)) { resolve(); return; }
        let started = false;
        while (active < GLOBAL_CONCURRENCY && queue.length > 0) {
          const selected = queue.findIndex(item => (activeOrigins.get(item.origin) ?? 0) < ORIGIN_CONCURRENCY);
          if (selected < 0) break;
          const [item] = queue.splice(selected, 1);
          active += 1;
          activeOrigins.set(item.origin, (activeOrigins.get(item.origin) ?? 0) + 1);
          started = true;
          void checker.check(item.url, {
            requestId,
            timeoutMs: Number(message.timeoutMs) || DEFAULT_TIMEOUT_MS,
            approvedPrivateOrigins: message.approvedPrivateOrigins,
            signal: controller.signal,
          }).then(async result => {
            if (!controller.signal.aborted) await deps.postMessage({ command: 'externalLinkCheckResult', requestId, ...result });
          }).finally(() => {
            active -= 1;
            const count = (activeOrigins.get(item.origin) ?? 1) - 1;
            if (count <= 0) activeOrigins.delete(item.origin); else activeOrigins.set(item.origin, count);
            schedule();
          });
        }
        if (!started && active === 0) resolve();
      };
      schedule();
    });

    const cancelled = controller.signal.aborted;
    if (requests.get(requestId) === controller) requests.delete(requestId);
    await deps.postMessage({ command: 'externalLinkCheckComplete', requestId, cancelled });
  }

  function cancelExternalLinkChecks(message: any): void {
    requests.get(String(message.requestId || ''))?.abort();
  }

  function dispose(): void {
    for (const controller of requests.values()) controller.abort();
    requests.clear();
  }

  return { checkExternalLinks, cancelExternalLinkChecks, dispose };
}

export { MAX_REDIRECTS, GLOBAL_CONCURRENCY, ORIGIN_CONCURRENCY };
