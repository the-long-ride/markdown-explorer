import path from 'node:path/posix';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createPdfExporter, PDF_FOOTER_TEXT } = require('../../../electron/core/pdf-export.js');

function makeHarness(dialogResult = { canceled: false, filePaths: ['/exports'] }) {
  const printToPDF = vi.fn(async () => Buffer.from('pdf-data'));
  const loadFile = vi.fn(async () => {});
  const destroy = vi.fn();
  const instances: any[] = [];
  class BrowserWindow {
    webContents = { printToPDF };
    loadFile = loadFile;
    destroy = destroy;
    isDestroyed = vi.fn(() => false);
    constructor(public options: unknown) { instances.push(this); }
  }
  const fs = {
    mkdtempSync: vi.fn(() => '/tmp/mdn-pdf-abc'),
    writeFileSync: vi.fn(),
    rmSync: vi.fn(),
  };
  const dialog = { showOpenDialog: vi.fn(async () => dialogResult) };
  const sendHostMessage = vi.fn();
  const exporter = createPdfExporter({
    BrowserWindow,
    dialog,
    fs,
    path,
    os: { tmpdir: () => '/tmp' },
    getMainWindow: () => ({ id: 'main' }),
    sendHostMessage,
  });
  return { exporter, printToPDF, loadFile, destroy, instances, fs, dialog, sendHostMessage };
}

describe('native PDF exporter', () => {
  it('chooses one output folder, writes PDF directly, and emits only the requested footer', async () => {
    const h = makeHarness();
    await h.exporter({
      requestId: 'pdf-1',
      footerEnabled: true,
      footerText: PDF_FOOTER_TEXT,
      documents: [{ fileName: 'Readme.pdf', html: '<!doctype html><h1>Readme</h1>' }],
    });

    expect(h.dialog.showOpenDialog).toHaveBeenCalledWith({ id: 'main' }, expect.objectContaining({ properties: ['openDirectory'] }));
    expect(h.printToPDF).toHaveBeenCalledWith(expect.objectContaining({
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: expect.not.stringContaining('Readme'),
      footerTemplate: expect.stringContaining(PDF_FOOTER_TEXT),
    }));
    expect(h.fs.writeFileSync).toHaveBeenCalledWith('/exports/Readme.pdf', expect.any(Buffer));
    expect(h.sendHostMessage).toHaveBeenCalledWith({
      command: 'exportPdfResult', requestId: 'pdf-1', ok: true, paths: ['/exports/Readme.pdf'],
    });
    expect(h.destroy).toHaveBeenCalled();
    expect(h.fs.rmSync).toHaveBeenCalledWith('/tmp/mdn-pdf-abc', { recursive: true, force: true });
  });

  it('omits all PDF header/footer output when the footer option is off', async () => {
    const h = makeHarness();
    await h.exporter({
      requestId: 'pdf-2',
      footerEnabled: false,
      documents: [{ fileName: 'Readme.pdf', html: '<h1>Readme</h1>' }],
    });

    expect(h.printToPDF).toHaveBeenCalledWith(expect.objectContaining({ displayHeaderFooter: false }));
  });

  it('reports destination picker cancellation without creating a renderer', async () => {
    const h = makeHarness({ canceled: true, filePaths: [] });
    await h.exporter({ requestId: 'pdf-3', footerEnabled: true, documents: [{ fileName: 'a.pdf', html: '<p>A</p>' }] });

    expect(h.instances).toHaveLength(0);
    expect(h.sendHostMessage).toHaveBeenCalledWith({
      command: 'exportPdfResult', requestId: 'pdf-3', ok: false, cancelled: true, paths: [],
    });
  });

  it('sanitizes output file names so documents cannot escape the selected directory', async () => {
    const h = makeHarness();
    await h.exporter({ requestId: 'pdf-4', documents: [{ fileName: '../outside.pdf', html: '<p>A</p>' }] });
    expect(h.fs.writeFileSync).toHaveBeenCalledWith('/exports/outside.pdf', expect.any(Buffer));
  });

  it('reserves case-insensitive unique names for separate PDF batches', async () => {
    const h = makeHarness();
    await h.exporter({
      requestId: 'pdf-5',
      documents: [
        { fileName: 'Topic.pdf', html: '<p>Upper</p>' },
        { fileName: 'topic.pdf', html: '<p>Lower</p>' },
      ],
    });

    const pdfWrites = h.fs.writeFileSync.mock.calls
      .filter(([target]) => String(target).startsWith('/exports/'))
      .map(([target]) => String(target));
    expect(pdfWrites).toHaveLength(2);
    expect(new Set(pdfWrites.map((target) => target.toLowerCase())).size).toBe(2);
    expect(h.sendHostMessage).toHaveBeenCalledWith(expect.objectContaining({
      command: 'exportPdfResult',
      requestId: 'pdf-5',
      ok: true,
      paths: pdfWrites,
    }));
  });
});
