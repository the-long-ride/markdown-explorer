// =============================================================================
// chrome/src/media-resolver.ts — Resolves relative images/videos to blob URLs
// =============================================================================

import { readBlobUrl } from './file-access';

const activeBlobUrls = new Set<string>();

export function revokeAll(): void {
  for (const url of activeBlobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error revoking blob URL:', url, err);
    }
  }
  activeBlobUrls.clear();
}

function resolvePath(basePath: string, relativePath: string): string {
  const normalizedRelPath = relativePath.replace(/\\/g, '/');
  const normalizedBasePath = basePath.replace(/\\/g, '/');
  const isAbsolute = normalizedRelPath.startsWith('/');
  const baseParts = normalizedBasePath.split('/').filter(Boolean);
  const relParts = normalizedRelPath.split('/').filter(Boolean);

  const resolvedParts = isAbsolute ? [] : [...baseParts];

  for (const part of relParts) {
    if (part === '.') continue;
    if (part === '..') {
      resolvedParts.pop();
    } else {
      resolvedParts.push(part);
    }
  }
  return resolvedParts.join('/');
}

export async function rewriteMediaUrls(
  rootHandle: FileSystemDirectoryHandle,
  html: string,
  markdownFilePath: string
): Promise<string> {
  // Revoke previous blob URLs to prevent memory leaks
  revokeAll();

  const parts = markdownFilePath.split('/');
  const dirPath = parts.slice(0, -1).join('/');

  const srcAttrRegex = /(<(?:img|video|source|audio|track)\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi;
  const posterAttrRegex = /(<video\b[^>]*?\bposter\s*=\s*)(["'])([^"']+)(\2)/gi;

  const matches: Array<{ fullMatch: string; prefix: string; quote: string; rawPath: string; suffix: string }> = [];

  let match;
  // Reset lastIndex for safety
  srcAttrRegex.lastIndex = 0;
  posterAttrRegex.lastIndex = 0;

  while ((match = srcAttrRegex.exec(html)) !== null) {
    matches.push({
      fullMatch: match[0],
      prefix: match[1],
      quote: match[2],
      rawPath: match[3],
      suffix: match[4]
    });
  }
  while ((match = posterAttrRegex.exec(html)) !== null) {
    matches.push({
      fullMatch: match[0],
      prefix: match[1],
      quote: match[2],
      rawPath: match[3],
      suffix: match[4]
    });
  }

  let resultHtml = html;

  // Resolve matches in parallel
  const replacements = await Promise.all(
    matches.map(async (m) => {
      if (/^(https?:|data:|file:|blob:|vscode-webview:|#)/i.test(m.rawPath)) {
        return { original: m.fullMatch, replacement: m.fullMatch };
      }
      const resolvedPath = resolvePath(dirPath, m.rawPath);
      try {
        const blobUrl = await readBlobUrl(rootHandle, resolvedPath);
        activeBlobUrls.add(blobUrl);
        return {
          original: m.fullMatch,
          replacement: `${m.prefix}${m.quote}${blobUrl}${m.suffix}`
        };
      } catch (err) {
        console.error('Failed to resolve relative media path:', resolvedPath, err);
        return { original: m.fullMatch, replacement: m.fullMatch };
      }
    })
  );

  for (const rep of replacements) {
    resultHtml = resultHtml.replace(rep.original, rep.replacement);
  }

  return resultHtml;
}
