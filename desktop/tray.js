const fs = require("fs");
const path = require("path");
const { Menu: ElectronMenu, Tray } = require("electron");

function createAppTray(appDir, getMainWindow) {
  try {
    const iconPath = path.join(appDir, "ui", "assets", "logos", "logo-128.png");
    if (!fs.existsSync(iconPath)) return null;

    const tray = new Tray(iconPath);
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
          require("electron").app.quit();
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
