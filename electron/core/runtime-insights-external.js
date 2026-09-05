const dns = require('node:dns').promises;
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

const MAX_REDIRECTS = 5;
const GLOBAL_CONCURRENCY = 4;
const ORIGIN_CONCURRENCY = 2;
const DEFAULT_TIMEOUT_MS = 10_000;
const ANONYMOUS_HEADERS = Object.freeze({ accept: '*/*', 'user-agent': 'Markdown Explorer/Insights' });

function normalizeOrigin(url) {
  const parsed = url instanceof URL ? url : new URL(url);
  return parsed.origin;
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
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

function isPrivateIpv6(address) {
  const value = String(address || '').toLowerCase().split('%', 1)[0];
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fc') || value.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(value)) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

function isPrivateHostname(hostname) {
  const value = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return value === 'localhost' || value.endsWith('.localhost');
}

async function defaultResolveHost(hostname) {
  const entries = await dns.lookup(hostname, { all: true, verbatim: true });
  return entries.map((entry) => entry.address);
}

function headersToRecord(headers) {
  const result = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (Array.isArray(value)) result[key.toLowerCase()] = value.join(', ');
    else if (value != null) result[key.toLowerCase()] = String(value);
  }
  return result;
}

function defaultRequest({ url, method, address, headers, timeoutMs, signal, maxBodyBytes = 0 }) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const family = net.isIP(address);
    let settled = false;
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const request = transport.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: `${parsed.pathname}${parsed.search}`,
      method,
      headers: { ...ANONYMOUS_HEADERS, ...(headers || {}) },
      servername: parsed.protocol === 'https:' ? parsed.hostname : undefined,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
      agent: false,
    }, (response) => {
      if (settled) return;
      settled = true;
      const payload = { status: response.statusCode || 0, headers: headersToRecord(response.headers) };
      if (maxBodyBytes <= 0) response.destroy();
      else response.resume();
      resolve(payload);
    });
    request.setTimeout(Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS), () => {
      const error = new Error('ETIMEDOUT');
      error.code = 'ETIMEDOUT';
      request.destroy(error);
    });
    request.on('error', finishReject);
    if (signal) {
      if (signal.aborted) {
        const error = new Error('ABORT_ERR');
        error.name = 'AbortError';
        request.destroy(error);
        return;
      }
      signal.addEventListener('abort', () => {
        const error = new Error('ABORT_ERR');
        error.name = 'AbortError';
        request.destroy(error);
      }, { once: true });
    }
    request.end();
  });
}

function parseRetryAfter(value, now = Date.now()) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - now) : undefined;
}

function classifyStatus(status) {
  if ((status >= 200 && status < 400)) return 'reachable';
  if (status === 401 || status === 403) return 'reachable-auth-required';
  if (status === 404 || status === 410) return 'broken';
  if (status === 429) return 'rate-limited';
  if (status >= 500 && status <= 599) return 'server-error';
  return 'unreachable';
}

function createExternalLinkChecker(deps = {}) {
  const resolveHost = deps.resolveHost || defaultResolveHost;
  const request = deps.request || defaultRequest;

  async function checkedRequest(url, address, method, session) {
    return request({
      url: url.toString(),
      method,
      address,
      headers: { ...ANONYMOUS_HEADERS },
      timeoutMs: session.timeoutMs || DEFAULT_TIMEOUT_MS,
      signal: session.signal,
      maxBodyBytes: method === 'GET' ? 0 : undefined,
    });
  }

  async function check(input, session = {}) {
    const originalUrl = String(input || '');
    const checkedAt = new Date().toISOString();
    let current;
    try { current = new URL(originalUrl); }
    catch { return { url: originalUrl, status: 'unsupported', checkedAt, reason: 'invalid-url' }; }
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      return { url: originalUrl, status: 'unsupported', checkedAt, reason: 'unsupported-scheme' };
    }

    const approved = new Set((session.approvedPrivateOrigins || []).map(String));
    let insecureDowngrade = false;
    let redirects = 0;
    let transientRetries = 0;

    while (true) {
      if (session.signal?.aborted) return { url: originalUrl, status: 'unchecked', checkedAt, reason: 'cancelled' };
      const origin = normalizeOrigin(current);
      let addresses;
      try { addresses = await resolveHost(current.hostname); }
      catch (error) {
        return { url: originalUrl, status: 'unreachable', finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: String(error?.message || error || 'dns-failure') };
      }
      if (!Array.isArray(addresses) || addresses.length === 0) {
        return { url: originalUrl, status: 'unreachable', finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: 'dns-empty' };
      }
      const privateDestination = isPrivateHostname(current.hostname) || addresses.some(isPrivateAddress);
      if (privateDestination && !approved.has(origin)) {
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
      const address = String(addresses[0]);

      let response;
      try {
        response = await checkedRequest(current, address, 'HEAD', session);
        if (response.status === 405 || response.status === 501) {
          response = await checkedRequest(current, address, 'GET', session);
        }
      } catch (error) {
        if (session.signal?.aborted || error?.name === 'AbortError') {
          return { url: originalUrl, status: 'unchecked', finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: 'cancelled' };
        }
        return { url: originalUrl, status: 'unreachable', finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: String(error?.message || error || 'network-error') };
      }

      const status = Number(response.status) || 0;
      const headers = headersToRecord(response.headers);
      const location = headers.location;
      if (status >= 300 && status < 400 && location) {
        if (redirects >= MAX_REDIRECTS) {
          return { url: originalUrl, status: 'unreachable', httpStatus: status, finalUrl: current.toString(), checkedAt, insecureDowngrade, reason: 'redirect-limit' };
        }
        let next;
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
        status: classifyStatus(status),
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

function createExternalLinkHost({ sendHostMessage, ...checkerDeps } = {}) {
  const checker = createExternalLinkChecker(checkerDeps);
  const requests = new Map();

  async function checkExternalLinks(message) {
    const requestId = String(message.requestId || '');
    const controller = new AbortController();
    requests.get(requestId)?.abort();
    requests.set(requestId, controller);
    const urls = [...new Set((Array.isArray(message.urls) ? message.urls : []).map(String))];
    const queue = urls.map((url, index) => ({ url, index, origin: (() => { try { return new URL(url).origin; } catch { return ''; } })() }));
    const activeOrigins = new Map();
    let active = 0;
    let cursor = 0;

    await new Promise((resolve) => {
      const schedule = () => {
        if (controller.signal.aborted || (cursor >= queue.length && active === 0)) { resolve(); return; }
        let started = false;
        while (active < GLOBAL_CONCURRENCY && cursor < queue.length) {
          let selected = -1;
          for (let index = cursor; index < queue.length; index += 1) {
            const count = activeOrigins.get(queue[index].origin) || 0;
            if (count < ORIGIN_CONCURRENCY) { selected = index; break; }
          }
          if (selected < 0) break;
          const [item] = queue.splice(selected, 1);
          if (selected <= cursor && cursor > 0) cursor -= 1;
          active += 1;
          activeOrigins.set(item.origin, (activeOrigins.get(item.origin) || 0) + 1);
          started = true;
          void checker.check(item.url, {
            requestId,
            timeoutMs: message.timeoutMs,
            approvedPrivateOrigins: message.approvedPrivateOrigins,
            signal: controller.signal,
          }).then((result) => {
            if (!controller.signal.aborted) sendHostMessage?.({ command: 'externalLinkCheckResult', requestId, ...result });
          }).finally(() => {
            active -= 1;
            const nextCount = (activeOrigins.get(item.origin) || 1) - 1;
            if (nextCount <= 0) activeOrigins.delete(item.origin); else activeOrigins.set(item.origin, nextCount);
            schedule();
          });
        }
        if (!started && active === 0) resolve();
      };
      schedule();
    });

    const cancelled = controller.signal.aborted;
    if (requests.get(requestId) === controller) requests.delete(requestId);
    sendHostMessage?.({ command: 'externalLinkCheckComplete', requestId, cancelled });
  }

  function cancelExternalLinkChecks(message) {
    requests.get(String(message.requestId || ''))?.abort();
  }

  function dispose() {
    for (const controller of requests.values()) controller.abort();
    requests.clear();
  }

  return { checkExternalLinks, cancelExternalLinkChecks, dispose };
}

module.exports = {
  createExternalLinkChecker,
  createExternalLinkHost,
  isPrivateAddress,
  classifyStatus,
  parseRetryAfter,
  MAX_REDIRECTS,
  GLOBAL_CONCURRENCY,
  ORIGIN_CONCURRENCY,
};
