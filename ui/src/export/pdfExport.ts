import type { PlatformBridge } from '../platform/bridge';

export const PDF_FOOTER_TEXT = 'Markdown Explorer - @the-long-ride';

export interface PdfExportDocument {
  fileName: string;
  html: string;
}

export interface PdfExportRequest {
  documents: readonly PdfExportDocument[];
  footerEnabled: boolean;
}

export interface PdfExportResult {
  ok: boolean;
  cancelled?: boolean;
  paths: string[];
  error?: string;
}

export function exportPdfViaHost(
  bridge: PlatformBridge,
  request: PdfExportRequest,
  timeoutMs = 120_000,
): Promise<PdfExportResult> {
  const requestId = `export-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PdfExportResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command !== 'exportPdfResult' || message.requestId !== requestId) return;
      finish({
        ok: message.ok,
        cancelled: message.cancelled,
        paths: [...(message.paths ?? [])],
        error: message.error,
      });
    });
    const timer = window.setTimeout(() => {
      finish({ ok: false, paths: [], error: 'PDF export timed out.' });
    }, timeoutMs);

    try {
      bridge.postMessage({
        command: 'exportPdf',
        requestId,
        footerEnabled: request.footerEnabled,
        footerText: PDF_FOOTER_TEXT,
        documents: request.documents.map((document) => ({ ...document })),
      });
    } catch (error) {
      finish({
        ok: false,
        paths: [],
        error: error instanceof Error ? error.message : 'PDF export is unavailable.',
      });
    }
  });
}
