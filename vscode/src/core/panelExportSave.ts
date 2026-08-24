export async function handlePanelExportSaveMessage(
  message: { command?: string; requestId?: string; fileName?: string; mimeType?: string; dataBase64?: string },
  vscodeApi: typeof import('vscode'),
  respond: (message: Record<string, unknown>) => Thenable<boolean>,
): Promise<boolean> {
  if (message.command !== 'saveExportFile') return false;

  const requestId = message.requestId ?? '';
  if (typeof message.dataBase64 !== 'string') {
    await respond({ command: 'exportFileSaveResult', requestId, ok: false, error: 'Missing export data' });
    return true;
  }

  try {
    const selected = await vscodeApi.window.showSaveDialog({
      title: 'Save export',
      saveLabel: 'Save',
    });
    if (!selected) {
      await respond({ command: 'exportFileSaveResult', requestId, ok: false, cancelled: true });
      return true;
    }
    const bytes = Uint8Array.from(Buffer.from(message.dataBase64, 'base64'));
    await vscodeApi.workspace.fs.writeFile(selected, bytes);
    await respond({
      command: 'exportFileSaveResult', requestId, ok: true, path: selected.fsPath,
    });
  } catch (error) {
    await respond({
      command: 'exportFileSaveResult', requestId, ok: false,
      error: error instanceof Error ? error.message : 'Unable to save export file',
    });
  }
  return true;
}
