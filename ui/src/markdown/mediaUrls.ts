// ============================================================
// markdown/mediaUrls.ts — Browser-side relative media URL rewriting
// ============================================================
// Port of desktop/markdown-renderer.js rewriteRelativeMediaUrls
// for client-side use. Pure functions with no Node.js dependencies.

function shouldKeepResourceUrl(src: string): boolean {
  return /^(https?:|data:|file:|blob:|vscode-webview:|#)/i.test(src);
}

/**
 * Convert a relative media path to an absolute file:// URL.
 * markdownFilePath is the absolute path to the .md file on disk.
 */
export function toFileResourceUrl(markdownFilePath: string, src: string): string {
  if (shouldKeepResourceUrl(src)) return src;

  // Get directory of the markdown file
  const lastSep = Math.max(
    markdownFilePath.lastIndexOf('/'),
    markdownFilePath.lastIndexOf('\\'),
  );
  const fileDir = lastSep >= 0 ? markdownFilePath.slice(0, lastSep) : '.';

  // Resolve relative path
  const resolved = resolveRelativePath(fileDir, src);


  return 'file:///' + resolved.replace(/\\/g, '/');
}

/** Resolve a relative path against a base directory (no Node.js path dependencies) */
function resolveRelativePath(baseDir: string, relativePath: string): string {
  const sep = baseDir.includes('\\') ? '\\' : '/';
  const baseParts = baseDir.split(/[\\/]/).filter(Boolean);

  // If relativePath is absolute, return it normalized
  if (relativePath.match(/^[A-Za-z]:[\\/]/) || relativePath.startsWith('/')) {
    return relativePath.replace(/\//g, sep);
  }

  const relParts = relativePath.split(/[\\/]/);
  for (const part of relParts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (baseParts.length > 0) baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }

  return baseParts.join(sep);
}

/**
 * Rewrite relative media URLs in rendered HTML to absolute file:// URLs.
 * Works with img, video, source, track src attributes and video poster attributes.
 */
export function rewriteRelativeMediaUrls(html: string, markdownFilePath: string): string {
  if (!markdownFilePath) return html;

  const srcAttrRegex = /(<(?:img|video|source|track)\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi;
  const posterAttrRegex = /(<video\b[^>]*?\bposter\s*=\s*)(["'])([^"']+)(\2)/gi;

  return html
    .replace(srcAttrRegex, (_match, prefix, quote, src, suffix) =>
      `${prefix}${quote}${toFileResourceUrl(markdownFilePath, src)}${suffix}`,
    )
    .replace(posterAttrRegex, (_match, prefix, quote, src, suffix) =>
      `${prefix}${quote}${toFileResourceUrl(markdownFilePath, src)}${suffix}`,
    );
}

