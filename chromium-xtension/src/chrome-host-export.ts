import { listWorkspaceFiles, readBinaryFile } from './file-access';

const MAX_EXPORT_RESOURCE_BYTES = 128 * 1024 * 1024;

interface ChromeExportContext {
  activeHandle: FileSystemDirectoryHandle | null;
  send: (message: any) => void;
}

function mimeType(relativePath: string, browserType: string): string {
  if (browserType) return browserType;
  const extension = relativePath.toLowerCase().split('.').pop() || '';
  switch (extension) {
    case 'avif': return 'image/avif';
    case 'bmp': return 'image/bmp';
    case 'css': return 'text/css';
    case 'gif': return 'image/gif';
    case 'htm': case 'html': return 'text/html';
    case 'ico': return 'image/x-icon';
    case 'jpeg': case 'jpg': return 'image/jpeg';
    case 'js': case 'mjs': return 'text/javascript';
    case 'json': return 'application/json';
    case 'mp3': return 'audio/mpeg';
    case 'mp4': return 'video/mp4';
    case 'ogg': return 'audio/ogg';
    case 'otf': return 'font/otf';
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'svg': return 'image/svg+xml';
    case 'ttf': return 'font/ttf';
    case 'txt': return 'text/plain';
    case 'wasm': return 'application/wasm';
    case 'wav': return 'audio/wav';
    case 'webm': return 'video/webm';
    case 'webp': return 'image/webp';
    case 'woff': return 'font/woff';
    case 'woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

function resolveWorkspaceResourcePath(documentPath: string | undefined, resourcePath: string):
  | { ok: true; relativePath: string }
  | { ok: false; reason: 'outside-workspace' | 'unsupported' } {
  const raw = String(resourcePath || '').split(/[?#]/, 1)[0].trim().replace(/\\/g, '/');
  if (!raw || /^(?:https?:|file:|data:|blob:|javascript:)/i.test(raw) || raw.startsWith('//') || /^[A-Za-z]:\//.test(raw)) {
    return { ok: false, reason: 'unsupported' };
  }
  const stack = raw.startsWith('/')
    ? []
    : String(documentPath || '').replace(/\\/g, '/').split('/').filter(Boolean).slice(0, -1);
  for (const part of raw.split('/').filter(Boolean)) {
    if (part === '.') continue;
    if (part === '..') {
      if (stack.length === 0) return { ok: false, reason: 'outside-workspace' };
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  if (stack.length === 0) return { ok: false, reason: 'unsupported' };
  return { ok: true, relativePath: stack.join('/') };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const batchSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + batchSize));
  }
  return globalThis.btoa(binary);
}

export async function handleChromeExportHostCommand(message: any, context: ChromeExportContext): Promise<boolean> {
  if (message.command === 'listWorkspaceExportResources') {
    if (!context.activeHandle) {
      context.send({ command: 'workspaceExportResourcesResult', requestId: message.requestId, ok: false, error: 'Workspace is not available' });
      return true;
    }
    try {
      const resources = await listWorkspaceFiles(context.activeHandle);
      context.send({ command: 'workspaceExportResourcesResult', requestId: message.requestId, ok: true, resources });
    } catch (error) {
      context.send({
        command: 'workspaceExportResourcesResult', requestId: message.requestId, ok: false,
        error: error instanceof Error ? error.message : 'Unable to list workspace resources',
      });
    }
    return true;
  }

  if (message.command === 'readWorkspaceExportResource') {
    if (!context.activeHandle) {
      context.send({ command: 'workspaceExportResourceResult', requestId: message.requestId, ok: false, reason: 'missing' });
      return true;
    }
    const resolved = resolveWorkspaceResourcePath(message.documentPath, message.resourcePath);
    if (!resolved.ok) {
      context.send({ command: 'workspaceExportResourceResult', requestId: message.requestId, ok: false, reason: resolved.reason });
      return true;
    }
    try {
      const file = await readBinaryFile(context.activeHandle, resolved.relativePath);
      if (!file) {
        context.send({ command: 'workspaceExportResourceResult', requestId: message.requestId, ok: false, reason: 'missing' });
        return true;
      }
      if (file.size > MAX_EXPORT_RESOURCE_BYTES) {
        context.send({ command: 'workspaceExportResourceResult', requestId: message.requestId, ok: false, reason: 'too-large' });
        return true;
      }
      context.send({
        command: 'workspaceExportResourceResult', requestId: message.requestId, ok: true,
        relativePath: resolved.relativePath,
        mimeType: mimeType(resolved.relativePath, file.type),
        dataBase64: bytesToBase64(file.bytes),
      });
    } catch {
      context.send({ command: 'workspaceExportResourceResult', requestId: message.requestId, ok: false, reason: 'unreadable' });
    }
    return true;
  }

  return false;
}

export { resolveWorkspaceResourcePath };
