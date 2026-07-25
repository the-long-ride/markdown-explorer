const http = require('node:http');
const crypto = require('node:crypto');

const DEFAULT_HEARTBEAT_TIMEOUT_MS = 2 * 60_000;
const DEFAULT_MAX_LIFETIME_MS = 24 * 60 * 60_000;
const DEFAULT_CLEANUP_INTERVAL_MS = 15_000;
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

function injectLifecycleScript(documentHtml, token) {
  const encodedToken = JSON.stringify(token);
  const script = `<script data-mdn-preview-session>(function(){const token=${encodedToken};const heartbeatUrl=location.origin+'/heartbeat/'+encodeURIComponent(token);const closeUrl=location.origin+'/close/'+encodeURIComponent(token);const ping=()=>fetch(heartbeatUrl,{method:'POST',cache:'no-store',keepalive:true}).catch(()=>{});const close=()=>{try{navigator.sendBeacon(closeUrl,'');}catch(_){}};ping();const timer=setInterval(ping,15000);addEventListener('pagehide',()=>{clearInterval(timer);close();},{once:true});addEventListener('beforeunload',close,{once:true});})();<\/script>`;
  if (/<head\b[^>]*>/i.test(documentHtml)) {
    return documentHtml.replace(/<head\b[^>]*>/i, (head) => `${head}${script}`);
  }
  if (/<html\b[^>]*>/i.test(documentHtml)) {
    return documentHtml.replace(/<html\b[^>]*>/i, (html) => `${html}${script}`);
  }
  return `${script}${documentHtml}`;
}

function writeResponse(response, statusCode, contentType, body = '') {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(body);
}

function createHtmlPreviewServer({
  createServer = http.createServer,
  randomUUID = crypto.randomUUID,
  now = Date.now,
  heartbeatTimeoutMs = DEFAULT_HEARTBEAT_TIMEOUT_MS,
  maxLifetimeMs = DEFAULT_MAX_LIFETIME_MS,
  cleanupIntervalMs = DEFAULT_CLEANUP_INTERVAL_MS,
} = {}) {
  const sessions = new Map();
  let server = null;
  let origin = null;
  let startPromise = null;
  let cleanupTimer = null;

  function pruneSessions() {
    const current = now();
    for (const [token, session] of sessions) {
      const inactiveFor = current - Math.max(session.lastSeenAt, session.createdAt);
      const age = current - session.createdAt;
      if (inactiveFor > heartbeatTimeoutMs || age > maxLifetimeMs) sessions.delete(token);
    }
  }

  function handleRequest(request, response) {
    let pathname;
    try {
      pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    } catch {
      writeResponse(response, 400, 'text/plain; charset=utf-8', 'Bad request');
      return;
    }

    const previewMatch = pathname.match(/^\/preview\/([a-zA-Z0-9-]+)$/);
    const heartbeatMatch = pathname.match(/^\/heartbeat\/([a-zA-Z0-9-]+)$/);
    const closeMatch = pathname.match(/^\/close\/([a-zA-Z0-9-]+)$/);

    if (request.method === 'GET' && previewMatch) {
      const session = sessions.get(previewMatch[1]);
      if (!session) {
        writeResponse(response, 404, 'text/plain; charset=utf-8', 'Preview expired');
        return;
      }
      session.lastSeenAt = now();
      writeResponse(response, 200, 'text/html; charset=utf-8', injectLifecycleScript(session.documentHtml, previewMatch[1]));
      return;
    }

    if (request.method === 'POST' && heartbeatMatch) {
      const session = sessions.get(heartbeatMatch[1]);
      if (!session) {
        writeResponse(response, 404, 'text/plain; charset=utf-8');
        return;
      }
      session.lastSeenAt = now();
      writeResponse(response, 204, 'text/plain; charset=utf-8');
      return;
    }

    if (request.method === 'POST' && closeMatch) {
      sessions.delete(closeMatch[1]);
      writeResponse(response, 204, 'text/plain; charset=utf-8');
      return;
    }

    writeResponse(response, 404, 'text/plain; charset=utf-8', 'Not found');
  }

  async function ensureStarted() {
    if (origin) return origin;
    if (startPromise) return startPromise;
    startPromise = (async () => {
      server = createServer(handleRequest);
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server?.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server?.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(0, '127.0.0.1');
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Unable to determine preview server address');
      origin = `http://127.0.0.1:${address.port}`;
      cleanupTimer = setInterval(pruneSessions, cleanupIntervalMs);
      cleanupTimer.unref?.();
      return origin;
    })();
    try {
      return await startPromise;
    } finally {
      startPromise = null;
    }
  }

  async function open(documentHtml, openExternal) {
    if (typeof documentHtml !== 'string' || !documentHtml.trim()) {
      throw new TypeError('Preview document must be a non-empty string');
    }
    if (Buffer.byteLength(documentHtml, 'utf8') > MAX_DOCUMENT_BYTES) {
      throw new RangeError('Preview document is too large');
    }
    const activeOrigin = await ensureStarted();
    const token = randomUUID();
    const createdAt = now();
    sessions.set(token, { documentHtml, createdAt, lastSeenAt: createdAt });
    const url = `${activeOrigin}/preview/${encodeURIComponent(token)}`;
    try {
      await openExternal(url);
    } catch (error) {
      sessions.delete(token);
      throw error;
    }
    return url;
  }

  async function dispose() {
    sessions.clear();
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = null;
    origin = null;
    if (!server) return;
    const activeServer = server;
    server = null;
    await new Promise((resolve) => activeServer.close(() => resolve()));
  }

  return {
    open,
    dispose,
    pruneSessions,
    get sessionCount() { return sessions.size; },
    get origin() { return origin; },
  };
}

module.exports = {
  createHtmlPreviewServer,
  injectLifecycleScript,
  MAX_DOCUMENT_BYTES,
};
