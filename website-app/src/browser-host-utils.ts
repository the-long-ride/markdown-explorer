export function resolveWorkspaceTextResourcePath(documentPath: string, resourcePath: string): string | null {
  const reference = resourcePath.split(/[?#]/, 1)[0];
  if (!reference || /^(?:https?:|data:|blob:|javascript:|file:)/i.test(reference)) return null;
  const parts = reference.startsWith('/') ? [] : documentPath.split('/').slice(0, -1).filter(Boolean);
  for (const part of reference.replace(/^\/+/, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) return null; parts.pop(); }
    else parts.push(part);
  }
  const resolved = parts.join('/');
  return /\.(?:css|js|mjs|cjs)$/i.test(resolved) ? resolved : null;
}
