function encodePathSegments(value: string): string {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/** Convert an absolute native file path to a browser-safe file URL. */
export function pathToFileUrl(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (/^file:/i.test(trimmed)) return trimmed;

  const normalized = trimmed.replace(/\\/g, '/');
  const driveMatch = /^([a-zA-Z]:)(\/.*)$/.exec(normalized);
  if (driveMatch) {
    return `file:///${driveMatch[1]}${encodePathSegments(driveMatch[2])}`;
  }

  if (normalized.startsWith('//')) {
    const [host, ...segments] = normalized.slice(2).split('/');
    if (!host) return null;
    const encodedPath = segments.map((segment) => encodeURIComponent(segment)).join('/');
    return encodedPath ? `file://${host}/${encodedPath}` : `file://${host}/`;
  }

  if (normalized.startsWith('/')) {
    return `file://${encodePathSegments(normalized)}`;
  }

  return null;
}
