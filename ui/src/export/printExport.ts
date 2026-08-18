export type PrintExportResult = 'printed' | 'cancelled';
export type PrintExportFunction = (documentHtml: string, title: string) => Promise<PrintExportResult>;

export function printExportHtml(documentHtml: string, title: string): Promise<PrintExportResult> {
  if (typeof document === 'undefined') return Promise.resolve('cancelled');

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.position = 'fixed';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';

    let settled = false;
    const finish = (result: PrintExportResult) => {
      if (settled) return;
      settled = true;
      try { iframe.remove(); } catch {}
      resolve(result);
    };

    iframe.addEventListener('load', () => {
      const win = iframe.contentWindow;
      if (!win) {
        finish('cancelled');
        return;
      }

      try {
        const onAfterPrint = () => {
          win.removeEventListener?.('afterprint', onAfterPrint);
          finish('printed');
        };
        win.addEventListener?.('afterprint', onAfterPrint, { once: true });
        try {
          if (win.document?.title !== undefined) win.document.title = title;
        } catch {}
        win.focus();
        win.print();
      } catch {
        finish('cancelled');
      }
    }, { once: true });

    iframe.srcdoc = documentHtml;
    document.body.appendChild(iframe);
  });
}

export async function printExportBatch(
  documents: readonly { html: string; title: string }[],
  printer: PrintExportFunction = printExportHtml,
): Promise<number> {
  let printed = 0;
  for (const document of documents) {
    const result = await printer(document.html, document.title);
    if (result === 'printed') printed += 1;
  }
  return printed;
}
