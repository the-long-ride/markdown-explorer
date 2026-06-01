const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  clipboard,
  Menu,
  shell,
  session,
} = require("electron");
const path = require("path");
const fs = require("fs");
const DesktopScanner = require("./scanner");

const appDir = app.isPackaged
  ? __dirname
  : path.join(__dirname, "..");

let mainWindow = null;
let activeWorkspace = null;
let currentFile = null;
let flatList = [];
let readyHandled = false;
const searchIndexCache = new Map();

// Electron zoom level maps roughly to factor = 1.2 ^ level.
// This range gives about 63% to 144%, enough zoom-out for dense views while keeping zoom-in guarded.
const ZOOM_LEVEL_MIN = -2.5;
const ZOOM_LEVEL_MAX = 2;
const ZOOM_LEVEL_STEP = 0.2;
const YOUTUBE_EMBED_REFERRER = "https://the-long-ride.github.io/markdown-explorer/";

// Remove default window menu bar
Menu.setApplicationMenu(null);

function isTruthyEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

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

function openDevToolsIfDebug() {
  if (!mainWindow || !isDebugMode()) return false;
  if (!mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  return true;
}

function toggleDevToolsIfDebug() {
  if (!mainWindow || !isDebugMode()) return false;
  if (mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.closeDevTools();
  } else {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  return true;
}

function configureYouTubeEmbedHeaders() {
  const filter = {
    urls: [
      "https://www.youtube.com/*",
      "https://www.youtube-nocookie.com/*",
    ],
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(
    filter,
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };
      const hasReferer = Object.keys(requestHeaders).some(
        (name) => name.toLowerCase() === "referer",
      );

      if (!hasReferer) {
        requestHeaders.Referer = YOUTUBE_EMBED_REFERRER;
      }

      callback({ requestHeaders });
    },
  );
}

const recentsFile = path.join(
  app.getPath("userData"),
  "recent-workspaces.json",
);

function loadRecentWorkspaces() {
  try {
    if (fs.existsSync(recentsFile)) {
      const data = fs.readFileSync(recentsFile, "utf8");
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error("Failed to load recent workspaces:", err);
  }
  return [];
}

function saveRecentWorkspace(folderPath) {
  let list = loadRecentWorkspaces();
  // Normalize and filter out duplicates
  const normPath = path.normalize(folderPath);
  list = list.filter((w) => path.normalize(w.path) !== normPath);
  // Add to top
  list.unshift({
    name: path.basename(folderPath) || folderPath,
    path: folderPath,
    lastOpened: Date.now(),
  });
  // Limit to 100 recents
  list = list.slice(0, 100);
  try {
    fs.writeFileSync(recentsFile, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save recent workspaces:", err);
  }
}

// Dynamic import of markdown parser compiled by VS Code build
let parse = null;
let HtmlRenderer = null;

function loadMarkdownParser() {
  if (parse && HtmlRenderer) return true;
  try {
    const parserPath = path.join(
      appDir,
      "vscode",
      "out",
      "markdown",
      "parser.js",
    );
    const rendererPath = path.join(
      appDir,
      "vscode",
      "out",
      "markdown",
      "renderer.js",
    );
    if (fs.existsSync(parserPath) && fs.existsSync(rendererPath)) {
      parse = require(parserPath).parse;
      HtmlRenderer = require(rendererPath).HtmlRenderer;
      return true;
    }
  } catch (err) {
    console.warn(
      "VS Code compiled markdown parser not found yet. Fallback is enabled.",
      err,
    );
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    isMaximized: true,
    center: true,
    frame: false, // frameless window
    icon: path.join(appDir, "ui", "assets", "logos", "logo-500.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Developer Tools are only available while debugging.
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const key = String(input.key || "").toLowerCase();
    const isDevToolsKey =
      (input.control && input.shift && key === "i") ||
      (input.meta && input.alt && key === "i") ||
      key === "f12";
    if (isDevToolsKey) {
      event.preventDefault();
      toggleDevToolsIfDebug();
    }
  });

  // Listen to window state changes to notify renderer
  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("host-message", {
      command: "window-state-changed",
      isMaximized: true,
    });
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("host-message", {
      command: "window-state-changed",
      isMaximized: false,
    });
  });

  // Block file-drop navigation at the main-process level. Renderer handles drops.
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (navigationUrl === currentUrl || navigationUrl.startsWith(`${currentUrl}#`)) {
      return;
    }
    event.preventDefault();
    if (/^https?:\/\//i.test(navigationUrl)) {
      void shell.openExternal(navigationUrl);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    clampAppZoom();
    if (shouldAutoOpenDevTools()) {
      openDevToolsIfDebug();
    }
  });
  const uiIndex = path.join(appDir, 'ui', 'dist', 'index.html');
  mainWindow.loadFile(uiIndex);

}

let tray = null;

app.whenReady().then(() => {
  configureYouTubeEmbedHeaders();
  createWindow();

  // Create System Tray Icon
  try {
    const iconPath = path.join(
      appDir,
      "ui",
      "assets",
      "logos",
      "logo-128.png",
    );
    if (fs.existsSync(iconPath)) {
      const { Tray, Menu: ElectronMenu } = require("electron");
      tray = new Tray(iconPath);
      const contextMenu = ElectronMenu.buildFromTemplate([
        {
          label: "Open Markdown Explorer",
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          },
        },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            app.quit();
          },
        },
      ]);
      tray.setToolTip("Markdown Explorer");
      tray.setContextMenu(contextMenu);
      tray.on("click", () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.focus();
          } else {
            mainWindow.show();
          }
        }
      });
    }
  } catch (err) {
    console.error("Failed to create tray icon:", err);
  }

  // Register IPC message handlers
  ipcMain.on("webview-message", async (event, msg) => {
    switch (msg.command) {
      case "ready":
        await handleReady();
        break;
            case "openFolder":
        handleOpenFolder(Boolean(msg.openFirstFile));
        break;
      case "openFile":
        handleOpenFile();
        break;
      case "openPath":
        handleOpenPath(msg.path, Boolean(msg.openFirstFile));
        break;
      case "activateWorkspace":
        handleActivateWorkspace(
          msg.workspacePath,
          msg.filePath,
          Boolean(msg.openFirstFile),
        );
        break;
      case "searchAcrossWorkspaces":
        handleSearchAcrossWorkspaces(msg);
        break;
      case "searchWorkspace":
        handleSearchWorkspace(msg);
        break;
      case "indexWorkspaceSearchItems":
        handleIndexWorkspaceSearchItems(msg);
        break;
      case "loadWorkspaceSearchIndexes":
        handleLoadWorkspaceSearchIndexes(msg);
        break;

      case "confirmOpenPath":
        handleConfirmOpenPath(msg.path);
        break;
      case "openRecentWorkspace":
        handleOpenRecent(msg.path, Boolean(msg.openFirstFile));
        break;
      case "deleteRecentWorkspace":
        handleDeleteRecentWorkspace(msg.path);
        break;
      case "closeWorkspace":
        handleCloseWorkspace();
        break;
      case "zoom-in":
        handleZoomIn();
        break;
      case "zoom-out":
        handleZoomOut();
        break;
      case "navigate":
        await handleNavigate(msg.path);
        break;
      case "openInEditor":
        if (msg.path && fs.existsSync(msg.path)) {
          const { shell } = require("electron");
          shell.openPath(msg.path);
        }
        break;
      case "copyCode":
        clipboard.writeText(msg.text);
        break;
      case "refresh":
        await handleRefresh();
        break;
      // Window control handlers
      case "window-minimize":
        if (mainWindow) mainWindow.minimize();
        break;
      case "window-maximize":
        if (mainWindow) {
          if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
          } else {
            mainWindow.maximize();
          }
        }
        break;
      case "window-close":
        if (mainWindow) mainWindow.close();
        break;
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleReady() {
  if (readyHandled) return;
  readyHandled = true;
  const recents = loadRecentWorkspaces();
  if (!activeWorkspace) {
    const ackMsg = {
      command: "readyAck",
      fileList: [],
      tree: null,
      theme: "dark",
      themeStyle: "default",
      defaultExpanded: true,
      workspaceName: "",
      workspacePath: undefined,
      recentWorkspaces: recents,
    };
    mainWindow.webContents.send("host-message", ackMsg);
  } else {
    await sendWorkspaceData();
  }
}

function handleOpenFolder(openFirstFile = false) {
  const folders = dialog.showOpenDialogSync(mainWindow, {
    properties: ["openDirectory"],
  });
  if (folders && folders.length > 0) {
    const selectedFolder = folders[0];
    saveRecentWorkspace(selectedFolder);
    activeWorkspace = selectedFolder;
    currentFile = null;
    sendWorkspaceData().then(() => sendInitialContent(openFirstFile));
  }
}

function handleOpenFile() {
  const files = dialog.showOpenDialogSync(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Markdown Files", extensions: ["md", "mdx"] }
    ]
  });
  if (files && files.length > 0) {
    const selectedFile = files[0];
    const folder = path.dirname(selectedFile);
    saveRecentWorkspace(folder);
    activeWorkspace = folder;
    currentFile = selectedFile;
    sendWorkspaceData().then(() => sendContent());
  }
}

function handleOpenPath(filePath, openFirstFile = false) {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  const isFile = stat.isFile();
  if (isFile) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".md" && ext !== ".mdx") {
      dialog.showMessageBoxSync(mainWindow, {
        type: "warning",
        buttons: ["OK"],
        title: "Unsupported File Type",
        message: "Markdown Explorer only supports opening .md and .mdx files.",
        detail: filePath,
      });
      return;
    }
    activeWorkspace = path.dirname(filePath);
    currentFile = filePath;
  } else {
    activeWorkspace = filePath;
    currentFile = null;
  }

  saveRecentWorkspace(activeWorkspace);
  sendWorkspaceData().then(() => sendInitialContent(openFirstFile && !isFile));
}

function handleActivateWorkspace(workspacePath, filePath, openFirstFile = false) {
  if (!workspacePath || !fs.existsSync(workspacePath)) return;
  activeWorkspace = workspacePath;
  currentFile = filePath && fs.existsSync(filePath) ? filePath : null;
  saveRecentWorkspace(activeWorkspace);
  sendWorkspaceData().then(() => sendInitialContent(openFirstFile));
}

function makeSearchExcerpt(text, index, queryLength) {
  const beforeText = text.slice(0, index).replace(/\s+/g, " ").trim();
  const matchText = text.slice(index, index + queryLength).replace(/\s+/g, " ").trim();
  const afterText = text.slice(index + queryLength).replace(/\s+/g, " ").trim();
  const beforeWords = beforeText ? beforeText.split(" ") : [];
  const afterWords = afterText ? afterText.split(" ") : [];
  const parts = [];

  if (beforeWords.length > 10) parts.push("...");
  parts.push(...beforeWords.slice(-10));
  if (matchText) parts.push(matchText);
  parts.push(...afterWords.slice(0, 10));
  if (afterWords.length > 10) parts.push("...");

  return parts.join(" ").trim();
}

function isMarkdownSearchPath(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  return ext === ".md" || ext === ".mdx";
}

function getSearchIndexEntry(filePath) {
  if (!filePath || !fs.existsSync(filePath) || !isMarkdownSearchPath(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);
  const cached = searchIndexCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const entry = {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    raw,
    lower: raw.toLowerCase(),
  };
  searchIndexCache.set(filePath, entry);
  return entry;
}

function primeSearchIndex(items) {
  const paths = [
    ...new Set(
      items
        .map((item) => item && item.fsPath)
        .filter((filePath) => filePath && isMarkdownSearchPath(filePath)),
    ),
  ];
  let index = 0;

  const step = () => {
    const end = Math.min(index + 25, paths.length);
    for (; index < end; index += 1) {
      try {
        getSearchIndexEntry(paths[index]);
      } catch (err) {
        console.error("Failed to index file for search:", paths[index], err);
      }
    }

    if (index < paths.length) {
      setTimeout(step, 0);
    }
  };

  step();
}

function searchMarkdownItems(query, items, limit = 80) {
  if (!query || query.length < 2) {
    return [];
  }

  const results = [];
  const maxMatchesPerFile = 8;
  for (const item of items) {
    if (!item.fsPath || !fs.existsSync(item.fsPath)) continue;
    if (!isMarkdownSearchPath(item.fsPath)) continue;

    const fileName = item.fileName || path.basename(item.fsPath);
    const relativePath = item.relativePath || fileName;
    const title = item.title || fileName.replace(/\.(md|mdx)$/i, "");
    const titleScore = String(title).toLowerCase().includes(query) ? 5 : 0;
    const fileNameScore = String(fileName).toLowerCase().includes(query) ? 4 : 0;
    const pathScore = String(relativePath).toLowerCase().includes(query) ? 2 : 0;
    const baseScore = titleScore + fileNameScore + pathScore;
    const contentMatches = [];

    try {
      const searchEntry = getSearchIndexEntry(item.fsPath);
      if (searchEntry) {
        let index = searchEntry.lower.indexOf(query);
        let ordinal = 0;
        while (index !== -1 && contentMatches.length < maxMatchesPerFile) {
          contentMatches.push({
            index,
            ordinal,
            excerpt: makeSearchExcerpt(searchEntry.raw, index, query.length),
          });
          ordinal += 1;
          index = searchEntry.lower.indexOf(query, index + query.length);
        }
      }
    } catch (err) {
      console.error("Failed to search file:", item.fsPath, err);
    }

    if (contentMatches.length > 0) {
      for (const match of contentMatches) {
        results.push({
          ...item,
          title,
          fileName,
          relativePath,
          excerpt: match.excerpt,
          matchIndex: match.index,
          matchOrdinal: match.ordinal,
          score: baseScore + 3 - Math.min(match.ordinal, 20) / 100,
        });
      }
      continue;
    }

    if (baseScore > 0) {
      results.push({
        ...item,
        title,
        fileName,
        relativePath,
        excerpt: "",
        score: baseScore,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(({ score, ...result }) => result);
}

function handleSearchAcrossWorkspaces(msg) {
  const query = String(msg.query || "").trim().toLowerCase();
  const requestId = msg.requestId;
  const items = Array.isArray(msg.items) ? msg.items : [];
  mainWindow.webContents.send("host-message", {
    command: "crossTabSearchResults",
    requestId,
    results: searchMarkdownItems(query, items, 80),
  });
}

function handleSearchWorkspace(msg) {
  const query = String(msg.query || "").trim().toLowerCase();
  const requestId = msg.requestId;
  const items = Array.isArray(msg.items) && msg.items.length > 0 ? msg.items : flatList;
  mainWindow.webContents.send("host-message", {
    command: "workspaceSearchResults",
    requestId,
    results: searchMarkdownItems(query, items, 80),
  });
}

function handleIndexWorkspaceSearchItems(msg) {
  const items = Array.isArray(msg.items) ? msg.items : [];
  setTimeout(() => primeSearchIndex(items), 0);
}

function handleLoadWorkspaceSearchIndexes(msg) {
  const tabRequests = Array.isArray(msg.tabs) ? msg.tabs : [];
  setTimeout(() => {
    const tabs = tabRequests.flatMap((tab) => {
      const tabId = String(tab?.tabId || "");
      const workspacePath = String(tab?.workspacePath || "");
      if (!tabId || !workspacePath || !fs.existsSync(workspacePath)) return [];

      const { tree, flat } = scanWorkspaceData(workspacePath);
      primeSearchIndex(flat);
      return [{
        tabId,
        workspacePath,
        fileList: flat,
        tree,
      }];
    });

    if (tabs.length > 0) {
      mainWindow.webContents.send("host-message", {
        command: "workspaceSearchIndexLoaded",
        tabs,
      });
    }
  }, 0);
}

async function handleConfirmOpenPath(filePath) {
  if (!fs.existsSync(filePath)) return;
  if (!activeWorkspace) {
    handleOpenPath(filePath);
    return;
  }
  const stat = fs.statSync(filePath);
  const isFile = stat.isFile();
  if (isFile) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".md" && ext !== ".mdx") {
      dialog.showMessageBoxSync(mainWindow, {
        type: "warning",
        buttons: ["OK"],
        title: "Unsupported File Type",
        message: "Markdown Explorer only supports opening .md and .mdx files.",
        detail: filePath,
      });
      return;
    }
  }

  const targetFolder = isFile ? path.dirname(filePath) : filePath;
  const targetName = path.basename(targetFolder) || targetFolder;
  const currentName = activeWorkspace
    ? (path.basename(activeWorkspace) || activeWorkspace)
    : "current workspace";
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Switch", "Cancel"],
    title: "Switch Workspace",
    message: `Switch to "${targetName}"?`,
    detail: `Current workspace: ${currentName}\nNew path: ${filePath}`,
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    handleOpenPath(filePath);
  }
}

function handleOpenRecent(folderPath, openFirstFile = false) {
  if (fs.existsSync(folderPath)) {
    saveRecentWorkspace(folderPath);
    activeWorkspace = folderPath;
    if (fs.statSync(folderPath).isFile()) {
      currentFile = folderPath;
      sendWorkspaceData().then(() => sendInitialContent(false));
    } else {
      currentFile = null;
      sendWorkspaceData().then(() => sendInitialContent(openFirstFile));
    }
  } else {
    // Remove invalid path
    let list = loadRecentWorkspaces();
    list = list.filter(
      (w) => path.normalize(w.path) !== path.normalize(folderPath),
    );
    fs.writeFileSync(recentsFile, JSON.stringify(list, null, 2), "utf8");
    readyHandled = false;
    handleReady();
  }
}

function handleDeleteRecentWorkspace(folderPath) {
  try {
    let list = loadRecentWorkspaces();
    const normPath = path.normalize(folderPath);
    list = list.filter((w) => path.normalize(w.path) !== normPath);
    fs.writeFileSync(recentsFile, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to delete recent workspace:", err);
  }
  readyHandled = false;
  handleReady();
}

function handleZoomIn() {
  if (!mainWindow) return;
  const currentZoom = mainWindow.webContents.getZoomLevel();
  setAppZoomLevel(currentZoom + ZOOM_LEVEL_STEP);
}

function handleZoomOut() {
  if (!mainWindow) return;
  const currentZoom = mainWindow.webContents.getZoomLevel();
  setAppZoomLevel(currentZoom - ZOOM_LEVEL_STEP);
}

function clampZoomLevel(zoomLevel) {
  return Math.min(ZOOM_LEVEL_MAX, Math.max(ZOOM_LEVEL_MIN, zoomLevel));
}

function normalizeZoomStep(zoomLevel) {
  return Math.round(zoomLevel / ZOOM_LEVEL_STEP) * ZOOM_LEVEL_STEP;
}

function setAppZoomLevel(zoomLevel) {
  if (!mainWindow) return;
  const nextZoom = clampZoomLevel(normalizeZoomStep(zoomLevel));
  mainWindow.webContents.setZoomLevel(nextZoom);
}

function clampAppZoom() {
  if (!mainWindow) return;
  setAppZoomLevel(mainWindow.webContents.getZoomLevel());
}

function handleCloseWorkspace() {
  readyHandled = false;
  activeWorkspace = null;
  currentFile = null;
  handleReady();
}

async function handleNavigate(filePath) {
  if (!filePath) {
    currentFile = null;
    await sendWelcome();
    return;
  }

  if (!path.isAbsolute(filePath) && activeWorkspace) {
    const isFile = fs.statSync(activeWorkspace).isFile();
    const baseDir = isFile ? path.dirname(activeWorkspace) : activeWorkspace;
    filePath = path.resolve(baseDir, filePath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    currentFile = filePath;
    await sendContent();
  } else {
    mainWindow.webContents.send("host-message", {
      command: "navNotFound",
      href: filePath,
    });
  }
}

async function handleRefresh() {
  if (activeWorkspace) {
    await sendWorkspaceData();
    if (currentFile) {
      await sendContent();
    } else {
      await sendWelcome();
    }
  }
}

function scanWorkspaceData(workspacePath) {
  let tree = null;
  let flat = [];

  try {
    const isFile = fs.statSync(workspacePath).isFile();
    if (isFile) {
      const ext = path.extname(workspacePath).toLowerCase();
      if (ext === ".md" || ext === ".mdx") {
        const entry = DesktopScanner.buildFileEntry(workspacePath, path.dirname(workspacePath));
        flat = [entry];
        tree = DesktopScanner.buildTree(flat);
      }
    } else {
      const result = DesktopScanner.scan(workspacePath);
      tree = result.tree;
      flat = result.flat;
    }
  } catch (err) {
    console.error("Failed to scan workspace data:", err);
  }

  return { tree, flat };
}

async function sendWorkspaceData() {
  if (!activeWorkspace) return;
  const { tree, flat } = scanWorkspaceData(activeWorkspace);
  flatList = flat;

  const workspaceName = path.basename(activeWorkspace);
  const recents = loadRecentWorkspaces();

  const ackMsg = {
    command: "readyAck",
    fileList: flat,
    tree: tree,
    theme: "dark",
    themeStyle: "default",
    defaultExpanded: true,
    workspaceName: workspaceName,
    workspacePath: activeWorkspace,
    recentWorkspaces: recents,
  };
  mainWindow.webContents.send("host-message", ackMsg);
}

async function sendInitialContent(openFirstFile = false) {
  if (openFirstFile && !currentFile && flatList.length > 0) {
    currentFile = flatList[0].fsPath;
  }

  if (currentFile) {
    await sendContent();
  } else {
    await sendWelcome();
  }
}

function shouldKeepResourceUrl(src) {
  return /^(https?:|data:|file:|blob:|vscode-webview:|#)/i.test(src);
}

function toFileResourceUrl(markdownFile, src) {
  if (shouldKeepResourceUrl(src)) return src;
  const fileDir = path.dirname(markdownFile);
  const absolutePath = path.resolve(fileDir, src);
  return "file:///" + absolutePath.replace(/\\/g, "/");
}

function rewriteRelativeMediaUrls(html, markdownFile) {
  const srcAttrRegex = /(<(?:img|video|source|track)\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi;
  const posterAttrRegex = /(<video\b[^>]*?\bposter\s*=\s*)(["'])([^"']+)(\2)/gi;

  const rewriteAttr = (match, prefix, quote, src, suffix) => {
    try {
      return `${prefix}${quote}${toFileResourceUrl(markdownFile, src)}${suffix}`;
    } catch (err) {
      console.error("Failed to resolve relative media path:", src, err);
      return match;
    }
  };

  return html
    .replace(srcAttrRegex, rewriteAttr)
    .replace(posterAttrRegex, rewriteAttr);
}

async function sendContent() {
  if (!currentFile || !activeWorkspace) return;
  loadMarkdownParser();

  let raw = "";
  try {
    raw = fs.readFileSync(currentFile, "utf8");
  } catch (err) {
    console.error("Failed to read file:", currentFile, err);
  }

  let html = "";
  let frontmatter = {};
  let toc = [];

  if (parse && HtmlRenderer) {
    const isMdx = currentFile.endsWith(".mdx");
    const parsed = parse(raw, isMdx);
    const renderer = new HtmlRenderer({ theme: "dark", isMdx });
    const rendered = renderer.render(parsed.tokens);
    html = rendered.html;
    frontmatter = parsed.frontmatter;
    toc = rendered.toc;
  } else {
    html = `<div style="padding: 20px; font-family: monospace; white-space: pre-wrap;">${raw}</div>`;
  }

  // Rewrite local image/video paths to file:/// URIs.
  html = rewriteRelativeMediaUrls(html, currentFile);

  const isWorkspaceFile = fs.statSync(activeWorkspace).isFile();
  const baseDir = isWorkspaceFile ? path.dirname(activeWorkspace) : activeWorkspace;
  const fileInfo = flatList.find((f) => f.fsPath === currentFile) || {
    relativePath: path.relative(baseDir, currentFile),
    title: path.basename(currentFile).replace(/\.(md|mdx)$/i, ""),
  };

  const msg = {
    command: "renderContent",
    html: html,
    frontmatter: frontmatter,
    toc: toc,
    filePath: currentFile,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: flatList,
  };
  mainWindow.webContents.send("host-message", msg);
}

async function sendWelcome() {
  const msg = {
    command: "renderContent",
    html: "",
    frontmatter: {},
    toc: [],
    filePath: "",
    relativePath: "Welcome Page",
    title: "Welcome",
    fileList: flatList,
  };
  mainWindow.webContents.send("host-message", msg);
}
