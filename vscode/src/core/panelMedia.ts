import * as path from 'path';

export function rewritePanelMediaUrls(
  html: string,
  currentFile: string,
  toWebviewUri: (absolutePath: string) => string,
): string {
  const keep = (src: string) => /^(https?:|data:|blob:|vscode-webview:|#)/i.test(src);
  const rewrite = (match: string, prefix: string, quote: string, src: string, suffix: string) => {
    if (keep(src)) return match;
    try {
      return `${prefix}${quote}${toWebviewUri(path.resolve(path.dirname(currentFile), src))}${suffix}`;
    } catch (error) {
      console.error('Failed to resolve relative media path:', src, error);
      return match;
    }
  };
  return html
    .replace(/(<(?:img|video|source|track)\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi, rewrite)
    .replace(/(<video\b[^>]*?\bposter\s*=\s*)(["'])([^"']+)(\2)/gi, rewrite);
}
