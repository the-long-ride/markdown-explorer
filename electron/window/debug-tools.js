function isTruthyEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

function createDebugTools({ isPackaged, env = process.env, argv = process.argv } = {}) {
  function isDebugMode() {
    return (
      !isPackaged ||
      isTruthyEnv(env.MARKDOWN_EXPLORER_DEBUG) ||
      argv.includes("--debug") ||
      argv.includes("--devtools")
    );
  }

  function shouldAutoOpenDevTools() {
    return (
      isTruthyEnv(env.MARKDOWN_EXPLORER_DEBUG) ||
      argv.includes("--devtools")
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
