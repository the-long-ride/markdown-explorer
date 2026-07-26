import { registerCodeLineHandlers } from './codeLineHandlers';
import { registerCopyHandlers } from './copyHandlers';
import { registerTableHandlers } from './tableHandlers';

export function toggleSection(headerEl: HTMLElement) {
  const section = headerEl.closest('.mdn-section') as HTMLElement | null;
  if (!section) return;
  const expanded = section.dataset.expanded === 'true';
  section.dataset.expanded = expanded ? 'false' : 'true';
  headerEl.setAttribute('aria-expanded', String(!expanded));
}

export function expandAll() {
  document.querySelectorAll('.mdn-section').forEach((s) => {
    (s as HTMLElement).dataset.expanded = 'true';
  });
}

export function collapseAll() {
  document.querySelectorAll('.mdn-section').forEach((s) => {
    (s as HTMLElement).dataset.expanded = 'false';
  });
}

export function setHtmlMode(wrap: HTMLElement, mode: string) {
  wrap.dataset.mode = mode;
  const langLabel = wrap.querySelector('.mdn-codeblock-lang') as HTMLElement | null;
  const previewBody = wrap.querySelector('.mdn-html-preview-body') as HTMLElement | null;
  const codeSource = (wrap.querySelector('.mdn-code-source')
    || wrap.querySelector('.mdn-codeblock-body')) as HTMLElement | null;
  const toggleBtn = wrap.querySelector('.mdn-toggle-preview-btn') as HTMLElement | null;
  const tooltipText = wrap.querySelector('.mdn-toggle-preview-btn .tooltip-text') as HTMLElement | null;
  if (mode === 'preview') {
    const previewLabel = langLabel?.dataset.translatedPreviewLabel || langLabel?.dataset.previewLabel || 'HTML Preview';
    if (langLabel) langLabel.textContent = previewLabel;
    if (previewBody) previewBody.style.display = '';
    if (codeSource) codeSource.style.display = 'none';
    const showCodeLabel = toggleBtn?.dataset.labelShowCode || 'Show Code';
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
    const showPreviewLabel = toggleBtn?.dataset.labelShowPreview || 'Show Preview';
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
  const previewLabel = langLabel?.dataset.translatedPreviewLabel || langLabel?.dataset.previewLabel || 'CSV Preview';
  const preview = mode === 'preview';
  if (langLabel) langLabel.textContent = preview ? previewLabel : codeLabel;
  if (previewBody) previewBody.style.display = preview ? '' : 'none';
  if (codeSource) codeSource.style.display = preview ? 'none' : '';
  if (!toggleBtn) return;
  const nextLabel = preview
    ? toggleBtn.dataset.labelShowCode || 'Show Code'
    : toggleBtn.dataset.labelShowPreview || 'Show Preview';
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

export function triggerToggleCodeCollapse(btn: HTMLElement) {
  const wrap = btn.closest('.mdn-codeblock') as HTMLElement | null;
  if (!wrap) return;
  const isCollapsed = wrap.dataset.collapsed === 'true';
  wrap.dataset.collapsed = isCollapsed ? 'false' : 'true';
  btn.textContent = isCollapsed ? 'Show Less' : 'Show More';
}

export function initGlobalHandlers() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;

  // Listen for iframe resizing messages from HTML preview sandboxes
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'resize-iframe') {
      const iframe = document.getElementById(data.id) as HTMLIFrameElement | null;
      if (iframe) {
        const maxH = Math.max(640, window.innerHeight * 0.9);
        const height = Math.min(data.height, maxH);
        iframe.style.height = `${height}px`;
      }
    }
  });

  // UI.toggleSection
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

  // Sidebar.toggleFolder (for inline handlers)
  if (!win.Sidebar) win.Sidebar = {};
  win.Sidebar.toggleFolder = (el: HTMLElement) => {
    const folder = el.closest('.tree-folder') as HTMLElement | null;
    if (!folder) return;
    folder.classList.toggle('is-open');
    const children = folder.querySelector('.tree-folder__children') as HTMLElement | null;
    if (children) children.classList.toggle('is-hidden', !folder.classList.contains('is-open'));
  };

  // Nav.go (for inline handlers)
  if (!win.Nav) win.Nav = {};
  win.Nav.go = (_fsPath: string | null) => {
    // Handled by React navigate - but provide fallback for rendered HTML links
  };
}
