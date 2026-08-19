import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { registerIpcHandlers } = require('../../../electron/core/ipc-handlers.js');

describe('PDF export IPC dispatch', () => {
  it('forwards exportPdf messages to the native exporter handler', async () => {
    let listener!: (event: unknown, message: unknown) => Promise<void>;
    const exportPdf = vi.fn(async () => {});

    registerIpcHandlers({
      ipcMain: { on: vi.fn((_channel: string, handler: typeof listener) => { listener = handler; }) },
      clipboard: { writeText: vi.fn() },
      fs: { existsSync: vi.fn() },
      handlers: { exportPdf },
      getMainWindow: vi.fn(),
      shell: { openExternal: vi.fn(), openPath: vi.fn(), showItemInFolder: vi.fn() },
      platform: 'linux',
    });

    const message = {
      command: 'exportPdf',
      requestId: 'pdf-1',
      footerEnabled: true,
      documents: [{ fileName: 'readme.pdf', html: '<h1>Readme</h1>' }],
    };
    await listener(null, message);

    expect(exportPdf).toHaveBeenCalledWith(message);
  });
});
