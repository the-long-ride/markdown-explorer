function createAppTray({
  appDir,
  getMainWindow,
  fs,
  pathImpl,
  TrayConstructor,
  ElectronMenu,
  appQuit,
} = {}) {
  try {
    const iconPath = pathImpl.join(appDir, "ui", "assets", "logos", "logo-128.png");
    if (!fs.existsSync(iconPath)) return null;

    const tray = new TrayConstructor(iconPath);
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

module.exports = { createAppTray };
