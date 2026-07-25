import type { PlatformBridge } from '../platform/bridge';
import type { AppRuntime } from '../types';
import type { Translations } from '../contexts/translations';
import { buildHtmlPreviewDocument, type HtmlPreviewTarget } from '../markdown/htmlPreviewDocument';

export type PreviewActionLabels = Translations['previewActions'];

const activeBlobUrls = new Map<string, {
  ownedUrls: string[];
  pollTimer?: number;
  expiryTimer?: number;
}>();
let unloadRegistered = false;

function ensureUnloadCleanup(): void {
  if (unloadRegistered || typeof window === 'undefined') return;
  unloadRegistered = true;
  window.addEventListener('beforeunload', revokeAllHtmlPreviewUrls, { once: false });
  window.addEventListener('pagehide', revokeAllHtmlPreviewUrls, { once: false });
}

function clearBlobUrl(url: string): void {
  const entry = activeBlobUrls.get(url);
  if (!entry) return;
  if (entry.pollTimer !== undefined) window.clearInterval(entry.pollTimer);
  if (entry.expiryTimer !== undefined) window.clearTimeout(entry.expiryTimer);
  for (const ownedUrl of entry.ownedUrls) URL.revokeObjectURL(ownedUrl);
  activeBlobUrls.delete(url);
}

export function revokeAllHtmlPreviewUrls(): void {
  for (const url of [...activeBlobUrls.keys()]) clearBlobUrl(url);
}

export function getHtmlPreviewDocument(
  trigger: HTMLElement,
  target: Exclude<HtmlPreviewTarget, 'inline'> = 'external',
): string | null {
  const wrap = trigger.closest<HTMLElement>('.mdn-html-preview-wrap');
  if (!wrap) return null;
  const sourceTemplate = wrap.querySelector<HTMLTemplateElement>('.mdn-html-preview-source');
  const source = sourceTemplate?.content.textContent;
  if (source !== null && source !== undefined) {
    return buildHtmlPreviewDocument(source, {
      theme: wrap.dataset.previewTheme || 'auto',
      target,
    });
  }
  const iframe = wrap.querySelector<HTMLIFrameElement>('.mdn-html-preview-iframe');
  if (!iframe) return null;
  return iframe.getAttribute('srcdoc') || iframe.srcdoc || null;
}

function pathToFileUrl(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (/^file:/i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    const normalized = trimmed.replace(/\\/g, '/');
    return `file:///${encodeURI(normalized)}`;
  }
  if (trimmed.startsWith('/')) return `file://${encodeURI(trimmed)}`;
  return null;
}

export function documentBaseHref(currentFile: string | null | undefined): string | null {
  if (!currentFile) return null;
  try {
    if (/^(https?|file):/i.test(currentFile)) return new URL('.', currentFile).href;
  } catch {}
  const fileUrl = pathToFileUrl(currentFile);
  if (!fileUrl) return null;
  try {
    return new URL('.', fileUrl).href;
  } catch {
    return null;
  }
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


export function buildBrowserPreviewShell(previewUrl: string, title = 'HTML preview'): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<title>${escapeAttribute(title)}</title>
<style>html,body,iframe{position:fixed;inset:0;width:100%;height:100%;margin:0;border:0;overflow:hidden;background:transparent}</style>
</head>
<body><iframe sandbox="allow-scripts" src="${escapeAttribute(previewUrl)}" title="${escapeAttribute(title)}"></iframe></body>
</html>`;
}

export function injectBaseHref(documentHtml: string, baseHref: string | null): string {
  if (!baseHref) return documentHtml;
  const base = `<base href="${escapeAttribute(baseHref)}" />`;
  const withoutExisting = documentHtml.replace(/<base\b[^>]*>/i, '');
  if (/<head\b[^>]*>/i.test(withoutExisting)) {
    return withoutExisting.replace(/<head\b[^>]*>/i, (head) => `${head}\n${base}`);
  }
  return withoutExisting.replace(/<html\b[^>]*>/i, (html) => `${html}\n<head>${base}</head>`);
}


export function prepareStandaloneHtmlPreview(
  documentHtml: string,
  currentFile?: string | null,
): string {
  const withoutInlineResize = documentHtml.replace(
    /<script\b[^>]*data-mdn-inline-resize[^>]*>[\s\S]*?<\/script>/gi,
    '',
  );
  return injectBaseHref(withoutInlineResize, documentBaseHref(currentFile));
}

export function applyPreviewActionTranslations(root: ParentNode, labels: PreviewActionLabels): void {
  root.querySelectorAll<HTMLElement>('[data-i18n-key]').forEach((element) => {
    const key = element.dataset.i18nKey as keyof PreviewActionLabels | undefined;
    if (!key || typeof labels[key] !== 'string') return;
    const label = labels[key];
    element.setAttribute('title', label);
    element.setAttribute('aria-label', label);
    const tooltip = element.querySelector<HTMLElement>('.tooltip-text');
    if (tooltip) tooltip.textContent = label;
  });
  root.querySelectorAll<HTMLElement>('.mdn-toggle-preview-btn').forEach((button) => {
    button.dataset.labelShowCode = labels.showCode;
    button.dataset.labelShowPreview = labels.showPreview;
  });
}

export interface OpenHtmlPreviewOptions {
  bridge: PlatformBridge;
  runtime: AppRuntime;
  documentHtml: string;
  currentFile?: string | null;
  onError?: () => void;
  expiryMs?: number;
  title?: string;
}

export function openHtmlPreviewInBrowser({
  bridge,
  runtime,
  documentHtml,
  currentFile,
  onError,
  expiryMs = 24 * 60 * 60 * 1000,
  title = 'HTML preview',
}: OpenHtmlPreviewOptions): void {
  const completeDocument = prepareStandaloneHtmlPreview(documentHtml, currentFile);
  if (runtime !== 'chrome') {
    try {
      bridge.postMessage({ command: 'openHtmlPreview', documentHtml: completeDocument });
    } catch {
      onError?.();
    }
    return;
  }

  ensureUnloadCleanup();
  const ownedUrls: string[] = [];
  let shellUrl: string | null = null;
  try {
    const previewUrl = URL.createObjectURL(new Blob([completeDocument], { type: 'text/html;charset=utf-8' }));
    ownedUrls.push(previewUrl);
    shellUrl = URL.createObjectURL(new Blob([buildBrowserPreviewShell(previewUrl, title)], { type: 'text/html;charset=utf-8' }));
    ownedUrls.push(shellUrl);
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      for (const ownedUrl of ownedUrls) URL.revokeObjectURL(ownedUrl);
      onError?.();
      return;
    }
    try {
      previewWindow.opener = null;
      previewWindow.location.replace(shellUrl);
    } catch {
      previewWindow.close();
      for (const ownedUrl of ownedUrls) URL.revokeObjectURL(ownedUrl);
      onError?.();
      return;
    }
    const entry: { ownedUrls: string[]; pollTimer?: number; expiryTimer?: number } = {
      ownedUrls: [...ownedUrls],
    };
    entry.pollTimer = window.setInterval(() => {
      try {
        if (previewWindow.closed) clearBlobUrl(shellUrl!);
      } catch {
        // Cross-origin browser windows can hide their closed state; expiry handles cleanup.
      }
    }, 500);
    entry.expiryTimer = window.setTimeout(() => clearBlobUrl(shellUrl!), expiryMs);
    activeBlobUrls.set(shellUrl, entry);
  } catch {
    for (const ownedUrl of ownedUrls) URL.revokeObjectURL(ownedUrl);
    onError?.();
  }
}
