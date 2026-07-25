import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import { randomUUID } from 'crypto';

const HEARTBEAT_TIMEOUT_MS = 2 * 60_000;
const MAX_LIFETIME_MS = 24 * 60 * 60_000;
const CLEANUP_INTERVAL_MS = 15_000;
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

interface PreviewSession {
  documentHtml: string;
  createdAt: number;
  lastSeenAt: number;
}

function injectLifecycleScript(documentHtml: string, token: string): string {
  const script = `<script data-mdn-preview-session>(function(){const token=${JSON.stringify(token)};const heartbeatUrl=location.origin+'/heartbeat/'+encodeURIComponent(token);const closeUrl=location.origin+'/close/'+encodeURIComponent(token);const ping=()=>fetch(heartbeatUrl,{method:'POST',cache:'no-store',keepalive:true}).catch(()=>{});const close=()=>{try{navigator.sendBeacon(closeUrl,'');}catch(_){}};ping();const timer=setInterval(ping,15000);addEventListener('pagehide',()=>{clearInterval(timer);close();},{once:true});addEventListener('beforeunload',close,{once:true});})();<\/script>`;
  if (/<head\b[^>]*>/i.test(documentHtml)) {
    return documentHtml.replace(/<head\b[^>]*>/i, (head) => `${head}${script}`);
  }
  if (/<html\b[^>]*>/i.test(documentHtml)) {
    return documentHtml.replace(/<html\b[^>]*>/i, (html) => `${html}${script}`);
  }
  return `${script}${documentHtml}`;
}

function writeResponse(response: ServerResponse, statusCode: number, contentType: string, body = ''): void {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(body);
}

export class HtmlPreviewServer {
  private readonly sessions = new Map<string, PreviewSession>();
  private server: Server | null = null;
  private origin: string | null = null;
  private startPromise: Promise<string> | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly openExternal: (url: string) => Promise<unknown>) {}

  async open(documentHtml: string): Promise<string> {
    if (typeof documentHtml !== 'string' || !documentHtml.trim()) {
      throw new TypeError('Preview document must be a non-empty string');
    }
    if (Buffer.byteLength(documentHtml, 'utf8') > MAX_DOCUMENT_BYTES) {
      throw new RangeError('Preview document is too large');
    }
    const origin = await this.ensureStarted();
    const token = randomUUID();
    const createdAt = Date.now();
    this.sessions.set(token, { documentHtml, createdAt, lastSeenAt: createdAt });
    const url = `${origin}/preview/${encodeURIComponent(token)}`;
    try {
      await this.openExternal(url);
    } catch (error) {
      this.sessions.delete(token);
      throw error;
    }
    return url;
  }

  async dispose(): Promise<void> {
    this.sessions.clear();
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
    this.origin = null;
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private async ensureStarted(): Promise<string> {
    if (this.origin) return this.origin;
    if (this.startPromise) return this.startPromise;
    this.startPromise = (async () => {
      this.server = createServer((request, response) => this.handleRequest(request, response));
      await new Promise<void>((resolve, reject) => {
        const server = this.server;
        if (!server) return reject(new Error('Preview server was not created'));
        const onError = (error: Error) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(0, '127.0.0.1');
      });
      const address = this.server.address();
      if (!address || typeof address === 'string') throw new Error('Unable to determine preview server address');
      this.origin = `http://127.0.0.1:${address.port}`;
      this.cleanupTimer = setInterval(() => this.pruneSessions(), CLEANUP_INTERVAL_MS);
      this.cleanupTimer.unref();
      return this.origin;
    })();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse): void {
    let pathname: string;
    try {
      pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    } catch {
      writeResponse(response, 400, 'text/plain; charset=utf-8', 'Bad request');
      return;
    }
    const preview = pathname.match(/^\/preview\/([a-zA-Z0-9-]+)$/);
    const heartbeat = pathname.match(/^\/heartbeat\/([a-zA-Z0-9-]+)$/);
    const close = pathname.match(/^\/close\/([a-zA-Z0-9-]+)$/);

    if (request.method === 'GET' && preview) {
      const session = this.sessions.get(preview[1]);
      if (!session) return writeResponse(response, 404, 'text/plain; charset=utf-8', 'Preview expired');
      session.lastSeenAt = Date.now();
      writeResponse(response, 200, 'text/html; charset=utf-8', injectLifecycleScript(session.documentHtml, preview[1]));
      return;
    }
    if (request.method === 'POST' && heartbeat) {
      const session = this.sessions.get(heartbeat[1]);
      if (!session) return writeResponse(response, 404, 'text/plain; charset=utf-8');
      session.lastSeenAt = Date.now();
      writeResponse(response, 204, 'text/plain; charset=utf-8');
      return;
    }
    if (request.method === 'POST' && close) {
      this.sessions.delete(close[1]);
      writeResponse(response, 204, 'text/plain; charset=utf-8');
      return;
    }
    writeResponse(response, 404, 'text/plain; charset=utf-8', 'Not found');
  }

  private pruneSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      if (now - session.lastSeenAt > HEARTBEAT_TIMEOUT_MS || now - session.createdAt > MAX_LIFETIME_MS) {
        this.sessions.delete(token);
      }
    }
  }
}
