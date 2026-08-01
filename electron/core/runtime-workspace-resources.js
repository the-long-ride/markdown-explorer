function createWorkspaceTextResourceReader({
  fs,
  pathApi,
  sendHostMessage,
  isSameOrInsidePath,
  getWorkspaceBaseDir,
}) {
  return function readWorkspaceTextResource(message = {}) {
    const requestId = String(message.requestId || "");
    const respond = (payload) => sendHostMessage({ command: "workspaceTextResourceResult", requestId, ...payload });
    if (!requestId || !message.documentPath || !message.resourcePath) {
      respond({ ok: false, reason: "unsupported" });
      return;
    }
    const baseDir = getWorkspaceBaseDir();
    if (!baseDir) {
      respond({ ok: false, reason: "missing" });
      return;
    }
    const reference = String(message.resourcePath).split(/[?#]/, 1)[0];
    if (!reference || /^(?:https?:|data:|blob:|javascript:)/i.test(reference)) {
      respond({ ok: false, reason: "unsupported" });
      return;
    }
    try {
      let resolvedPath;
      if (/^file:\/\//i.test(reference)) {
        const url = new URL(reference);
        resolvedPath = decodeURIComponent(url.pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
      } else if (reference.startsWith("/")) {
        resolvedPath = pathApi.resolve(baseDir, `.${reference}`);
      } else {
        resolvedPath = pathApi.isAbsolute(reference)
          ? pathApi.normalize(reference)
          : pathApi.resolve(pathApi.dirname(String(message.documentPath)), reference);
      }
      if (!/\.(?:css|js|mjs|cjs)$/i.test(resolvedPath)
        || !isSameOrInsidePath(baseDir, resolvedPath, pathApi)) {
        respond({ ok: false, reason: "outside-workspace" });
        return;
      }
      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        respond({ ok: false, reason: "missing" });
        return;
      }
      const workspaceReal = fs.realpathSync(baseDir);
      const targetReal = fs.realpathSync(resolvedPath);
      if (!isSameOrInsidePath(workspaceReal, targetReal, pathApi)) {
        respond({ ok: false, reason: "outside-workspace" });
        return;
      }
      respond({ ok: true, content: fs.readFileSync(targetReal, "utf8"), resolvedPath: targetReal });
    } catch {
      respond({ ok: false, reason: "unreadable" });
    }
  };
}

module.exports = { createWorkspaceTextResourceReader };
