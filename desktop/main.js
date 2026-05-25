const { app, BrowserWindow, dialog, ipcMain, clipboard, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const DesktopScanner = require('./scanner');

let mainWindow = null;
let activeWorkspace = null;
let currentFile = null;
let flatList = [];

// Remove default window menu bar
Menu.setApplicationMenu(null);

const recentsFile = path.join(app.getPath('userData'), 'recent-workspaces.json');

function loadRecentWorkspaces() {
  try {
    if (fs.existsSync(recentsFile)) {
      const data = fs.readFileSync(recentsFile, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error('Failed to load recent workspaces:', err);
  }
  return [];
}

function saveRecentWorkspace(folderPath) {
  let list = loadRecentWorkspaces();
  // Normalize and filter out duplicates
  const normPath = path.normalize(folderPath);
  list = list.filter(w => path.normalize(w.path) !== normPath);
  // Add to top
  list.unshift({
    name: path.basename(folderPath) || folderPath,
    path: folderPath,
    lastOpened: Date.now()
  });
  // Limit to 100 recents
  list = list.slice(0, 100);
  try {
    fs.writeFileSync(recentsFile, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save recent workspaces:', err);
  }
}

// Dynamic import of markdown parser compiled by VS Code build
let parse = null;
let HtmlRenderer = null;

function loadMarkdownParser() {
  if (parse && HtmlRenderer) return true;
  try {
    const parserPath = path.join(__dirname, '..', 'vscode', 'out', 'markdown', 'parser.js');
    const rendererPath = path.join(__dirname, '..', 'vscode', 'out', 'markdown', 'renderer.js');
    if (fs.existsSync(parserPath) && fs.existsSync(rendererPath)) {
      parse = require(parserPath).parse;
      HtmlRenderer = require(rendererPath).HtmlRenderer;
      return true;
    }
  } catch (err) {
    console.warn('VS Code compiled markdown parser not found yet. Fallback is enabled.', err);
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1250,
    height: 850,
    frame: false, // frameless window
    icon: path.join(__dirname, '..', 'ui', 'assets', 'logos', 'logo-500.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Block Developer Tools shortcut in production release build
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (app.isPackaged) {
      const isDevToolsKey = (input.control && input.shift && input.key.toLowerCase() === 'i') || 
                            (input.meta && input.alt && input.key.toLowerCase() === 'i') || 
                            input.key === 'F12';
      if (isDevToolsKey) {
        event.preventDefault();
      }
    }
  });

  // Listen to window state changes to notify renderer
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('host-message', { command: 'window-state-changed', isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('host-message', { command: 'window-state-changed', isMaximized: false });
  });

  const uiIndex = path.join(__dirname, '..', 'ui', 'dist', 'index.html');
  mainWindow.loadFile(uiIndex);
}

let tray = null;

app.whenReady().then(() => {
  createWindow();

  // Create System Tray Icon
  try {
    const iconPath = path.join(__dirname, '..', 'ui', 'assets', 'logos', 'logo-128.png');
    if (fs.existsSync(iconPath)) {
      const { Tray, Menu: ElectronMenu } = require('electron');
      tray = new Tray(iconPath);
      const contextMenu = ElectronMenu.buildFromTemplate([
        { label: 'Open Markdown Explorer', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
        { type: 'separator' },
        { label: 'Quit', click: () => { app.quit(); } }
      ]);
      tray.setToolTip('Markdown Explorer');
      tray.setContextMenu(contextMenu);
      tray.on('click', () => {
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
    console.error('Failed to create tray icon:', err);
  }

  // Register IPC message handlers
  ipcMain.on('webview-message', async (event, msg) => {
    switch (msg.command) {
      case 'ready':
        await handleReady();
        break;
      case 'openFolder':
        handleOpenFolder();
        break;
      case 'openRecentWorkspace':
        handleOpenRecent(msg.path);
        break;
      case 'deleteRecentWorkspace':
        handleDeleteRecentWorkspace(msg.path);
        break;
      case 'closeWorkspace':
        handleCloseWorkspace();
        break;
      case 'zoom-in':
        handleZoomIn();
        break;
      case 'zoom-out':
        handleZoomOut();
        break;
      case 'navigate':
        await handleNavigate(msg.path);
        break;
      case 'openInEditor':
        if (msg.path && fs.existsSync(msg.path)) {
          const { shell } = require('electron');
          shell.openPath(msg.path);
        }
        break;
      case 'copyCode':
        clipboard.writeText(msg.text);
        break;
      case 'refresh':
        await handleRefresh();
        break;
      // Window control handlers
      case 'window-minimize':
        if (mainWindow) mainWindow.minimize();
        break;
      case 'window-maximize':
        if (mainWindow) {
          if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
          } else {
            mainWindow.maximize();
          }
        }
        break;
      case 'window-close':
        if (mainWindow) mainWindow.close();
        break;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleReady() {
  const recents = loadRecentWorkspaces();
  if (!activeWorkspace) {
    const ackMsg = {
      command: 'readyAck',
      fileList: [],
      tree: null,
      theme: 'dark',
      defaultExpanded: true,
      workspaceName: '',
      recentWorkspaces: recents
    };
    mainWindow.webContents.send('host-message', ackMsg);
  } else {
    await sendWorkspaceData();
  }
}

function handleOpenFolder() {
  const folders = dialog.showOpenDialogSync(mainWindow, {
    properties: ['openDirectory']
  });
  if (folders && folders.length > 0) {
    const selectedFolder = folders[0];
    saveRecentWorkspace(selectedFolder);
    activeWorkspace = selectedFolder;
    currentFile = null;
    sendWorkspaceData().then(() => sendWelcome());
  }
}

function handleOpenRecent(folderPath) {
  if (fs.existsSync(folderPath)) {
    saveRecentWorkspace(folderPath);
    activeWorkspace = folderPath;
    currentFile = null;
    sendWorkspaceData().then(() => sendWelcome());
  } else {
    // Remove invalid path
    let list = loadRecentWorkspaces();
    list = list.filter(w => path.normalize(w.path) !== path.normalize(folderPath));
    fs.writeFileSync(recentsFile, JSON.stringify(list, null, 2), 'utf8');
  }
}

function handleDeleteRecentWorkspace(folderPath) {
  try {
    let list = loadRecentWorkspaces();
    const normPath = path.normalize(folderPath);
    list = list.filter(w => path.normalize(w.path) !== normPath);
    fs.writeFileSync(recentsFile, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to delete recent workspace:', err);
  }
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
    filePath = path.resolve(activeWorkspace, filePath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    currentFile = filePath;
    await sendContent();
  } else {
    mainWindow.webContents.send('host-message', {
      command: 'navNotFound',
      href: filePath
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
  const { tree, flat } = DesktopScanner.scan(activeWorkspace);
  flatList = flat;

  const workspaceName = path.basename(activeWorkspace);
  const recents = loadRecentWorkspaces();

  const ackMsg = {
    command: 'readyAck',
    fileList: flat,
    tree: tree,
    theme: 'dark',
    defaultExpanded: true,
    workspaceName: workspaceName,
    recentWorkspaces: recents
  };
  mainWindow.webContents.send('host-message', ackMsg);
}

async function sendContent() {
  if (!currentFile || !activeWorkspace) return;
  loadMarkdownParser();

  let raw = '';
  try {
    raw = fs.readFileSync(currentFile, 'utf8');
  } catch (err) {
    console.error('Failed to read file:', currentFile, err);
  }

  let html = '';
  let frontmatter = {};
  let toc = [];

  if (parse && HtmlRenderer) {
    const isMdx = currentFile.endsWith('.mdx');
    const parsed = parse(raw, isMdx);
    const renderer = new HtmlRenderer({ theme: 'dark', isMdx });
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
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('file:')) {
      return match;
    }
    try {
      const fileDir = path.dirname(currentFile);
      const absolutePath = path.resolve(fileDir, src);
      const fileUrl = 'file:///' + absolutePath.replace(/\\/g, '/');
      return `<img ${before}src="${fileUrl}"`;
    } catch (err) {
      console.error('Failed to resolve relative image path:', src, err);
      return match;
    }
  });

  const fileInfo = flatList.find(f => f.fsPath === currentFile) || {
    relativePath: path.relative(activeWorkspace, currentFile),
    title: path.basename(currentFile).replace(/\.(md|mdx)$/i, '')
  };

  const msg = {
    command: 'renderContent',
    html: html,
    frontmatter: frontmatter,
    toc: toc,
    filePath: currentFile,
    relativePath: fileInfo.relativePath,
    title: fileInfo.title,
    fileList: flatList
  };
  mainWindow.webContents.send('host-message', msg);
}

async function sendWelcome() {
  const welcomeHtml = `
<div class="welcome-container" style="max-width: 800px; margin: 0 auto; padding: 20px 10px; font-family: var(--font-ui);">
  <!-- Hero Section -->
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 2.2em; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 8px; color: var(--tx);">Welcome to Markdown Explorer</h1>
    <p style="font-size: 1.15em; color: var(--tx2); margin-bottom: 12px; line-height: 1.5;">A premium, local-first documentation viewer and navigator for Desktop.</p>
    <div style="font-size: 0.95em; color: var(--tx2);">
      Created by <a href="https://github.com/the-long-ride" target="_blank" rel="noopener noreferrer" style="color: var(--accent-text); text-decoration: none; font-weight: 600;">the-long-ride</a> · 
      Repository: <a href="https://github.com/the-long-ride/vscode-extension-markdown-explorer" target="_blank" rel="noopener noreferrer" style="color: var(--accent-text); text-decoration: none; font-weight: 600;">vscode-extension-markdown-explorer</a> · 
      License: <a href="https://github.com/the-long-ride/vscode-extension-markdown-explorer/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" style="color: var(--accent-text); text-decoration: none; font-weight: 600;">MIT</a>
    </div>
  </div>

  <!-- Privacy Pledge -->
  <div style="background: rgba(52, 211, 153, 0.07); border: 1px solid rgba(52, 211, 153, 0.35); border-radius: var(--r-lg); padding: 16px 20px; margin-bottom: 32px;">
    <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--success); margin-bottom: 8px;">
      <span>🔒 100% Private, Offline-First & Independent</span>
    </div>
    <div style="font-size: 12.5px; line-height: 1.6; color: var(--tx2);">
      We believe your documentation should be kept completely private. 
      <strong>Markdown Explorer</strong> operates entirely on your local machine:
      <ul style="margin: 8px 0 0 20px; padding: 0; list-style-type: disc;">
        <li style="margin-bottom: 4px;"><strong>No Tracking & No Telemetry</strong>: We do not collect or send any usage data, analytics, or keystrokes.</li>
        <li style="margin-bottom: 4px;"><strong>No External Libraries</strong>: This app does not package or load any third-party external trackers, analytic scripts, or telemetry libraries.</li>
        <li style="margin-bottom: 0;"><strong>100% Offline Support</strong>: All markdown parsing, scanning, rendering, and quick search indexing are executed locally with zero remote dependencies.</li>
      </ul>
    </div>
  </div>

  <!-- Feature Guidelines -->
  <div style="margin-bottom: 32px;">
    <h2 style="font-size: 1.4em; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid var(--bd-s); padding-bottom: 6px; color: var(--tx);">How to Use All Features</h2>
    
    <div style="display: grid; grid-template-columns: 1fr; gap: 16px;">
      
      <!-- Feature 1 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">📁 Workspace Navigation Tree</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          The left sidebar displays an interactive folder structure scanning all markdown files in your workspace. Simply click any file to open it in preview mode. You can filter files by name using the search bar at the top of the sidebar.
        </div>
      </div>

      <!-- Feature 2 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">🔍 Instant Quick Search (<kbd>Ctrl+K</kbd>)</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          Press <kbd>Ctrl+K</kbd> from anywhere in the preview window to open the quick search overlay. Type a query to search across all markdown file names instantly. Use the mouse or keyboard to select and open a file.
        </div>
      </div>

      <!-- Feature 3 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">📋 Excel-Style Interactive Data Tables</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          Standard markdown tables are automatically converted to interactive tables. You can sort columns by clicking their headers, use the funnel icon on headers to filter rows by values, and type inside the search bar above the table to search row contents.
        </div>
      </div>

      <!-- Feature 4 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">📊 One-Click Table-to-Chart Switcher</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          For tables containing numeric columns, a view switcher will appear. Click the <strong>Bar</strong>, <strong>Line</strong>, or <strong>Pie</strong> buttons to instantly visualize the table data as an interactive Chart.js chart.
        </div>
      </div>

      <!-- Feature 5 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">🎨 Syntax Highlighting & Mermaid Diagrams</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          Enjoy high-contrast, premium syntax highlighting for code blocks (TypeScript, JavaScript, etc.) with custom overrides for comments and optional properties. Mermaid sequence, flowchart, and class diagrams render natively on the client with 100% strict offline containment.
        </div>
      </div>

      <!-- Feature 6 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">🖼️ Zoomable Backdrop Media Modal</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          Click any image or diagram within your documents to launch a premium backdrop-blur modal. You can scroll to zoom in/out, click and drag to pan across high-res graphics, or use the arrow keys to cycle through all images in the document.
        </div>
      </div>

      <!-- Feature 7 -->
      <div style="background: var(--bg-s); border: 1px solid var(--bd-s); border-radius: var(--r-lg); padding: 14px 16px;">
        <div style="font-weight: 700; font-size: 13px; color: var(--accent-text); margin-bottom: 6px;">⌨️ Keyboard Shortcuts & Navigation</div>
        <div style="font-size: 12px; line-height: 1.5; color: var(--tx2);">
          Control and navigate your documentation easily using standard and customizable keyboard shortcuts:
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11.5px; color: var(--tx2);">
            <thead>
              <tr style="border-bottom: 1px solid var(--bd-s); text-align: left;">
                <th style="padding: 6px 8px 6px 0; font-weight: 600;">Action</th>
                <th style="padding: 6px 8px; font-weight: 600;">Default Shortcut</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Back to previous file</td><td style="padding: 4px 8px;"><kbd>Ctrl+←</kbd> or Mouse Back button</td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Go to next file</td><td style="padding: 4px 8px;"><kbd>Ctrl+→</kbd> or Mouse Forward button</td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Go to welcome page</td><td style="padding: 4px 8px;"><kbd>Ctrl+H</kbd></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Open settings modal</td><td style="padding: 4px 8px;"><kbd>Ctrl+I</kbd></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Toggle light/dark mode</td><td style="padding: 4px 8px;"><kbd>Ctrl+Shift+L</kbd></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Refresh current file</td><td style="padding: 4px 8px;"><kbd>F5</kbd></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Collapse all heading groups</td><td style="padding: 4px 8px;"><kbd>Ctrl+Shift+X</kbd></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Expand all heading groups</td><td style="padding: 4px 8px;"><kbd>Ctrl+Shift+E</kbd></td></tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);"><td style="padding: 4px 8px 4px 0;">Go to workspace selection page</td><td style="padding: 4px 8px;"><kbd>Ctrl+Shift+H</kbd></td></tr>
              <tr><td style="padding: 4px 8px 4px 0;">Toggle sidebar</td><td style="padding: 4px 8px;"><kbd>Ctrl+Shift+P</kbd></td></tr>
            </tbody>
          </table>
          <div style="margin-top: 10px; font-style: italic; font-size: 11px;">Note: You can change all keyboard shortcuts from the **Settings Modal** (click settings button or press <kbd>Ctrl+I</kbd>).</div>
        </div>
      </div>

    </div>
  </div>
</div>
  `;

  const msg = {
    command: 'renderContent',
    html: welcomeHtml,
    frontmatter: {},
    toc: [],
    filePath: '',
    relativePath: 'Welcome Page',
    title: 'Welcome',
    fileList: flatList
  };
  mainWindow.webContents.send('host-message', msg);
}
