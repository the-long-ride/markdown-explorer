import { setHeadingSectionExpanded } from '../components/Content/enhancements/headingSectionState';

interface PortableUi {
  [key: string]: unknown;
}

type PortableWindow = Window & { UI?: PortableUi };

function copyText(text: string, doc: Document): void {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
    return;
  }
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  doc.body.appendChild(textarea);
  textarea.select();
  doc.execCommand?.('copy');
  textarea.remove();
}

function markCopied(button: HTMLElement | null): void {
  if (!button) return;
  button.classList.add('is-copied');
  const tooltip = button.querySelector<HTMLElement>('.tooltip-text');
  const original = tooltip?.textContent ?? '';
  if (tooltip) tooltip.textContent = button.dataset.copiedLabel || 'Copied';
  window.setTimeout(() => {
    button.classList.remove('is-copied');
    if (tooltip) tooltip.textContent = original;
  }, 1600);
}

function cleanText(source: HTMLElement): string {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll([
    '.tooltip-text', '.mdn-anchor', '.mdn-section-copy-btn', '.mdn-section-chevron',
    '.mdn-copy-btn', '.mdn-toggle-preview-btn', '.mdn-toggle-csv-btn',
    '.mdn-codeblock-toggle-btn', '.mdn-codeblock-lang', '.mdn-table-toolbar',
    '.mdn-table-filter-btn', '.mdn-sort-icon',
  ].join(',')).forEach((element) => element.remove());
  return (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export function setPortableHtmlMode(wrap: HTMLElement, mode: 'code' | 'preview'): void {
  wrap.dataset.mode = mode;
  const preview = mode === 'preview';
  const label = wrap.querySelector<HTMLElement>('.mdn-codeblock-lang');
  const previewBody = wrap.querySelector<HTMLElement>('.mdn-html-preview-body');
  const codeBody = wrap.querySelector<HTMLElement>('.mdn-code-source')
    ?? wrap.querySelector<HTMLElement>('.mdn-codeblock-body');
  const toggle = wrap.querySelector<HTMLElement>('.mdn-toggle-preview-btn');
  if (label) label.textContent = preview
    ? label.dataset.translatedPreviewLabel || label.dataset.previewLabel || 'HTML Preview'
    : label.dataset.codeLabel || 'HTML';
  if (previewBody) previewBody.style.display = preview ? '' : 'none';
  if (codeBody) codeBody.style.display = preview ? 'none' : '';
  if (toggle) {
    const nextLabel = preview
      ? toggle.dataset.labelShowCode || 'Show code'
      : toggle.dataset.labelShowPreview || 'Show preview';
    toggle.title = nextLabel;
    toggle.setAttribute('aria-label', nextLabel);
    const tooltip = toggle.querySelector<HTMLElement>('.tooltip-text');
    if (tooltip) tooltip.textContent = nextLabel;
  }
}

export function setPortableCsvMode(wrap: HTMLElement, mode: 'code' | 'preview'): void {
  wrap.dataset.mode = mode;
  const preview = mode === 'preview';
  const label = wrap.querySelector<HTMLElement>('.mdn-codeblock-lang');
  const previewBody = wrap.querySelector<HTMLElement>('.mdn-csv-preview-body');
  const codeBody = wrap.querySelector<HTMLElement>('.mdn-code-source');
  const toggle = wrap.querySelector<HTMLElement>('.mdn-toggle-csv-btn');
  if (label) label.textContent = preview
    ? label.dataset.translatedPreviewLabel || label.dataset.previewLabel || 'Preview'
    : label.dataset.codeLabel || 'CSV';
  if (previewBody) previewBody.style.display = preview ? '' : 'none';
  if (codeBody) codeBody.style.display = preview ? 'none' : '';
  if (toggle) {
    const nextLabel = preview
      ? toggle.dataset.labelShowCode || 'Show code'
      : toggle.dataset.labelShowPreview || 'Show preview';
    toggle.title = nextLabel;
    toggle.setAttribute('aria-label', nextLabel);
    const tooltip = toggle.querySelector<HTMLElement>('.tooltip-text');
    if (tooltip) tooltip.textContent = nextLabel;
  }
}

export function installPortableContentHandlers(
  doc: Document = document,
  win: PortableWindow = window,
): void {
  const ui = win.UI ?? (win.UI = {});

  ui.copyCode = (button: HTMLElement) => {
    const block = button.closest('.mdn-codeblock');
    const code = block?.querySelector<HTMLElement>('.mdn-code-source code')
      ?? block?.querySelector<HTMLElement>('code');
    copyText(code?.innerText ?? code?.textContent ?? '', doc);
    markCopied(button);
  };

  ui.copySection = (button: HTMLElement, event?: Event) => {
    event?.stopPropagation();
    const body = button.closest('.mdn-section')?.querySelector<HTMLElement>('.mdn-section-body');
    if (!body) return;
    copyText(cleanText(body), doc);
    markCopied(button);
  };

  ui.copyDocument = (button?: HTMLElement) => {
    const body = doc.querySelector<HTMLElement>('.mdn-export-document, .mdn-export-main, .mdn-body');
    if (!body) return;
    copyText(cleanText(body), doc);
    markCopied(button ?? null);
  };

  ui.toggleCodeCollapse = (button: HTMLElement) => {
    const wrap = button.closest<HTMLElement>('.mdn-codeblock');
    if (!wrap) return;
    const collapsed = wrap.dataset.collapsed === 'true';
    wrap.dataset.collapsed = String(!collapsed);
    button.textContent = collapsed
      ? button.dataset.labelShowLess || 'Show less'
      : button.dataset.labelShowMore || 'Show more';
  };

  ui.toggleHtmlMode = (button: HTMLElement) => {
    const wrap = button.closest<HTMLElement>('.mdn-html-preview-wrap');
    if (wrap) setPortableHtmlMode(wrap, wrap.dataset.mode === 'preview' ? 'code' : 'preview');
  };
  ui.setHtmlMode = setPortableHtmlMode;

  ui.toggleCsvMode = (button: HTMLElement) => {
    const wrap = button.closest<HTMLElement>('.mdn-csv-preview-wrap');
    if (wrap) setPortableCsvMode(wrap, wrap.dataset.mode === 'preview' ? 'code' : 'preview');
  };
  ui.setCsvMode = setPortableCsvMode;

  ui.toggleSection = (header: HTMLElement) => {
    const section = header.closest<HTMLElement>('.mdn-section');
    if (!section) return;
    setHeadingSectionExpanded(section, section.dataset.expanded === 'false');
  };
  ui.expandAll = () => doc.querySelectorAll<HTMLElement>('.mdn-section')
    .forEach((section) => setHeadingSectionExpanded(section, true));
  ui.collapseAll = () => doc.querySelectorAll<HTMLElement>('.mdn-section')
    .forEach((section) => setHeadingSectionExpanded(section, false));
}