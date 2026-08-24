function safeExportFileName(value, pathApi) {
  const leaf = pathApi.basename(String(value || 'export.bin'));
  return leaf.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim() || 'export.bin';
}

function createExportSaveHandler({ dialog, fs, pathApi, getMainWindow, sendHostMessage }) {
  return async function saveExportFile(message = {}) {
    const requestId = String(message.requestId || '');
    if (typeof message.dataBase64 !== 'string') {
      sendHostMessage({
        command: 'exportFileSaveResult', requestId, ok: false, error: 'Missing export data',
      });
      return;
    }

    const fileName = safeExportFileName(message.fileName, pathApi);
    try {
      const options = { title: 'Save export', defaultPath: fileName };
      const owner = getMainWindow?.();
      const result = owner
        ? await dialog.showSaveDialog(owner, options)
        : await dialog.showSaveDialog(options);
      if (result?.canceled || !result?.filePath) {
        sendHostMessage({ command: 'exportFileSaveResult', requestId, ok: false, cancelled: true });
        return;
      }

      fs.writeFileSync(result.filePath, Buffer.from(message.dataBase64, 'base64'));
      sendHostMessage({
        command: 'exportFileSaveResult', requestId, ok: true, path: result.filePath,
      });
    } catch (error) {
      sendHostMessage({
        command: 'exportFileSaveResult', requestId, ok: false,
        error: error instanceof Error ? error.message : 'Unable to save export file',
      });
    }
  };
}

module.exports = { createExportSaveHandler, safeExportFileName };
