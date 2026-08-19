import { pathToFileUrl } from '../dom/localFileUrl';
import type { MdFile } from '../types/files';
import type { ExportLayout } from './exportModel';

export interface ExportPage {
  file: MdFile;
  html: string;
}

const EXPORT_BASE_CSS = `
html,body{margin:0;min-height:100%;background:var(--bg,#fff);color:var(--tx,#202124)}
body{font-family:var(--font-body,system-ui,sans-serif)}
.mdn-export-document{min-height:100vh}
.mdn-export-page{box-sizing:border-box;width:min(100%,980px);margin:0 auto;padding:36px 42px 72px}
.mdn-export-document-section{break-before:page;scroll-margin-top:58px}
.mdn-export-document-section:first-child{break-before:auto}
.mdn-export-shell{min-height:100vh;display:grid;grid-template-columns:220px minmax(0,1fr) 190px;grid-template-rows:46px minmax(0,1fr)}
.mdn-export-topbar{grid-column:1/-1;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid var(--bd-x,#ddd);background:var(--bg-e,var(--bg,#fff));font-size:12px;font-weight:650;position:sticky;top:0;z-index:4}
.mdn-export-sidebar,.mdn-export-toc{padding:16px 12px;position:sticky;top:46px;align-self:start;max-height:calc(100vh - 46px);overflow:auto;font-size:12px}
.mdn-export-sidebar{border-right:1px solid var(--bd-x,#ddd)}
.mdn-export-toc{border-left:1px solid var(--bd-x,#ddd)}
.mdn-export-sidebar a,.mdn-export-toc a{display:block;color:var(--tx-m,var(--tx,#333));text-decoration:none;padding:5px 7px;border-radius:6px;overflow-wrap:anywhere}
.mdn-export-sidebar a:hover,.mdn-export-toc a:hover{background:color-mix(in srgb,var(--accent,#666) 10%,transparent);color:var(--tx,#111)}
.mdn-export-main{min-width:0}
.mdn-export-shell .mdn-export-page{width:min(100%,980px)}
@media(max-width:900px){.mdn-export-shell{grid-template-columns:180px minmax(0,1fr)}.mdn-export-toc{display:none}}
@media(max-width:680px){.mdn-export-shell{display:block}.mdn-export-topbar{position:static}.mdn-export-sidebar{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--bd-x,#ddd)}.mdn-export-page{padding:24px 18px 48px}}
@media print{.mdn-export-shell{display:block}.mdn-export-topbar,.mdn-export-sidebar,.mdn-export-toc{display:none!important}.mdn-export-page{width:100%;max-width:none;padding:0}.mdn-export-document-section{break-before:page}.mdn-export-document-section:first-child{break-before:auto}.mdn-copy-btn,.mdn-section-copy-btn,.mdn-table-controls,.mdn-table-filter-btn,.mdn-table-columns-toggle,.mdn-table-view-dropdown{display:none!important}pre,table,svg,img,video{max-width:100%!important}pre{white-space:pre-wrap;overflow-wrap:anywhere}}
`;

export function escapeExportHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
}

function normalizeRelativePath(value: string): string {
  const parts: string[] = [];
  for (const part of value.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function dirname(value: string): string {
  const normalized = normalizeRelativePath(value);
  const index = normalized.lastIndexOf('/');
  return index < 0 ? '' : normalized.slice(0, index);
}

function outputPath(file: MdFile): string {
  return `${normalizeRelativePath(file.relativePath)}.html`;
}

function relativePath(fromFile: string, toFile: string): string {
  const fromParts = dirname(fromFile).split('/').filter(Boolean);
  const toParts = normalizeRelativePath(toFile).split('/').filter(Boolean);
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) common += 1;
  const upward = Array.from({ length: fromParts.length - common }, () => '..');
  const result = [...upward, ...toParts.slice(common)].join('/');
  return result || './';
}

function documentIdBase(file: MdFile): string {
  const slug = normalizeRelativePath(file.relativePath)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `doc-${slug || 'document'}`;
}

function stablePathHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function documentId(file: MdFile, exported: readonly MdFile[] = [file]): string {
  const base = documentIdBase(file);
  const collisions = exported.filter((candidate) => documentIdBase(candidate) === base);
  if (collisions.length <= 1) return base;
  const exactPath = normalizeRelativePath(file.relativePath).toLowerCase();
  return `${base}-${stablePathHash(exactPath)}`;
}

function resolveInternalTarget(rawHref: string, source: MdFile, exported: readonly MdFile[]): { file: MdFile; hash: string } | null {
  const href = rawHref.trim();
  if (!href || href.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return null;
  const hashIndex = href.indexOf('#');
  const queryIndex = href.indexOf('?');
  const cut = [hashIndex, queryIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? href.length;
  const reference = decodeURIComponent(href.slice(0, cut));
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const sourceDir = dirname(source.relativePath);
  const resolved = reference.startsWith('/')
    ? normalizeRelativePath(reference)
    : normalizeRelativePath(`${sourceDir}/${reference}`);
  const file = exported.find((candidate) => normalizeRelativePath(candidate.relativePath) === resolved);
  return file ? { file, hash } : null;
}

export function rewriteExportLinks(html: string, source: MdFile, exported: readonly MdFile[]): string {
  return html.replace(/\bhref=(['"])([^'"]+)\1/gi, (full, quote: string, href: string) => {
    const target = resolveInternalTarget(href, source, exported);
    if (!target) return full;
    const rewritten = `${relativePath(outputPath(source), outputPath(target.file))}${target.hash}`;
    return `href=${quote}${rewritten}${quote}`;
  });
}

function rewriteMergedLinks(html: string, source: MdFile, exported: readonly MdFile[]): string {
  return html.replace(/\bhref=(['"])([^'"]+)\1/gi, (full, quote: string, href: string) => {
    const target = resolveInternalTarget(href, source, exported);
    if (!target) return full;
    return `href=${quote}#${documentId(target.file, exported)}${quote}`;
  });
}

function localAssetUrl(raw: string, documentPath: string): string | null {
  const value = raw.trim();
  if (!value || value.startsWith('#') || /^(?:data|https?|mailto|tel|javascript):/i.test(value)) return null;
  if (/^blob:/i.test(value)) return value;
  if (/^file:/i.test(value)) return value;
  const base = pathToFileUrl(documentPath);
  if (!base) return null;
  try {
    const resolved = new URL(value, base);
    return resolved.protocol === 'file:' ? resolved.href : null;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function embedExportLocalAssets(html: string, documentPath: string): Promise<string> {
  if (typeof DOMParser === 'undefined' || typeof fetch !== 'function' || typeof btoa !== 'function') return html;
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const targets: Array<{ element: Element; attribute: string }> = [];
  parsed.body.querySelectorAll('img[src],source[src],audio[src]').forEach((element) => targets.push({ element, attribute: 'src' }));
  parsed.body.querySelectorAll('video[poster]').forEach((element) => targets.push({ element, attribute: 'poster' }));

  await Promise.all(targets.map(async ({ element, attribute }) => {
    const raw = element.getAttribute(attribute);
    if (!raw) return;
    const url = localAssetUrl(raw, documentPath);
    if (!url) return;
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim() || 'application/octet-stream';
      element.setAttribute(attribute, `data:${contentType};base64,${bytesToBase64(bytes)}`);
    } catch {
      // Export stays usable even if a local asset cannot be embedded.
    }
  }));

  return parsed.body.innerHTML;
}

export function captureExportThemeCss(root?: HTMLElement): string {
  if (typeof document === 'undefined') return '';
  const target = root ?? document.documentElement;
  const computed = typeof getComputedStyle === 'function' ? getComputedStyle(target) : null;
  const variables: string[] = [];
  if (computed) {
    for (let index = 0; index < computed.length; index += 1) {
      const name = computed.item(index);
      if (!name.startsWith('--')) continue;
      const value = computed.getPropertyValue(name).trim();
      if (value) variables.push(`${name}:${value};`);
    }
  }

  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) rules.push(rule.cssText);
    } catch {
      // Ignore cross-origin stylesheets; Markdown Explorer's own sheets are readable.
    }
  }

  return `:root{${variables.join('')}}\n${rules.join('\n')}`;
}

export function buildStandaloneExportHtml(args: {
  pages: readonly ExportPage[];
  layout: ExportLayout;
  title: string;
  themeCss: string;
  navigationFiles?: readonly MdFile[];
}): string {
  const files = args.pages.map((page) => page.file);
  const merged = args.pages.length > 1;
  const pageMarkup = args.pages.map((page) => {
    const html = merged ? rewriteMergedLinks(page.html, page.file, files) : page.html;
    return `<section id="${documentId(page.file, files)}" class="mdn-export-document-section"><article class="mdn-body mdn-export-page">${html}</article></section>`;
  }).join('\n');

  const navigationFiles = args.navigationFiles?.length ? args.navigationFiles : files;
  const currentFile = !merged && args.pages.length === 1 ? args.pages[0].file : null;
  const navigation = navigationFiles.map((file) => {
    const href = currentFile
      ? (file.fsPath === currentFile.fsPath
          ? `#${documentId(currentFile, files)}`
          : relativePath(outputPath(currentFile), outputPath(file)))
      : `#${documentId(file, files)}`;
    return `<a href="${escapeExportHtml(href)}">${escapeExportHtml(file.title || file.relativePath)}</a>`;
  }).join('');

  const body = args.layout === 'explorer'
    ? `<div class="mdn-export-shell"><header class="mdn-export-topbar">Markdown Explorer · ${escapeExportHtml(args.title)}</header><nav class="mdn-export-sidebar" aria-label="Documents">${navigation}</nav><main class="mdn-export-main">${pageMarkup}</main><aside class="mdn-export-toc" aria-label="Contents">${navigation}</aside></div>`
    : `<main class="mdn-export-document">${pageMarkup}</main>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeExportHtml(args.title)}</title><style>${args.themeCss}\n${EXPORT_BASE_CSS}</style></head><body>${body}</body></html>`;
}

export function exportHtmlPath(file: MdFile, _exported: readonly MdFile[] = [file]): string {
  return outputPath(file);
}
