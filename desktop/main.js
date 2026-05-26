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

let mainWindow = null;
let activeWorkspace = null;
let currentFile = null;
let flatList = [];
let readyHandled = false;

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
      __dirname,
      "..",
      "vscode",
      "out",
      "markdown",
      "parser.js",
    );
    const rendererPath = path.join(
      __dirname,
      "..",
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
    icon: path.join(__dirname, "..", "ui", "assets", "logos", "logo-500.png"),
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

  const uiIndex = path.join(__dirname, '..', 'ui', 'dist', 'index.html');
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
      __dirname,
      "..",
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
        handleOpenFolder();
        break;
      case "openFile":
        handleOpenFile();
        break;
      case "openPath":
        handleOpenPath(msg.path);
        break;

      case "confirmOpenPath":
        handleConfirmOpenPath(msg.path);
        break;
      case "openRecentWorkspace":
        handleOpenRecent(msg.path);
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
      defaultExpanded: true,
      workspaceName: "",
      recentWorkspaces: recents,
    };
    mainWindow.webContents.send("host-message", ackMsg);
  } else {
    await sendWorkspaceData();
  }
}

function handleOpenFolder() {
  const folders = dialog.showOpenDialogSync(mainWindow, {
    properties: ["openDirectory"],
  });
  if (folders && folders.length > 0) {
    const selectedFolder = folders[0];
    saveRecentWorkspace(selectedFolder);
    activeWorkspace = selectedFolder;
    currentFile = null;
    sendWorkspaceData().then(() => sendWelcome());
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

function handleOpenPath(filePath) {
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
  sendWorkspaceData().then(() => isFile ? sendContent() : sendWelcome());
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

function handleOpenRecent(folderPath) {
  if (fs.existsSync(folderPath)) {
    saveRecentWorkspace(folderPath);
    activeWorkspace = folderPath;
    if (fs.statSync(folderPath).isFile()) {
      currentFile = folderPath;
      sendWorkspaceData().then(() => sendContent());
    } else {
      currentFile = null;
      sendWorkspaceData().then(() => sendWelcome());
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
  if (currentZoom < 5) {
    mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
  }
}

function handleZoomOut() {
  if (!mainWindow) return;
  const currentZoom = mainWindow.webContents.getZoomLevel();
  if (currentZoom > -3) {
    mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
  }
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
    defaultExpanded: true,
    workspaceName: workspaceName,
    recentWorkspaces: recents,
  };
  mainWindow.webContents.send("host-message", ackMsg);
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
