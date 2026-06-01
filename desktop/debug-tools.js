function isTruthyEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

function createDebugTools(app) {
  function isDebugMode() {
    return (
      !app.isPackaged ||
      isTruthyEnv(process.env.MARKDOWN_EXPLORER_DEBUG) ||
      process.argv.includes("--debug") ||
      process.argv.includes("--devtools")
    );
  }

  function shouldAutoOpenDevTools() {
    return (
      isTruthyEnv(process.env.MARKDOWN_EXPLORER_DEBUG) ||
      process.argv.includes("--devtools")
    );
  }

  function openDevToolsIfDebug(window) {
    if (!window || !isDebugMode()) return false;
    if (!window.webContents.isDevToolsOpened()) {
      window.webContents.openDevTools({ mode: "detach" });
    }
    return true;
  }

  function toggleDevToolsIfDebug(window) {
    if (!window || !isDebugMode()) return false;
    if (window.webContents.isDevToolsOpened()) {
      window.webContents.closeDevTools();
    } else {
      window.webContents.openDevTools({ mode: "detach" });
    }
    return true;
  }

  return {
    shouldAutoOpenDevTools,
    openDevToolsIfDebug,
    toggleDevToolsIfDebug,
  };
}

module.exports = { createDebugTools };
