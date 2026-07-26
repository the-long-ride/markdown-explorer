import type { WorkspaceTextResourceResponse } from '../platform/bridge';

export interface HtmlLocalFirstPolicyReport {
  blockedRemoteStyles: string[];
  blockedRemoteScripts: string[];
  allowedRemoteImages: string[];
  allowedRemoteFonts: string[];
  allowedRemoteMedia: string[];
  blockedNetworkApis: string[];
  blockedLocalReferences: string[];
  missingLocalReferences: string[];
}

export interface PreparedLocalFirstHtmlPreview {
  documentHtml: string;
  policyReport: HtmlLocalFirstPolicyReport;
}

export type HtmlLocalTextReader = (
  resourcePath: string,
  baseDocumentPath: string,
) => Promise<WorkspaceTextResourceResponse>;

const REMOTE_URL = /^(?:https?:)?\/\//i;
const DATA_OR_BLOB_URL = /^(?:data:|blob:|#)/i;
const NETWORK_API_PATTERNS: readonly [string, RegExp][] = [
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['sendBeacon', /\bsendBeacon\s*\(/],
];

const LOCAL_FIRST_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "connect-src 'none'",
  "img-src http: https: data: blob:",
  "font-src http: https: data: blob:",
  "media-src http: https: data: blob:",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

function emptyPolicyReport(): HtmlLocalFirstPolicyReport {
  return {
    blockedRemoteStyles: [],
    blockedRemoteScripts: [],
    allowedRemoteImages: [],
    allowedRemoteFonts: [],
    allowedRemoteMedia: [],
    blockedNetworkApis: [],
    blockedLocalReferences: [],
    missingLocalReferences: [],
  };
}

function pushUnique(target: string[], value: string): void {
  if (value && !target.includes(value)) target.push(value);
}

function networkGuardScript(): string {
  return `
(function () {
  const blocked = function (name) {
    return function () {
      throw new Error('Markdown Explorer local-first preview blocked ' + name + '.');
    };
  };
  const replace = function (target, key, value) {
    try { Object.defineProperty(target, key, { configurable: false, writable: false, value: value }); } catch (_) {}
  };
  replace(window, 'fetch', blocked('fetch'));
  replace(window, 'XMLHttpRequest', blocked('XMLHttpRequest'));
  replace(window, 'WebSocket', blocked('WebSocket'));
  replace(window, 'EventSource', blocked('EventSource'));
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    replace(navigator, 'sendBeacon', blocked('sendBeacon'));
  }
})();`;
}

function collectNetworkApis(source: string, report: HtmlLocalFirstPolicyReport): void {
  for (const [name, pattern] of NETWORK_API_PATTERNS) {
    if (pattern.test(source)) pushUnique(report.blockedNetworkApis, name);
  }
}

function resourceFailure(
  response: WorkspaceTextResourceResponse,
  reference: string,
  report: HtmlLocalFirstPolicyReport,
): void {
  if (response.reason === 'outside-workspace' || response.reason === 'unsupported') {
    pushUnique(report.blockedLocalReferences, reference);
  } else {
    pushUnique(report.missingLocalReferences, reference);
  }
}

function isStylesheetLink(link: HTMLLinkElement): boolean {
  return link.rel.toLowerCase().split(/\s+/).includes('stylesheet');
}

function classifyRemoteReference(
  reference: string,
  kind: 'image' | 'font' | 'media',
  report: HtmlLocalFirstPolicyReport,
): void {
  if (!REMOTE_URL.test(reference)) return;
  if (kind === 'image') pushUnique(report.allowedRemoteImages, reference);
  else if (kind === 'font') pushUnique(report.allowedRemoteFonts, reference);
  else pushUnique(report.allowedRemoteMedia, reference);
}

function collectRemoteSrcSet(value: string, report: HtmlLocalFirstPolicyReport): void {
  for (const candidate of value.split(',')) {
    classifyRemoteReference(candidate.trim().split(/\s+/, 1)[0] || '', 'image', report);
  }
}

function classifyAllowedRemoteMedia(documentNode: Document, report: HtmlLocalFirstPolicyReport): void {
  documentNode.querySelectorAll<HTMLElement>('img[src], input[type="image"][src]').forEach((element) => {
    classifyRemoteReference(element.getAttribute('src') || '', 'image', report);
  });
  documentNode.querySelectorAll<HTMLElement>('img[srcset], source[srcset]').forEach((element) => {
    collectRemoteSrcSet(element.getAttribute('srcset') || '', report);
  });
  documentNode.querySelectorAll<HTMLElement>('video[src], video[poster]').forEach((element) => {
    classifyRemoteReference(element.getAttribute('src') || '', 'media', report);
    classifyRemoteReference(element.getAttribute('poster') || '', 'image', report);
  });
  documentNode.querySelectorAll<HTMLElement>('audio[src], source[src]').forEach((element) => {
    classifyRemoteReference(element.getAttribute('src') || '', 'media', report);
  });
  documentNode.querySelectorAll<HTMLLinkElement>('link[href]').forEach((link) => {
    const as = (link.getAttribute('as') || '').toLowerCase();
    if (as === 'font') classifyRemoteReference(link.getAttribute('href') || '', 'font', report);
    else if (as === 'image') classifyRemoteReference(link.getAttribute('href') || '', 'image', report);
    else if (as === 'audio' || as === 'video') classifyRemoteReference(link.getAttribute('href') || '', 'media', report);
  });
}

function processCssRemoteReferences(css: string, report: HtmlLocalFirstPolicyReport): string {
  let next = css.replace(
    /@import\s+(?:url\(\s*)?["']?((?:https?:)?\/\/[^\s"')]+)["']?\s*\)?[^;]*;/gi,
    (_match, url: string) => {
      pushUnique(report.blockedRemoteStyles, url);
      return '/* Markdown Explorer blocked remote @import. */';
    },
  );

  next = next.replace(
    /url\(\s*(["']?)((?:https?:)?\/\/[^"')]+)\1\s*\)/gi,
    (match, _quote: string, url: string, offset: number) => {
      const nearbyCss = next.slice(Math.max(0, offset - 180), offset).toLowerCase();
      if (/\.(?:woff2?|ttf|otf|eot)(?:[?#].*)?$/i.test(url) || nearbyCss.includes('@font-face')) {
        pushUnique(report.allowedRemoteFonts, url);
      } else if (/\.(?:png|jpe?g|gif|webp|svg|avif)(?:[?#].*)?$/i.test(url)) {
        pushUnique(report.allowedRemoteImages, url);
      } else if (/\.(?:mp4|webm|ogg|mp3|wav|m4a)(?:[?#].*)?$/i.test(url)) {
        pushUnique(report.allowedRemoteMedia, url);
      }
      return match;
    },
  );
  return next;
}

async function inlineLocalImports(
  css: string,
  cssPath: string,
  readLocalText: HtmlLocalTextReader,
  report: HtmlLocalFirstPolicyReport,
  seen: Set<string>,
): Promise<string> {
  const importPattern = /@import\s+(?:url\(\s*)?["']?([^\s"')]+)["']?\s*\)?[^;]*;/gi;
  const matches = [...css.matchAll(importPattern)];
  let next = css;
  for (const match of matches) {
    const reference = match[1];
    if (!reference || REMOTE_URL.test(reference) || DATA_OR_BLOB_URL.test(reference)) continue;
    const response = await readLocalText(reference, cssPath);
    if (!response.ok || response.content === undefined || !response.resolvedPath) {
      resourceFailure(response, reference, report);
      next = next.replace(match[0], '/* Markdown Explorer could not load local @import. */');
      continue;
    }
    if (seen.has(response.resolvedPath)) {
      next = next.replace(match[0], '/* Markdown Explorer skipped circular @import. */');
      continue;
    }
    seen.add(response.resolvedPath);
    const imported = await inlineLocalImports(
      processCssRemoteReferences(response.content, report),
      response.resolvedPath,
      readLocalText,
      report,
      seen,
    );
    next = next.replace(match[0], `\n/* inlined ${reference} */\n${imported}\n`);
  }
  return next;
}

function installLocalFirstCsp(documentNode: Document): void {
  documentNode.querySelectorAll('meta[http-equiv="Content-Security-Policy" i]').forEach((meta) => meta.remove());
  const csp = documentNode.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content = LOCAL_FIRST_CSP;
  documentNode.head.prepend(csp);
}

/**
 * Prepare an isolated, local-first HTML document. Workspace-local CSS/JS is
 * embedded; network CSS/JS is removed; remote media remains available; and
 * network APIs are replaced before any user script runs.
 */
export async function prepareLocalFirstHtmlPreview({
  htmlSource,
  documentPath,
  readLocalText,
}: {
  htmlSource: string;
  documentPath: string;
  readLocalText: HtmlLocalTextReader;
}): Promise<PreparedLocalFirstHtmlPreview> {
  const report = emptyPolicyReport();
  const documentNode = new DOMParser().parseFromString(htmlSource, 'text/html');

  // A source-provided base can redirect apparently local references outside the
  // workspace. Resource resolution is performed by the host against documentPath.
  documentNode.querySelectorAll('base').forEach((base) => base.remove());
  classifyAllowedRemoteMedia(documentNode, report);

  for (const link of Array.from(documentNode.querySelectorAll<HTMLLinkElement>('link[href]'))) {
    if (!isStylesheetLink(link)) continue;
    const href = link.getAttribute('href') || '';
    if (!href || DATA_OR_BLOB_URL.test(href)) continue;
    if (REMOTE_URL.test(href)) {
      pushUnique(report.blockedRemoteStyles, href);
      link.remove();
      continue;
    }
    const response = await readLocalText(href, documentPath);
    if (!response.ok || response.content === undefined || !response.resolvedPath) {
      resourceFailure(response, href, report);
      link.remove();
      continue;
    }
    const style = documentNode.createElement('style');
    style.dataset.mdnLocalResource = response.resolvedPath;
    style.textContent = await inlineLocalImports(
      processCssRemoteReferences(response.content, report),
      response.resolvedPath,
      readLocalText,
      report,
      new Set([response.resolvedPath]),
    );
    link.replaceWith(style);
  }

  for (const style of Array.from(documentNode.querySelectorAll<HTMLStyleElement>('style'))) {
    style.textContent = processCssRemoteReferences(style.textContent || '', report);
  }

  for (const script of Array.from(documentNode.querySelectorAll<HTMLScriptElement>('script'))) {
    const src = script.getAttribute('src') || '';
    if (!src) {
      collectNetworkApis(script.textContent || '', report);
      continue;
    }
    if (DATA_OR_BLOB_URL.test(src)) continue;
    if (REMOTE_URL.test(src)) {
      pushUnique(report.blockedRemoteScripts, src);
      script.remove();
      continue;
    }
    const response = await readLocalText(src, documentPath);
    if (!response.ok || response.content === undefined || !response.resolvedPath) {
      resourceFailure(response, src, report);
      script.remove();
      continue;
    }
    collectNetworkApis(response.content, report);
    const inlineScript = documentNode.createElement('script');
    for (const attribute of Array.from(script.attributes)) {
      if (attribute.name.toLowerCase() !== 'src' && attribute.name.toLowerCase() !== 'integrity') {
        inlineScript.setAttribute(attribute.name, attribute.value);
      }
    }
    inlineScript.dataset.mdnLocalResource = response.resolvedPath;
    inlineScript.textContent = response.content;
    script.replaceWith(inlineScript);
  }

  installLocalFirstCsp(documentNode);
  const guard = documentNode.createElement('script');
  guard.dataset.mdnNetworkGuard = 'true';
  guard.textContent = networkGuardScript();
  const csp = documentNode.head.querySelector('meta[http-equiv="Content-Security-Policy" i]');
  csp?.after(guard);

  const doctype = documentNode.doctype ? `<!DOCTYPE ${documentNode.doctype.name}>\n` : '<!DOCTYPE html>\n';
  return {
    documentHtml: `${doctype}${documentNode.documentElement.outerHTML}`,
    policyReport: report,
  };
}

export function hasHtmlLocalFirstPolicyNotice(report: HtmlLocalFirstPolicyReport): boolean {
  return Object.values(report).some((entries) => entries.length > 0);
}
