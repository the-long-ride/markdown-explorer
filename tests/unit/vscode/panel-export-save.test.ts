import { describe, expect, it, vi } from 'vitest';
import { handlePanelExportSaveMessage } from '../../../vscode/src/core/panelExportSave';

function vscodeHarness(saveUri: any = { fsPath: '/tmp/docs.zip' }) {
  const writeFile = vi.fn(async () => {});
  const showSaveDialog = vi.fn(async () => saveUri);
  const vscodeApi: any = {
    window: { showSaveDialog },
    workspace: { fs: { writeFile } },
    Uri: { file: (value: string) => ({ fsPath: value }) },
  };
  return { vscodeApi, writeFile, showSaveDialog };
}

describe('VS Code generic export save', () => {
  it('writes decoded export bytes and reports the selected path', async () => {
    const sent: any[] = [];
    const harness = vscodeHarness();
    const handled = await handlePanelExportSaveMessage({
      command: 'saveExportFile', requestId: 'save-1', fileName: 'docs.zip',
      mimeType: 'application/zip', dataBase64: 'AQID/w==',
    }, harness.vscodeApi, (message) => { sent.push(message); return Promise.resolve(true); });

    expect(handled).toBe(true);
    expect([...harness.writeFile.mock.calls[0][1]]).toEqual([1, 2, 3, 255]);
    expect(sent[0]).toEqual({
      command: 'exportFileSaveResult', requestId: 'save-1', ok: true, path: '/tmp/docs.zip',
    });
  });

  it('reports cancellation without writing', async () => {
    const sent: any[] = [];
    const harness = vscodeHarness(undefined);
    harness.showSaveDialog.mockResolvedValueOnce(undefined);
    await handlePanelExportSaveMessage({
      command: 'saveExportFile', requestId: 'save-2', fileName: 'docs.zip', dataBase64: 'AQ==',
    }, harness.vscodeApi, (message) => { sent.push(message); return Promise.resolve(true); });

    expect(harness.writeFile).not.toHaveBeenCalled();
    expect(sent[0]).toEqual({
      command: 'exportFileSaveResult', requestId: 'save-2', ok: false, cancelled: true,
    });
  });

  it('ignores unrelated commands', async () => {
    const harness = vscodeHarness();
    await expect(handlePanelExportSaveMessage(
      { command: 'refresh' }, harness.vscodeApi, () => Promise.resolve(true),
    )).resolves.toBe(false);
  });

  it('rejects missing export data before opening the save dialog', async () => {
    const { vscodeApi, showSaveDialog } = vscodeHarness();
    const respond = vi.fn(async () => true);
    await expect(handlePanelExportSaveMessage({ command: 'saveExportFile' }, vscodeApi, respond)).resolves.toBe(true);
    expect(showSaveDialog).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith({ command: 'exportFileSaveResult', requestId: '', ok: false, error: 'Missing export data' });
  });

  it.each([
    [new Error('disk is full'), 'disk is full'],
    ['unexpected failure', 'Unable to save export file'],
  ])('reports writing errors for the originating export: %s', async (failure, error) => {
    const { vscodeApi, writeFile } = vscodeHarness();
    writeFile.mockRejectedValueOnce(failure);
    const respond = vi.fn(async () => true);
    await handlePanelExportSaveMessage({ command: 'saveExportFile', requestId: 'export', dataBase64: 'AQ==' }, vscodeApi, respond);
    expect(respond).toHaveBeenCalledWith({ command: 'exportFileSaveResult', requestId: 'export', ok: false, error });
  });
});
