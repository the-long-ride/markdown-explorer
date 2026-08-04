const { createRuntimeWorkspaceSearchHelpers } = require("./runtime-workspace-search");
const { createWorkspaceTextResourceReader } = require("./runtime-workspace-resources");
const { nextIncrementalPublishCount } = require("../workspace/incremental-publish");
const WORKSPACE_SCAN_REVEAL_DELAY_MS = 3000;
const WORKSPACE_SCAN_BATCH_SIZE = 32;

function registerRuntimeWorkspaceHandlers(context) {
  const { state, deps, pathApi, fs, getMainWindow, sendHostMessage, getHostInfo, sendLoading, sendRecentWorkspacesChanged, recentWorkspacesStore, scanWorkspaceData, createSearchIndex, createSearchWorkerController, isSupportedFilePathLite, isExtraDocumentFilePathLite, getFileTypeLabelLite, stripKnownExtensionLite, isAccessDeniedError, stripNavigationFragment, decodeNavigationPath, isRootRelativeWorkspaceHref, isSameOrInsidePath } = context;
  let workspaceScanGeneration = 0;

  function cancelWorkspaceScan(workspaceOperationId) {
    if (workspaceOperationId && state.workspaceOperationId && workspaceOperationId !== state.workspaceOperationId) {
      return false;
    }
    workspaceScanGeneration += 1;
    state.workspaceOperationId = null;
    state.workspaceTabId = null;
    return true;
  }

  function cancelAllWorkspaceScans() {
    workspaceScanGeneration += 1;
    state.workspaceOperationId = null;
    state.workspaceTabId = null;
    return true;
  }

  const { ensureSearchIndex, buildWorkspaceTree, ensureCrossTabSearchWorker } =
    createRuntimeWorkspaceSearchHelpers({ state, createSearchIndex, createSearchWorkerController, getMainWindow, sendHostMessage });

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
    const operation = {
      ...(state.workspaceOperationId ? { workspaceOperationId: state.workspaceOperationId } : {}),
      ...(state.workspaceTabId ? { workspaceTabId: state.workspaceTabId } : {}),
    };
    workspaceScanGeneration += 1;
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
      ...operation,
    });
    state.workspaceOperationId = null;
    state.workspaceTabId = null;
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

  function captureWorkspaceRefresh() {
    return {
      workspacePath: state.workspacePath,
      scanGeneration: workspaceScanGeneration,
      operation: {
        ...(state.workspaceOperationId ? { workspaceOperationId: state.workspaceOperationId } : {}),
        ...(state.workspaceTabId ? { workspaceTabId: state.workspaceTabId } : {}),
      },
    };
  }

  function isWorkspaceRefreshCurrent(request) {
    return state.workspacePath === request.workspacePath
      && workspaceScanGeneration === request.scanGeneration
      && state.workspaceOperationId === (request.operation.workspaceOperationId || null)
      && state.workspaceTabId === (request.operation.workspaceTabId || null);
  }

  async function sendWorkspaceFilesChanged() {
    const request = captureWorkspaceRefresh();
    const scanGeneration = request.scanGeneration;
    if (!request.workspacePath) return false;
    const status = getWorkspacePathStatus(request.workspacePath);
    if (!status.ok) {
      if (isWorkspaceRefreshCurrent(request)) {
        sendWorkspaceUnavailable(request.workspacePath, status.reason);
      }
      return false;
    }

    const { tree, flat } = await scanWorkspaceData(request.workspacePath, {
      operation: request.operation,
      isCurrent: () => isWorkspaceRefreshCurrent(request),
    });
    if (scanGeneration !== workspaceScanGeneration || !isWorkspaceRefreshCurrent(request)) return false;
    state.flatList = flat;
    const idx = ensureSearchIndex();
    idx.prime(flat);

    sendHostMessage({
      command: "workspaceFilesChanged",
      fileList: flat,
      tree,
      workspaceName: pathApi.basename(request.workspacePath),
      workspacePath: request.workspacePath,
      documentConversionEnabled: state.documentConversionEnabled,
      ...request.operation,
    });
    return true;
  }

  async function sendWorkspaceData() {
    if (!state.workspacePath) return false;
    const operation = {
      ...(state.workspaceOperationId ? { workspaceOperationId: state.workspaceOperationId } : {}),
      ...(state.workspaceTabId ? { workspaceTabId: state.workspaceTabId } : {}),
    };
    const status = getWorkspacePathStatus(state.workspacePath);
    if (!status.ok) {
      sendWorkspaceUnavailable(state.workspacePath, status.reason);
      return false;
    }

    const workspacePath = state.workspacePath;
    const scanGeneration = ++workspaceScanGeneration;
    const workspaceName = pathApi.basename(workspacePath);
    const recents = recentWorkspacesStore.load();
    let displayedWorkspace = false;
    let thresholdElapsed = false;
    let lastPublishedCount = 0;
    const discovered = [];
    const snapshot = () => {
      const fileList = [...discovered].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
      return { fileList, tree: buildWorkspaceTree(fileList) };
    };
    const publishReveal = () => {
      if (state.workspacePath !== workspacePath || scanGeneration !== workspaceScanGeneration || displayedWorkspace || discovered.length === 0) return;
      displayedWorkspace = true;
      const next = snapshot();
      lastPublishedCount = next.fileList.length;
      state.flatList = next.fileList;
      sendHostMessage({
        command: "readyAck", ...next, theme: "dark", themeStyle: "default",
        defaultExpanded: true, workspaceName, workspacePath, recentWorkspaces: recents,
        documentConversionEnabled: state.documentConversionEnabled, ...getHostInfo(),
      });
    };
    const publishChanged = () => {
      if (state.workspacePath !== workspacePath || scanGeneration !== workspaceScanGeneration) return;
      const next = snapshot();
      lastPublishedCount = next.fileList.length;
      state.flatList = next.fileList;
      sendHostMessage({
        command: "workspaceFilesChanged", ...next, workspaceName, workspacePath,
        documentConversionEnabled: state.documentConversionEnabled,
      });
    };
    const revealTimer = setTimeout(() => {
      if (state.workspacePath !== workspacePath || scanGeneration !== workspaceScanGeneration) return;
      thresholdElapsed = true;
      publishReveal();
    }, WORKSPACE_SCAN_REVEAL_DELAY_MS);
    const { tree, flat } = await scanWorkspaceData(workspacePath, {
      operation,
      isCurrent: () => state.workspacePath === workspacePath && scanGeneration === workspaceScanGeneration,
      onFile(file, scannedFiles) {
        if (state.workspacePath !== workspacePath || scanGeneration !== workspaceScanGeneration) return;
        discovered.push(file);
        if (thresholdElapsed && !displayedWorkspace) publishReveal();
        else if (displayedWorkspace && scannedFiles >= nextIncrementalPublishCount(lastPublishedCount, WORKSPACE_SCAN_BATCH_SIZE)) publishChanged();
      },
    });
    clearTimeout(revealTimer);
    if (state.workspacePath !== workspacePath || scanGeneration !== workspaceScanGeneration) return false;
    state.flatList = flat;
    const idx = ensureSearchIndex();
    idx.prime(flat);

    if (displayedWorkspace) {
      if (lastPublishedCount !== flat.length) sendHostMessage({
        command: "workspaceFilesChanged", fileList: flat, tree, workspaceName, workspacePath,
        documentConversionEnabled: state.documentConversionEnabled,
      });
    } else sendHostMessage({
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
    return true;
  }

  function captureWorkspaceRequest(filePath = state.currentFile) {
    return {
      workspacePath: state.workspacePath,
      filePath,
      scanGeneration: workspaceScanGeneration,
      operation: {
        ...(state.workspaceOperationId ? { workspaceOperationId: state.workspaceOperationId } : {}),
        ...(state.workspaceTabId ? { workspaceTabId: state.workspaceTabId } : {}),
      },
    };
  }

  function isWorkspaceRequestCurrent(request) {
    return state.workspacePath === request.workspacePath
      && state.currentFile === request.filePath
      && workspaceScanGeneration === request.scanGeneration;
  }

  async function sendInitialContent(openFirstFile = false) {
    if (openFirstFile && !state.currentFile && state.flatList.length > 0) {
      state.currentFile = state.flatList[0].fsPath;
    }
    const request = captureWorkspaceRequest();
    if (request.filePath) {
      await sendContent(request);
    } else {
      await sendWelcome(request);
    }
  }

  async function sendContent(request = captureWorkspaceRequest()) {
    const currentFile = request.filePath;
    const workspacePath = request.workspacePath;
    if (!currentFile || !workspacePath || !isWorkspaceRequestCurrent(request)) return;
    if (!isSupportedFilePathLite(currentFile, state.documentConversionEnabled)) {
      if (isWorkspaceRequestCurrent(request)) state.currentFile = null;
      await sendWelcome(captureWorkspaceRequest(null));
      return;
    }

    let raw = "";
    let sourceDocumentText = null;
    let previewInfo = null;
    const isHtmlDocument = /\.html?$/i.test(currentFile);
    try {
      if (isHtmlDocument) {
        sourceDocumentText = fs.readFileSync(currentFile, "utf8");
      } else {
        if (isExtraDocumentFilePathLite(currentFile)) {
          sendLoading(
            "Preparing document preview...",
            `Preparing ${getFileTypeLabelLite(currentFile)} preview locally.`,
          );
        }
        const result = await deps.documentConverter.readMarkdown(currentFile);
        raw = result.markdown;
        previewInfo = result.previewInfo;
      }
    } catch (err) {
      raw = isHtmlDocument ? "" : deps.documentConverter.createFailureMarkdown(currentFile, err);
      previewInfo = !isHtmlDocument && isExtraDocumentFilePathLite(currentFile)
        ? {
            kind: "converted",
            sourceExtension: pathApi.extname(currentFile).toLowerCase(),
            sourceLabel: getFileTypeLabelLite(currentFile),
            qualityWarning: "Markdown Explorer could not convert this file. The details are shown below.",
          }
        : null;
    }
    if (!isWorkspaceRequestCurrent(request)) return;

    const isWorkspaceFile = fs.statSync(workspacePath).isFile();
    const baseDir = isWorkspaceFile ? pathApi.dirname(workspacePath) : workspacePath;
    const fileInfo = state.flatList.find((f) => f.fsPath === currentFile) || {
      relativePath: pathApi.relative(baseDir, currentFile),
      title: stripKnownExtensionLite(pathApi.basename(currentFile)),
    };

    sendHostMessage({
      command: "renderContent",
      html: "",
      markdownSource: raw,
      sourceDocumentText,
      frontmatter: {},
      toc: [],
      filePath: currentFile,
      relativePath: fileInfo.relativePath,
      title: fileInfo.title,
      fileList: state.flatList,
      previewInfo,
      ...request.operation,
    });
  }


  const readWorkspaceTextResource = createWorkspaceTextResourceReader({
    fs, pathApi, sendHostMessage, isSameOrInsidePath, getWorkspaceBaseDir,
  });

  async function sendWelcome(request = captureWorkspaceRequest(null)) {
    if (request.workspacePath !== state.workspacePath
      || request.scanGeneration !== workspaceScanGeneration) return;
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
      ...request.operation,
    });
  }

  return { ensureSearchIndex, ensureCrossTabSearchWorker, getWorkspacePathStatus, sendWorkspaceUnavailable, getWorkspaceBaseDir, isCurrentFileStillAvailable, resolveNavigationPath, sendCurrentFileChanged, sendWorkspaceFilesChanged, sendWorkspaceData, sendInitialContent, sendContent, sendWelcome, readWorkspaceTextResource, cancelWorkspaceScan, cancelAllWorkspaceScans };
}

module.exports = {
  registerRuntimeWorkspaceHandlers,
  WORKSPACE_SCAN_REVEAL_DELAY_MS,
  WORKSPACE_SCAN_BATCH_SIZE,
};
