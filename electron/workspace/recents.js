const fs = require("fs");
const path = require("path");

function createRecentWorkspacesStore(app) {
  const recentsFile = path.join(app.getPath("userData"), "recent-workspaces.json");

  function load() {
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

  function save(folderPath) {
    let list = load();
    const normPath = path.normalize(folderPath);
    list = list.filter((w) => path.normalize(w.path) !== normPath);
    list.unshift({
      name: path.basename(folderPath) || folderPath,
      path: folderPath,
      lastOpened: Date.now(),
    });
    list = list.slice(0, 100);
    try {
      fs.writeFileSync(recentsFile, JSON.stringify(list, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save recent workspaces:", err);
    }
  }

  function remove(folderPath) {
    let list = load();
    const normPath = path.normalize(folderPath);
    list = list.filter((w) => path.normalize(w.path) !== normPath);
    fs.writeFileSync(recentsFile, JSON.stringify(list, null, 2), "utf8");
  }

  function replace(workspaces) {
    const seen = new Set();
    const list = Array.isArray(workspaces)
      ? workspaces.flatMap((workspace) => {
          const workspacePath = typeof workspace?.path === "string" ? workspace.path.trim() : "";
          if (!workspacePath) return [];
          const normPath = path.normalize(workspacePath);
          if (seen.has(normPath)) return [];
          seen.add(normPath);
          return [{
            name: typeof workspace?.name === "string" && workspace.name.trim()
              ? workspace.name.trim()
              : path.basename(workspacePath) || workspacePath,
            path: workspacePath,
            lastOpened: Number.isFinite(Number(workspace?.lastOpened))
              ? Number(workspace.lastOpened)
              : Date.now(),
          }];
        }).slice(0, 100)
      : [];
    fs.writeFileSync(recentsFile, JSON.stringify(list, null, 2), "utf8");
  }

  return { load, save, remove, replace };
}

module.exports = { createRecentWorkspacesStore };
