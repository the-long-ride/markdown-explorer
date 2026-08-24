import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createExportSaveHandler } = require('../../../electron/core/runtime-export-save.js');

describe('Electron export save handler', () => {
  it('opens a save dialog, writes decoded bytes, and reports the path', async () => {
    const sent: any[] = [];
    const writeFileSync = vi.fn();
    const handler = createExportSaveHandler({
      dialog: { showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: '/tmp/docs.zip' })) },
      fs: { writeFileSync },
      pathApi: require('node:path'),
      getMainWindow: () => ({ id: 1 }),
      sendHostMessage: (message: any) => sent.push(message),
    });

    await handler({
      requestId: 'save-1', fileName: 'docs.zip', mimeType: 'application/zip', dataBase64: 'AQID/w==',
    });

    expect(writeFileSync).toHaveBeenCalledTimes(1);
    expect([...writeFileSync.mock.calls[0][1]]).toEqual([1, 2, 3, 255]);
    expect(sent[0]).toEqual({
      command: 'exportFileSaveResult', requestId: 'save-1', ok: true, path: '/tmp/docs.zip',
    });
  });

  it('reports cancellation without writing', async () => {
    const sent: any[] = [];
    const writeFileSync = vi.fn();
    const handler = createExportSaveHandler({
      dialog: { showSaveDialog: vi.fn(async () => ({ canceled: true })) },
      fs: { writeFileSync },
      pathApi: require('node:path'),
      getMainWindow: () => null,
      sendHostMessage: (message: any) => sent.push(message),
    });

    await handler({ requestId: 'save-2', fileName: '../bad:name?.pdf', dataBase64: 'AQ==' });

    expect(writeFileSync).not.toHaveBeenCalled();
    expect(sent[0]).toEqual({
      command: 'exportFileSaveResult', requestId: 'save-2', ok: false, cancelled: true,
    });
  });

  it('reports malformed requests as errors', async () => {
    const sent: any[] = [];
    const handler = createExportSaveHandler({
      dialog: { showSaveDialog: vi.fn() }, fs: { writeFileSync: vi.fn() }, pathApi: require('node:path'),
      getMainWindow: () => null, sendHostMessage: (message: any) => sent.push(message),
    });

    await handler({ requestId: 'save-3', fileName: 'x.bin' });
    expect(sent[0]).toMatchObject({ command: 'exportFileSaveResult', requestId: 'save-3', ok: false });
    expect(sent[0].error).toMatch(/export data/i);
  });
});
