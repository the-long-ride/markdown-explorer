const MAC_TRAY_ICON = "markdown-explorerTemplate.png";
const DEFAULT_TRAY_ICON = "logo-128.png";

function createTrayIcon({ iconPath, platform = process.platform, nativeImageImpl } = {}) {
  if (platform !== "darwin") return iconPath;

  let imageApi = nativeImageImpl;
  if (!imageApi) {
    try {
      imageApi = require("electron").nativeImage;
    } catch {
      imageApi = null;
    }
  }
  if (!imageApi?.createFromPath) return null;

  const source = imageApi.createFromPath(iconPath);
  if (!source || source.isEmpty?.()) return null;

  source.setTemplateImage?.(true);
  return source;
}

function createAppTray({
  appDir,
  getMainWindow,
  fs,
  pathImpl,
  TrayConstructor,
  ElectronMenu,
  appQuit,
  platform = process.platform,
  nativeImageImpl,
} = {}) {
  try {
    const iconName = platform === "darwin" ? MAC_TRAY_ICON : DEFAULT_TRAY_ICON;
    const iconPath = pathImpl.join(appDir, "ui", "assets", "logos", iconName);
    if (!fs.existsSync(iconPath)) return null;

    const trayIcon = createTrayIcon({ iconPath, platform, nativeImageImpl });
    if (!trayIcon) return null;

    const tray = new TrayConstructor(trayIcon);
    const contextMenu = ElectronMenu.buildFromTemplate([
      {
        label: "Open Markdown Explorer",
        click: () => {
          const mainWindow = getMainWindow();
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
          appQuit();
        },
      },
    ]);

    tray.setToolTip("Markdown Explorer");
    tray.setContextMenu(contextMenu);
    tray.on("click", () => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return;
      if (mainWindow.isVisible()) mainWindow.focus();
      else mainWindow.show();
    });
    return tray;
  } catch (err) {
    console.error("Failed to create tray icon:", err);
    return null;
  }
}

module.exports = { createAppTray, createTrayIcon };
