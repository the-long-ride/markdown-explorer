import * as path from 'path';

export function normalizePanelPath(value: string) { return value.toLowerCase().replace(/\\/g, '/'); }
export function stripNavigationFragment(href: string) { const hashIndex = href.indexOf('#'); return hashIndex === -1 ? href : href.slice(0, hashIndex); }
export function decodeNavigationHref(href: string) { try { return decodeURIComponent(href); } catch { return href; } }
export function isRootRelativeWorkspaceHref(href: string) { return href.startsWith('/') && !href.startsWith('//') && !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href); }
export function isSameOrInsidePath(parentPath: string, childPath: string) { const relative = path.relative(path.resolve(parentPath), path.resolve(childPath)); return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative)); }
export function resolvePanelNavigationPath(href: string, currentFile: string | null, rootPath: string) {
  const requestedPath = decodeNavigationHref(stripNavigationFragment(href));
  if (!requestedPath && currentFile) return currentFile;
  const dir = currentFile ? path.dirname(currentFile) : rootPath;
  if (rootPath && path.isAbsolute(requestedPath) && isSameOrInsidePath(rootPath, requestedPath)) return requestedPath;
  if (rootPath && isRootRelativeWorkspaceHref(requestedPath)) return path.resolve(rootPath, `.${requestedPath}`);
  return path.isAbsolute(requestedPath) ? requestedPath : path.resolve(dir, requestedPath);
}
