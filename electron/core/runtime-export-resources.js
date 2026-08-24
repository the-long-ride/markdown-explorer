const MIME_TYPES = new Map([
  ['.avif', 'image/avif'], ['.bmp', 'image/bmp'], ['.css', 'text/css'],
  ['.gif', 'image/gif'], ['.htm', 'text/html'], ['.html', 'text/html'],
  ['.ico', 'image/x-icon'], ['.jpeg', 'image/jpeg'], ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript'], ['.json', 'application/json'], ['.mjs', 'text/javascript'],
  ['.mp3', 'audio/mpeg'], ['.mp4', 'video/mp4'], ['.ogg', 'audio/ogg'],
  ['.otf', 'font/otf'], ['.pdf', 'application/pdf'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.ttf', 'font/ttf'], ['.txt', 'text/plain'],
  ['.wasm', 'application/wasm'], ['.wav', 'audio/wav'], ['.webm', 'video/webm'],
  ['.webp', 'image/webp'], ['.woff', 'font/woff'], ['.woff2', 'font/woff2'],
]);

function isSameOrInside(base, target, pathApi) {
  const rel = pathApi.relative(pathApi.resolve(base), pathApi.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !pathApi.isAbsolute(rel));
}

function portableRelativePath(root, target, pathApi) {
  return pathApi.relative(root, target).split(pathApi.sep).join('/');
}

function mimeTypeForPath(filePath, pathApi) {
  return MIME_TYPES.get(pathApi.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function stripQueryAndFragment(value) {
  return value.split('#', 1)[0].split('?', 1)[0];
}

function resolveRequestedPath({ workspaceRoot, resourcePath, documentPath, pathApi }) {
  const raw = stripQueryAndFragment(String(resourcePath || '').trim());
  if (!raw || /^(?:data|blob|https?|javascript):/i.test(raw)) return { reason: 'unsupported' };
  let decoded = raw;
  let explicitFilePath = false;
  if (/^file:/i.test(raw)) {
    try {
      decoded = decodeURIComponent(new URL(raw).pathname);
      if (/^\/[A-Za-z]:\//.test(decoded)) decoded = decoded.slice(1);
      explicitFilePath = true;
    } catch {
      return { reason: 'unsupported' };
    }
  }
  const base = documentPath ? pathApi.dirname(documentPath) : workspaceRoot;
  const target = explicitFilePath
    ? pathApi.normalize(decoded)
    : decoded.startsWith('/')
      ? pathApi.resolve(workspaceRoot, `.${decoded}`)
      : pathApi.isAbsolute(decoded)
        ? pathApi.normalize(decoded)
        : pathApi.resolve(base, decoded);
  if (!isSameOrInside(workspaceRoot, target, pathApi)) return { reason: 'outside-workspace' };
  return { target };
}

function createExportResourceHandlers({ fs, pathApi, sendHostMessage, getWorkspaceBaseDir }) {
  function workspaceRoot() {
    const base = getWorkspaceBaseDir();
    if (!base || !fs.existsSync(base)) return null;
    try {
      return fs.realpathSync(base);
    } catch {
      return null;
    }
  }

  function readWorkspaceExportResource(message = {}) {
    const requestId = String(message.requestId || '');
    const root = workspaceRoot();
    if (!root) {
      sendHostMessage({ command: 'workspaceExportResourceResult', requestId, ok: false, reason: 'missing' });
      return;
    }
    const resolved = resolveRequestedPath({
      workspaceRoot: root,
      resourcePath: message.resourcePath,
      documentPath: message.documentPath,
      pathApi,
    });
    if (resolved.reason) {
      sendHostMessage({ command: 'workspaceExportResourceResult', requestId, ok: false, reason: resolved.reason });
      return;
    }
    const target = resolved.target;
    if (!fs.existsSync(target)) {
      sendHostMessage({ command: 'workspaceExportResourceResult', requestId, ok: false, reason: 'missing' });
      return;
    }
    try {
      const canonical = fs.realpathSync(target);
      if (!isSameOrInside(root, canonical, pathApi)) {
        sendHostMessage({ command: 'workspaceExportResourceResult', requestId, ok: false, reason: 'outside-workspace' });
        return;
      }
      if (!fs.statSync(canonical).isFile()) {
        sendHostMessage({ command: 'workspaceExportResourceResult', requestId, ok: false, reason: 'unsupported' });
        return;
      }
      const bytes = fs.readFileSync(canonical);
      sendHostMessage({
        command: 'workspaceExportResourceResult', requestId, ok: true,
        relativePath: portableRelativePath(root, canonical, pathApi),
        mimeType: mimeTypeForPath(canonical, pathApi),
        dataBase64: bytes.toString('base64'),
      });
    } catch {
      sendHostMessage({ command: 'workspaceExportResourceResult', requestId, ok: false, reason: 'unreadable' });
    }
  }

  return { readWorkspaceExportResource };
}

module.exports = { createExportResourceHandlers, mimeTypeForPath, resolveRequestedPath };
