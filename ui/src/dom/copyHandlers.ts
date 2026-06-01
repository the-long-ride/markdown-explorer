export function registerCopyHandlers(win: any) {
  const copyText = (text: string) => {
    if (!text) return;
    if (win.PlatformBridge) {
      win.PlatformBridge.copyToClipboard(text);
    } else {
      void navigator.clipboard.writeText(text);
    }
  };

  const textFromElement = (source: HTMLElement) => {
    const clone = source.cloneNode(true) as HTMLElement;
    clone.querySelectorAll([
      '.tooltip-text',
      '.mdn-anchor',
      '.mdn-section-copy-btn',
      '.mdn-section-chevron',
      '.mdn-copy-btn',
      '.mdn-toggle-preview-btn',
      '.mdn-codeblock-toggle-btn',
      '.mdn-codeblock-lang',
      '.mdn-table-toolbar',
      '.mdn-table-filter-btn',
      '.mdn-sort-icon',
    ].join(',')).forEach((el) => el.remove());
    return (clone.innerText || clone.textContent || '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const markCopied = (btn: HTMLElement | null | undefined, resetText: string) => {
    if (!btn) return;
    const feedbackBtn = btn as HTMLElement & { __copyResetTimer?: number };
    if (feedbackBtn.__copyResetTimer) {
      window.clearTimeout(feedbackBtn.__copyResetTimer);
    }

    btn.classList.add('is-copied');
    const tooltip = btn.querySelector('.tooltip-text');
    if (tooltip) tooltip.textContent = 'Copied!';
    feedbackBtn.__copyResetTimer = window.setTimeout(() => {
      btn.classList.remove('is-copied');
      if (tooltip) tooltip.textContent = resetText;
      feedbackBtn.__copyResetTimer = undefined;
    }, 2000);
  };

  win.UI.copySection = (btn: HTMLElement, event?: Event) => {
    event?.stopPropagation();
    const section = btn.closest('.mdn-section') as HTMLElement | null;
    const body = Array.from(section?.children ?? [])
      .find((child) => child.classList.contains('mdn-section-body')) as HTMLElement | undefined;
    if (!body) return;
    try {
      copyText(textFromElement(body));
      markCopied(btn, 'Copy section content');
    } catch (err) {
      console.warn('Failed to copy section to clipboard:', err);
    }
  };

  win.UI.copyDocument = (btn?: HTMLElement | null) => {
    const body = document.getElementById('mdBody') as HTMLElement | null;
    if (!body) return;
    try {
      copyText(textFromElement(body));
      markCopied(btn, 'Copy file content');
    } catch (err) {
      console.warn('Failed to copy document to clipboard:', err);
    }
  };

  // UI.copyCode (global function referenced by HTML code blocks)
  win.UI.copyCode = (btn: HTMLElement) => {
    const code = btn.closest('.mdn-codeblock')?.querySelector('code')?.innerText ?? '';
    try {
      copyText(code);
    } catch (err) {
      console.warn('Failed to copy code to clipboard:', err);
    }
    markCopied(btn, 'Copy code');
  };
  win.UI_copyCode = win.UI.copyCode;
}
