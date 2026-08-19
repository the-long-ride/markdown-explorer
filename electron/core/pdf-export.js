const os = require('os');
const path = require('path');

const PDF_FOOTER_TEXT = 'Markdown Explorer - @the-long-ride';

function safePdfFileName(value) {
  const base = path.basename(typeof value === 'string' ? value : 'document.pdf');
  const cleaned = base.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').trim();
  const withExtension = cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned || 'document'}.pdf`;
  return withExtension || 'document.pdf';
}

function footerTemplate(text) {
  const escaped = String(text || PDF_FOOTER_TEXT)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `<div style="width:100%;font-size:8px;text-align:center;color:#666;font-family:system-ui,sans-serif;">${escaped}</div>`;
}

function createPdfExporter({
  BrowserWindow,
  dialog,
  fs,
  path: pathApi = path,
  os: osApi = os,
  getMainWindow,
  sendHostMessage,
}) {
  return async function exportPdf(message = {}) {
    const requestId = typeof message.requestId === 'string' ? message.requestId : '';
    const documents = Array.isArray(message.documents)
      ? message.documents.filter((entry) => entry && typeof entry.html === 'string' && entry.html.trim())
      : [];

    if (documents.length === 0) {
      sendHostMessage({ command: 'exportPdfResult', requestId, ok: false, paths: [], error: 'No PDF documents were provided.' });
      return;
    }

    let selection;
    try {
      selection = await dialog.showOpenDialog(getMainWindow?.(), {
        title: 'Choose PDF output folder',
        buttonLabel: 'Export',
        properties: ['openDirectory'],
      });
    } catch (error) {
      sendHostMessage({ command: 'exportPdfResult', requestId, ok: false, paths: [], error: String(error?.message || error) });
      return;
    }

    if (selection?.canceled || !selection?.filePaths?.length) {
      sendHostMessage({ command: 'exportPdfResult', requestId, ok: false, cancelled: true, paths: [] });
      return;
    }

    const outputDirectory = selection.filePaths[0];
    const temporaryDirectory = fs.mkdtempSync(pathApi.join(osApi.tmpdir(), 'markdown-explorer-pdf-'));
    const savedPaths = [];
    let renderer;

    try {
      renderer = new BrowserWindow({
        width: 980,
        height: 1200,
        show: false,
        skipTaskbar: true,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          javascript: false,
        },
      });

      for (let index = 0; index < documents.length; index += 1) {
        const document = documents[index];
        const htmlPath = pathApi.join(temporaryDirectory, `document-${index}.html`);
        fs.writeFileSync(htmlPath, document.html, 'utf8');
        await renderer.loadFile(htmlPath);

        const showFooter = message.footerEnabled !== false;
        const pdfData = await renderer.webContents.printToPDF({
          printBackground: true,
          displayHeaderFooter: showFooter,
          headerTemplate: showFooter ? '<div></div>' : undefined,
          footerTemplate: showFooter ? footerTemplate(message.footerText) : undefined,
          pageSize: 'A4',
          preferCSSPageSize: true,
          margins: {
            top: 0.35,
            bottom: showFooter ? 0.5 : 0.35,
            left: 0.35,
            right: 0.35,
          },
        });

        const outputPath = pathApi.join(outputDirectory, safePdfFileName(document.fileName));
        fs.writeFileSync(outputPath, pdfData);
        savedPaths.push(outputPath);
      }

      sendHostMessage({ command: 'exportPdfResult', requestId, ok: true, paths: savedPaths });
    } catch (error) {
      sendHostMessage({
        command: 'exportPdfResult',
        requestId,
        ok: false,
        paths: savedPaths,
        error: String(error?.message || error),
      });
    } finally {
      try {
        if (renderer && !renderer.isDestroyed?.()) renderer.destroy();
      } catch {}
      try {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
      } catch {}
    }
  };
}

module.exports = { createPdfExporter, safePdfFileName, footerTemplate, PDF_FOOTER_TEXT };
