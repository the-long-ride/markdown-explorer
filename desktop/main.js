const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  clipboard,
  Menu,
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

// Electron zoom level maps roughly to factor = 1.2 ^ level.
// This range gives about 63% to 144%, enough zoom-out for dense views while keeping zoom-in guarded.
const ZOOM_LEVEL_MIN = -2.5;
const ZOOM_LEVEL_MAX = 2;
const ZOOM_LEVEL_STEP = 0.2;

// Remove default window menu bar
Menu.setApplicationMenu(null);

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

  // Block Developer Tools shortcut in production release build
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (app.isPackaged) {
      const isDevToolsKey =
        (input.control && input.shift && input.key.toLowerCase() === "i") ||
        (input.meta && input.alt && input.key.toLowerCase() === "i") ||
        input.key === "F12";
      if (isDevToolsKey) {
        event.preventDefault();
      }
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

  // TODO: Drop-to-open workspace is disabled — buggy, not ready.
  // // Block new windows and file-drop navigation at the main-process level.
  // // Without this, dropping a file when Electron has no bubble-phase handler
  // // causes webContents to navigate to file:///dropped/path, spawning a blank window.
  // mainWindow.webContents.on('will-navigate', (event) => {
  //   event.preventDefault();
  // });
  // mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.on("did-finish-load", () => {
    clampAppZoom();
  });
  const uiIndex = path.join(appDir, 'ui', 'dist', 'index.html');
  mainWindow.loadFile(uiIndex);

  // TODO: Drop-to-open workspace is disabled — buggy, not ready.
  // mainWindow.webContents.on('did-finish-load', () => {
  //   mainWindow.webContents.executeJavaScript(`
  //     document.addEventListener('dragover', e => e.preventDefault(), true);
  //     document.addEventListener('drop',     e => e.preventDefault(), true);
  //   `);
  // });
}

let tray = null;

app.whenReady().then(() => {
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
  const start = Math.max(0, index - 72);
  const end = Math.min(text.length, index + queryLength + 120);
  return text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim();
}

function handleSearchAcrossWorkspaces(msg) {
  const query = String(msg.query || "").trim().toLowerCase();
  const requestId = msg.requestId;
  const items = Array.isArray(msg.items) ? msg.items : [];
  if (!query || query.length < 2) {
    mainWindow.webContents.send("host-message", {
      command: "crossTabSearchResults",
      requestId,
      results: [],
    });
    return;
  }

  const results = [];
  for (const item of items) {
    if (!item.fsPath || !fs.existsSync(item.fsPath)) continue;
    const ext = path.extname(item.fsPath).toLowerCase();
    if (ext !== ".md" && ext !== ".mdx") continue;

    const titleScore = String(item.title || "").toLowerCase().includes(query) ? 4 : 0;
    const pathScore = String(item.relativePath || "").toLowerCase().includes(query) ? 2 : 0;
    let contentScore = 0;
    let excerpt = "";

    try {
      const raw = fs.readFileSync(item.fsPath, "utf8");
      const haystack = raw.toLowerCase();
      const index = haystack.indexOf(query);
      if (index !== -1) {
        contentScore = 3;
        excerpt = makeSearchExcerpt(raw, index, query.length);
      }
    } catch (err) {
      console.error("Failed to search file:", item.fsPath, err);
    }

    const score = titleScore + pathScore + contentScore;
    if (score > 0) {
      results.push({
        ...item,
        excerpt,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  mainWindow.webContents.send("host-message", {
    command: "crossTabSearchResults",
    requestId,
    results: results.slice(0, 80).map(({ score, ...result }) => result),
  });
}

async function handleConfirmOpenPath(filePath) {
  if (!fs.existsSync(filePath)) return;
  if (!activeWorkspace) {
    handleOpenPath(filePath);
    return;
  }
  const isFile = fs.statSync(filePath).isFile();
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

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Yes", "No"],
    title: "Switch Workspace/File",
    message: "Do you want to switch to this new path?",
    detail: filePath,
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

async function sendWorkspaceData() {
  if (!activeWorkspace) return;
  let tree = null;
  let flat = [];
  try {
    const isFile = fs.statSync(activeWorkspace).isFile();
    if (isFile) {
      const ext = path.extname(activeWorkspace).toLowerCase();
      if (ext === '.md' || ext === '.mdx') {
        const entry = DesktopScanner.buildFileEntry(activeWorkspace, path.dirname(activeWorkspace));
        flat = [entry];
        tree = DesktopScanner.buildTree(flat);
      }
    } else {
      const result = DesktopScanner.scan(activeWorkspace);
      tree = result.tree;
      flat = result.flat;
    }
  } catch (err) {
    console.error("Failed to scan workspace data:", err);
  }
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

  // Rewrite image paths to file:/// URIs
  const imgRegex = /<img\s+([^>]*?)src="([^"]+?)"/g;
  html = html.replace(imgRegex, (match, before, src) => {
    if (
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("data:") ||
      src.startsWith("file:")
    ) {
      return match;
    }
    try {
      const fileDir = path.dirname(currentFile);
      const absolutePath = path.resolve(fileDir, src);
      const fileUrl = "file:///" + absolutePath.replace(/\\/g, "/");
      return `<img ${before}src="${fileUrl}"`;
    } catch (err) {
      console.error("Failed to resolve relative image path:", src, err);
      return match;
    }
  });

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
