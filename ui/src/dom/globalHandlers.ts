import { registerCodeLineHandlers } from './codeLineHandlers';
import { registerCopyHandlers } from './copyHandlers';
import { registerTableHandlers } from './tableHandlers';

export function initGlobalHandlers() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;

  // Listen for iframe resizing messages from HTML preview sandboxes
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'resize-iframe') {
      const iframe = document.getElementById(data.id) as HTMLIFrameElement | null;
      if (iframe) {
        const maxH = window.innerHeight * 0.8;
        const height = Math.min(data.height, maxH);
        iframe.style.height = `${height}px`;
      }
    }
  });

  // UI.toggleSection
  if (!win.UI) win.UI = {};
  win.UI.toggleSection = (headerEl: HTMLElement) => {
    const section = headerEl.closest('.mdn-section') as HTMLElement | null;
    if (!section) return;
    const expanded = section.dataset.expanded === 'true';
    section.dataset.expanded = expanded ? 'false' : 'true';
    headerEl.setAttribute('aria-expanded', String(!expanded));
  };
  win.UI.expandAll = () => {
    document.querySelectorAll('.mdn-section').forEach((s) => {
      (s as HTMLElement).dataset.expanded = 'true';
    });
  };
  win.UI.collapseAll = () => {
    document.querySelectorAll('.mdn-section').forEach((s) => {
      (s as HTMLElement).dataset.expanded = 'false';
    });
  };
  win.UI.setHtmlMode = (wrap: HTMLElement, mode: string) => {
    wrap.dataset.mode = mode;
    const langLabel = wrap.querySelector('.mdn-codeblock-lang') as HTMLElement | null;
    const previewBody = wrap.querySelector('.mdn-html-preview-body') as HTMLElement | null;
    const codeBody = wrap.querySelector('.mdn-codeblock-body') as HTMLElement | null;
    const toggleBtn = wrap.querySelector('.mdn-toggle-preview-btn') as HTMLElement | null;
    const tooltipText = wrap.querySelector('.mdn-toggle-preview-btn .tooltip-text') as HTMLElement | null;
    if (mode === 'preview') {
      if (langLabel) langLabel.textContent = 'HTML Preview';
      if (previewBody) previewBody.style.display = '';
      if (codeBody) codeBody.style.display = 'none';
      if (tooltipText) tooltipText.textContent = 'Show Code';
      if (toggleBtn) {
        const svg = toggleBtn.querySelector('svg');
        if (svg) {
          svg.outerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>';
        }
      }
    } else {
      if (langLabel) langLabel.textContent = 'HTML';
      if (previewBody) previewBody.style.display = 'none';
      if (codeBody) codeBody.style.display = 'flex';
      if (tooltipText) tooltipText.textContent = 'Show Preview';
      if (toggleBtn) {
        const svg = toggleBtn.querySelector('svg');
        if (svg) {
          svg.outerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
      }
    }
  };
  win.UI.toggleHtmlMode = (btn: HTMLElement) => {
    const wrap = btn.closest('.mdn-codeblock') as HTMLElement | null;
    if (!wrap) return;
    const currentMode = wrap.dataset.mode || 'preview';
    win.UI.setHtmlMode(wrap, currentMode === 'preview' ? 'code' : 'preview');
  };
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
