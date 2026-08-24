type ExportWindow = Window & {
  UI?: Record<string, unknown>;
  __mdnExportHtmlPreviewInstalled?: boolean;
};

function iframeForButton(button: HTMLElement): HTMLIFrameElement | null {
  return button.closest('.mdn-html-preview-wrap')?.querySelector<HTMLIFrameElement>('.mdn-html-preview-iframe') ?? null;
}

function install(): void {
  const win = window as ExportWindow;
  if (win.__mdnExportHtmlPreviewInstalled) return;
  win.__mdnExportHtmlPreviewInstalled = true;
  const ui = win.UI ?? (win.UI = {});

  window.addEventListener('message', (event) => {
    const data = event.data as { type?: unknown; id?: unknown; height?: unknown } | null;
    if (!data || data.type !== 'resize-iframe' || typeof data.id !== 'string') return;
    if (typeof data.height !== 'number' || !Number.isFinite(data.height) || data.height <= 0) return;
    const iframe = document.getElementById(data.id) as HTMLIFrameElement | null;
    if (iframe) iframe.style.height = `${Math.ceil(data.height)}px`;
  });

  ui.openHtmlPreview = (button: HTMLElement) => {
    const iframe = iframeForButton(button);
    if (!iframe?.srcdoc) return;
    const url = URL.createObjectURL(new Blob([iframe.srcdoc], { type: 'text/html;charset=utf-8' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  ui.openHtmlPreviewModal = (button: HTMLElement) => {
    const source = iframeForButton(button);
    if (!source?.srcdoc) return;
    document.querySelector('.mdn-export-html-preview-modal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'mdn-modal mdn-html-preview-modal mdn-export-html-preview-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'HTML Preview');
    modal.innerHTML = '<button type="button" class="mdn-modal-close" aria-label="Close">×</button><div class="mdn-html-preview-modal__content"></div>';
    const frame = document.createElement('iframe');
    frame.className = 'mdn-html-preview-iframe mdn-html-preview-modal__iframe';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.srcdoc = source.srcdoc;
    modal.querySelector('.mdn-html-preview-modal__content')?.appendChild(frame);
    document.body.appendChild(modal);
    const close = () => { document.removeEventListener('keydown', onKeyDown); modal.remove(); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    modal.querySelector('.mdn-modal-close')?.addEventListener('click', close);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    document.addEventListener('keydown', onKeyDown);
  };
}

install();
