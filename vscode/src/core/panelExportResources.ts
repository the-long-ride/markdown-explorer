import * as fs from 'fs';
import * as path from 'path';
import { isSameOrInsidePath } from './panelNavigation';

const MAX_EXPORT_RESOURCE_BYTES = 128 * 1024 * 1024;

export type PanelExportResourceReadResult =
  | { ok: true; relativePath: string; mimeType: string; dataBase64: string }
  | { ok: false; reason: 'outside-workspace' | 'missing' | 'unreadable' | 'unsupported' | 'too-large' };

function mimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.avif': return 'image/avif';
    case '.bmp': return 'image/bmp';
    case '.css': return 'text/css';
    case '.gif': return 'image/gif';
    case '.htm': case '.html': return 'text/html';
    case '.ico': return 'image/x-icon';
    case '.jpeg': case '.jpg': return 'image/jpeg';
    case '.js': case '.mjs': return 'text/javascript';
    case '.json': return 'application/json';
    case '.mp3': return 'audio/mpeg';
    case '.mp4': return 'video/mp4';
    case '.ogg': return 'audio/ogg';
    case '.otf': return 'font/otf';
    case '.pdf': return 'application/pdf';
    case '.png': return 'image/png';
    case '.svg': return 'image/svg+xml';
    case '.ttf': return 'font/ttf';
    case '.txt': return 'text/plain';
    case '.wasm': return 'application/wasm';
    case '.wav': return 'audio/wav';
    case '.webm': return 'video/webm';
    case '.webp': return 'image/webp';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

function workspaceRealPath(workspaceRoot: string): string | null {
  if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return null;
  try {
    const source = fs.statSync(workspaceRoot).isFile() ? path.dirname(workspaceRoot) : workspaceRoot;
    return fs.realpathSync(source);
  } catch {
    return null;
  }
}

function portableRelative(root: string, target: string): string {
  return path.relative(root, target).replace(/\\/g, '/');
}

function resolveReference(
  resourcePath: string,
  workspaceRoot: string,
  documentPath: string | undefined,
  parseFileUri: (uri: string) => string,
): string | null {
  const reference = String(resourcePath || '').split(/[?#]/, 1)[0].trim();
  if (!reference || /^(?:https?:|data:|blob:|javascript:)/i.test(reference) || reference.startsWith('//')) return null;
  if (/^file:/i.test(reference)) return parseFileUri(reference);
  if (reference.startsWith('/')) return path.resolve(workspaceRoot, `.${reference}`);
  if (path.isAbsolute(reference)) return path.normalize(reference);
  const base = documentPath ? path.dirname(documentPath) : workspaceRoot;
  return path.resolve(base, reference);
}

export function readPanelExportResource(
  message: { resourcePath: string; documentPath?: string },
  workspaceRoot: string | undefined,
  parseFileUri: (uri: string) => string,
): PanelExportResourceReadResult {
  const root = workspaceRoot ? workspaceRealPath(workspaceRoot) : null;
  if (!root || !message.resourcePath) return { ok: false, reason: 'unsupported' };
  const resolved = resolveReference(message.resourcePath, root, message.documentPath, parseFileUri);
  if (!resolved) return { ok: false, reason: 'unsupported' };
  if (!fs.existsSync(resolved)) return { ok: false, reason: 'missing' };
  try {
    const canonical = fs.realpathSync(resolved);
    if (!isSameOrInsidePath(root, canonical)) return { ok: false, reason: 'outside-workspace' };
    const stat = fs.statSync(canonical);
    if (!stat.isFile()) return { ok: false, reason: 'unsupported' };
    if (stat.size > MAX_EXPORT_RESOURCE_BYTES) return { ok: false, reason: 'too-large' };
    return {
      ok: true,
      relativePath: portableRelative(root, canonical),
      mimeType: mimeType(canonical),
      dataBase64: fs.readFileSync(canonical).toString('base64'),
    };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

export async function handlePanelExportResourceMessage(
  message: { command?: string; requestId?: string; resourcePath?: string; documentPath?: string },
  workspaceRoot: string | undefined,
  parseFileUri: (uri: string) => string,
  respond: (message: Record<string, unknown>) => Thenable<boolean>,
): Promise<boolean> {
  if (message.command === 'readWorkspaceExportResource') {
    const result = readPanelExportResource({
      resourcePath: message.resourcePath ?? '',
      documentPath: message.documentPath,
    }, workspaceRoot, parseFileUri);
    await respond({ command: 'workspaceExportResourceResult', requestId: message.requestId ?? '', ...result });
    return true;
  }
  return false;
}
