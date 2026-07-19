function registerRuntimeWorkspaceHandlers(context) {
  const { state, deps, pathApi, fs, getMainWindow, sendHostMessage, getHostInfo, sendLoading, sendRecentWorkspacesChanged, recentWorkspacesStore, scanWorkspaceData, createSearchIndex, createSearchWorkerController, isSupportedFilePathLite, isExtraDocumentFilePathLite, getFileTypeLabelLite, stripKnownExtensionLite, isAccessDeniedError, stripNavigationFragment, decodeNavigationPath, isRootRelativeWorkspaceHref, isSameOrInsidePath } = context;

  function ensureSearchIndex() {
    if (!state.searchIndex) state.searchIndex = createSearchIndex();
    return state.searchIndex;
  }

  function ensureCrossTabSearchWorker() {
    if (state.crossTabSearchWorker) return state.crossTabSearchWorker;
    state.crossTabSearchWorker = createSearchWorkerController({
      onMessage(message) {
        const win = getMainWindow();
        if (!win || win.isDestroyed()) return;
        if (message.type === "batch") {
          sendHostMessage({
            command: "crossTabSearchResults",
            requestId: message.requestId,
            results: message.results,
            done: false,
          });
          return;
        }
        if (message.type === "done" || message.type === "error") {
          sendHostMessage({
            command: "crossTabSearchResults",
            requestId: message.requestId,
            results: [],
            done: true,
            total: message.total || 0,
            truncated: Boolean(message.truncated),
            cancelled: Boolean(message.cancelled),
            error: message.type === "error" ? message.message : undefined,
          });
        }
      },
    });
    return state.crossTabSearchWorker;
  }

  function getWorkspacePathStatus(wsPath) {
    if (!wsPath || typeof wsPath !== "string") {
      return { ok: false, reason: "missing" };
    }
    try {
      fs.accessSync(wsPath, fs.constants.R_OK);
      const stat = fs.statSync(wsPath);
      return { ok: true, stat };
    } catch (err) {
      return {
        ok: false,
        reason: isAccessDeniedError(err) ? "locked" : "missing",
      };
    }
  }

  function sendWorkspaceUnavailable(wsPath, reason = "missing") {
    if (state.workspaceWatch) state.workspaceWatch.dispose();
    state.workspacePath = null;
    state.currentFile = null;
    state.flatList = [];
    sendHostMessage({
      command: "workspaceUnavailable",
      workspacePath: wsPath,
      workspaceName: pathApi.basename(wsPath || "") || wsPath || "Workspace",
      reason,
      recentWorkspaces: recentWorkspacesStore.load(),
      ...getHostInfo(),
    });
  }

  function getWorkspaceBaseDir() {
    if (!state.workspacePath || !fs.existsSync(state.workspacePath)) return null;
    return fs.statSync(state.workspacePath).isFile()
      ? pathApi.dirname(state.workspacePath)
      : state.workspacePath;
  }

  function isCurrentFileStillAvailable() {
    if (!state.currentFile) return false;
    const status = getWorkspacePathStatus(state.currentFile);
    if (!status.ok || !status.stat.isFile()) return false;
    if (!isSupportedFilePathLite(state.currentFile, state.documentConversionEnabled)) return false;
    return state.flatList.some((file) => file.fsPath === state.currentFile);
  }

  function resolveNavigationPath(filePath) {
    const requestedPath = decodeNavigationPath(stripNavigationFragment(String(filePath)));
    if (!requestedPath && state.currentFile) return state.currentFile;

    const baseDir = getWorkspaceBaseDir();
    const currentDir = state.currentFile ? pathApi.dirname(state.currentFile) : baseDir;

    if (baseDir && pathApi.isAbsolute(requestedPath) && isSameOrInsidePath(baseDir, requestedPath, pathApi)) {
      return requestedPath;
    }

    if (baseDir && isRootRelativeWorkspaceHref(requestedPath)) {
      return pathApi.resolve(baseDir, `.${requestedPath}`);
    }

    if (!pathApi.isAbsolute(requestedPath) && currentDir) {
      return pathApi.resolve(currentDir, requestedPath);
    }

    return requestedPath;
  }

  function sendCurrentFileChanged() {
    if (!state.currentFile) return;
    sendHostMessage({
      command: "currentFileChanged",
      filePath: state.currentFile,
    });
  }

  async function sendWorkspaceFilesChanged() {
    if (!state.workspacePath) return;
    const status = getWorkspacePathStatus(state.workspacePath);
    if (!status.ok) {
      sendWorkspaceUnavailable(state.workspacePath, status.reason);
      return;
    }

    const { tree, flat } = await scanWorkspaceData(state.workspacePath);
    state.flatList = flat;
    const idx = ensureSearchIndex();
    idx.prime(flat);

    sendHostMessage({
      command: "workspaceFilesChanged",
      fileList: flat,
      tree,
      workspaceName: pathApi.basename(state.workspacePath),
      workspacePath: state.workspacePath,
      documentConversionEnabled: state.documentConversionEnabled,
    });
  }

  async function sendWorkspaceData() {
    if (!state.workspacePath) return;
    const status = getWorkspacePathStatus(state.workspacePath);
    if (!status.ok) {
      sendWorkspaceUnavailable(state.workspacePath, status.reason);
      return;
    }

    const workspacePath = state.workspacePath;
    const workspaceName = pathApi.basename(workspacePath);
    const recents = recentWorkspacesStore.load();
    let displayedWorkspace = false;
    const revealTimer = setTimeout(() => {
      if (state.workspacePath !== workspacePath) return;
      displayedWorkspace = true;
      sendHostMessage({
        command: "readyAck",
        fileList: [],
        tree: null,
        theme: "dark",
        themeStyle: "default",
        defaultExpanded: true,
        workspaceName,
        workspacePath,
        recentWorkspaces: recents,
        documentConversionEnabled: state.documentConversionEnabled,
        ...getHostInfo(),
      });
    }, 2500);
    const { tree, flat } = await scanWorkspaceData(workspacePath);
    clearTimeout(revealTimer);
    if (state.workspacePath !== workspacePath) return;
    state.flatList = flat;
    const idx = ensureSearchIndex();
    idx.prime(flat);

    sendHostMessage(displayedWorkspace ? {
      command: "workspaceFilesChanged",
      fileList: flat,
      tree,
      workspaceName,
      workspacePath,
      documentConversionEnabled: state.documentConversionEnabled,
    } : {
      command: "readyAck",
      fileList: flat,
      tree,
      theme: "dark",
      themeStyle: "default",
      defaultExpanded: true,
      workspaceName,
      workspacePath,
      recentWorkspaces: recents,
      documentConversionEnabled: state.documentConversionEnabled,
      ...getHostInfo(),
    });
  }

  async function sendInitialContent(openFirstFile = false) {
    if (openFirstFile && !state.currentFile && state.flatList.length > 0) {
      state.currentFile = state.flatList[0].fsPath;
    }
    if (state.currentFile) {
      await sendContent();
    } else {
      await sendWelcome();
    }
  }

  async function sendContent() {
    if (!state.currentFile || !state.workspacePath) return;
    if (!isSupportedFilePathLite(state.currentFile, state.documentConversionEnabled)) {
      state.currentFile = null;
      await sendWelcome();
      return;
    }

    let raw = "";
    let previewInfo = null;
    try {
      if (isExtraDocumentFilePathLite(state.currentFile)) {
        sendLoading(
          "Preparing document preview...",
          `Preparing ${getFileTypeLabelLite(state.currentFile)} preview locally.`,
        );
      }
      const result = await deps.documentConverter.readMarkdown(state.currentFile);
      raw = result.markdown;
      previewInfo = result.previewInfo;
    } catch (err) {
      raw = deps.documentConverter.createFailureMarkdown(state.currentFile, err);
      previewInfo = isExtraDocumentFilePathLite(state.currentFile)
        ? {
            kind: "converted",
            sourceExtension: pathApi.extname(state.currentFile).toLowerCase(),
            sourceLabel: getFileTypeLabelLite(state.currentFile),
            qualityWarning: "Markdown Explorer could not convert this file. The details are shown below.",
          }
        : null;
    }

    const isWorkspaceFile = fs.statSync(state.workspacePath).isFile();
    const baseDir = isWorkspaceFile ? pathApi.dirname(state.workspacePath) : state.workspacePath;
    const fileInfo = state.flatList.find((f) => f.fsPath === state.currentFile) || {
      relativePath: pathApi.relative(baseDir, state.currentFile),
      title: stripKnownExtensionLite(pathApi.basename(state.currentFile)),
    };

    sendHostMessage({
      command: "renderContent",
      html: "",
      markdownSource: raw,
      frontmatter: {},
      toc: [],
      filePath: state.currentFile,
      relativePath: fileInfo.relativePath,
      title: fileInfo.title,
      fileList: state.flatList,
      previewInfo,
    });
  }

  async function sendWelcome() {
    sendHostMessage({
      command: "renderContent",
      html: "",
      markdownSource: "",
      frontmatter: {},
      toc: [],
      filePath: "",
      relativePath: "Welcome Page",
      title: "Welcome",
      fileList: state.flatList,
      previewInfo: null,
    });
  }

  return { ensureSearchIndex, ensureCrossTabSearchWorker, getWorkspacePathStatus, sendWorkspaceUnavailable, getWorkspaceBaseDir, isCurrentFileStillAvailable, resolveNavigationPath, sendCurrentFileChanged, sendWorkspaceFilesChanged, sendWorkspaceData, sendInitialContent, sendContent, sendWelcome };
}

module.exports = { registerRuntimeWorkspaceHandlers };
