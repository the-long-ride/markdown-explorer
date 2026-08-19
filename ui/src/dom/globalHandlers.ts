import { registerCodeLineHandlers } from './codeLineHandlers';
import { registerCopyHandlers } from './copyHandlers';
import { registerTableHandlers } from './tableHandlers';
import { collapseAll, expandAll, toggleSection } from './headingSectionHandlers';
export {
  HEADING_SECTION_STATE_CHANGE_EVENT,
  collapseAll,
  expandAll,
  toggleSection,
} from './headingSectionHandlers';

export function setHtmlMode(wrap: HTMLElement, mode: string) {
  wrap.dataset.mode = mode;
  const langLabel = wrap.querySelector('.mdn-codeblock-lang') as HTMLElement | null;
  const previewBody = wrap.querySelector('.mdn-html-preview-body') as HTMLElement | null;
  const codeSource = (wrap.querySelector('.mdn-code-source')
    || wrap.querySelector('.mdn-codeblock-body')) as HTMLElement | null;
  const toggleBtn = wrap.querySelector('.mdn-toggle-preview-btn') as HTMLElement | null;
  const tooltipText = wrap.querySelector('.mdn-toggle-preview-btn .tooltip-text') as HTMLElement | null;
  if (mode === 'preview') {
    const previewLabel = langLabel?.dataset.translatedPreviewLabel || langLabel?.dataset.previewLabel || '';
    if (langLabel) langLabel.textContent = previewLabel;
    if (previewBody) previewBody.style.display = '';
    if (codeSource) codeSource.style.display = 'none';
    const showCodeLabel = toggleBtn?.dataset.labelShowCode || toggleBtn?.getAttribute('title') || '';
    if (tooltipText) tooltipText.textContent = showCodeLabel;
    if (toggleBtn) {
      toggleBtn.title = showCodeLabel;
      toggleBtn.setAttribute('aria-label', showCodeLabel);
      toggleBtn.dataset.i18nKey = 'showCode';
      const svg = toggleBtn.querySelector('svg');
      if (svg) {
        svg.outerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>';
      }
    }
  } else {
    if (langLabel) langLabel.textContent = 'HTML';
    if (previewBody) previewBody.style.display = 'none';
    if (codeSource) codeSource.style.display = '';
    const showPreviewLabel = toggleBtn?.dataset.labelShowPreview || toggleBtn?.getAttribute('title') || '';
    if (tooltipText) tooltipText.textContent = showPreviewLabel;
    if (toggleBtn) {
      toggleBtn.title = showPreviewLabel;
      toggleBtn.setAttribute('aria-label', showPreviewLabel);
      toggleBtn.dataset.i18nKey = 'showPreview';
      const svg = toggleBtn.querySelector('svg');
      if (svg) {
        svg.outerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
      }
    }
  }
}

export function toggleHtmlMode(btn: HTMLElement) {
  const wrap = btn.closest('.mdn-codeblock') as HTMLElement | null;
  if (!wrap) return;
  const currentMode = wrap.dataset.mode || 'preview';
  setHtmlMode(wrap, currentMode === 'preview' ? 'code' : 'preview');
}

export function setCsvMode(wrap: HTMLElement, mode: string) {
  wrap.dataset.mode = mode;
  const langLabel = wrap.querySelector<HTMLElement>('.mdn-codeblock-lang');
  const previewBody = wrap.querySelector<HTMLElement>('.mdn-csv-preview-body');
  const codeSource = wrap.querySelector<HTMLElement>('.mdn-code-source');
  const toggleBtn = wrap.querySelector<HTMLElement>('.mdn-toggle-csv-btn');
  const tooltipText = toggleBtn?.querySelector<HTMLElement>('.tooltip-text');
  const codeLabel = langLabel?.dataset.codeLabel || 'CSV';
  const previewLabel = langLabel?.dataset.translatedPreviewLabel || langLabel?.dataset.previewLabel || '';
  const preview = mode === 'preview';
  if (langLabel) langLabel.textContent = preview ? previewLabel : codeLabel;
  if (previewBody) previewBody.style.display = preview ? '' : 'none';
  if (codeSource) codeSource.style.display = preview ? 'none' : '';
  if (!toggleBtn) return;
  const nextLabel = preview
    ? toggleBtn.dataset.labelShowCode || toggleBtn.getAttribute('title') || ''
    : toggleBtn.dataset.labelShowPreview || toggleBtn.getAttribute('title') || '';
  toggleBtn.title = nextLabel;
  toggleBtn.setAttribute('aria-label', nextLabel);
  toggleBtn.dataset.i18nKey = preview ? 'showCode' : 'showPreview';
  if (tooltipText) tooltipText.textContent = nextLabel;
  const svg = toggleBtn.querySelector('svg');
  if (svg) svg.outerHTML = preview
    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>'
    : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
}

export function toggleCsvMode(btn: HTMLElement) {
  const wrap = btn.closest<HTMLElement>('.mdn-csv-preview-wrap');
  if (!wrap) return;
  setCsvMode(wrap, wrap.dataset.mode === 'preview' ? 'code' : 'preview');
}

export function applyHtmlPreviewResize(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const message = data as { type?: unknown; id?: unknown; height?: unknown };
  if (message.type !== 'resize-iframe' || typeof message.id !== 'string') return false;
  if (typeof message.height !== 'number' || !Number.isFinite(message.height) || message.height <= 0) return false;
  const iframe = document.getElementById(message.id) as HTMLIFrameElement | null;
  if (!iframe) return false;
  iframe.style.height = `${Math.ceil(message.height)}px`;
  return true;
}

export function initGlobalHandlers() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;

  window.addEventListener('message', (event) => {
    applyHtmlPreviewResize(event.data);
  });

  if (!win.UI) win.UI = {};
  win.UI.toggleSection = toggleSection;
  win.UI.expandAll = expandAll;
  win.UI.collapseAll = collapseAll;
  win.UI.setHtmlMode = setHtmlMode;
  win.UI.toggleHtmlMode = toggleHtmlMode;
  win.UI.setCsvMode = setCsvMode;
  win.UI.toggleCsvMode = toggleCsvMode;
  win.UI.openHtmlPreview ||= () => {};
  win.UI.openHtmlPreviewModal ||= () => {};
  win.UI.refresh = () => {
    // Handled by React bridge, but provide a fallback
  };

  registerCopyHandlers(win);
  registerCodeLineHandlers();
  registerTableHandlers(win);

  if (!win.Sidebar) win.Sidebar = {};
  win.Sidebar.toggleFolder = (el: HTMLElement) => {
    const folder = el.closest('.tree-folder') as HTMLElement | null;
    if (!folder) return;
    folder.classList.toggle('is-open');
    const children = folder.querySelector('.tree-folder__children') as HTMLElement | null;
    if (children) children.classList.toggle('is-hidden', !folder.classList.contains('is-open'));
  };

  if (!win.Nav) win.Nav = {};
  win.Nav.go = (_fsPath: string | null) => {
    // Handled by React navigate - but provide fallback for rendered HTML links
  };
}
