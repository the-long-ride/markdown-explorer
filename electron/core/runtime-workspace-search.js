function createRuntimeWorkspaceSearchHelpers({
  state,
  createSearchIndex,
  createSearchWorkerController,
  getMainWindow,
  sendHostMessage,
}) {
  function ensureSearchIndex() {
    if (!state.searchIndex) state.searchIndex = createSearchIndex();
    return state.searchIndex;
  }

  function buildWorkspaceTree(flat) {
    const root = { name: "root", path: "", children: [], files: [] };
    for (const file of flat) {
      let node = root;
      const dirs = file.parts.slice(0, -1);
      for (let index = 0; index < dirs.length; index += 1) {
        const name = dirs[index];
        let child = node.children.find((item) => item.name === name);
        if (!child) {
          child = { name, path: dirs.slice(0, index + 1).join("/"), children: [], files: [] };
          node.children.push(child);
        }
        node = child;
      }
      node.files.push(file);
    }
    return root;
  }

  function ensureCrossTabSearchWorker() {
    if (state.crossTabSearchWorker) return state.crossTabSearchWorker;
    state.crossTabSearchWorker = createSearchWorkerController({
      onMessage(message) {
        const win = getMainWindow();
        if (!win || win.isDestroyed()) return;
        if (message.type === "batch") {
          sendHostMessage({ command: "crossTabSearchResults", requestId: message.requestId,
            results: message.results, done: false });
          return;
        }
        if (message.type === "done" || message.type === "error") {
          sendHostMessage({ command: "crossTabSearchResults", requestId: message.requestId,
            results: [], done: true, total: message.total || 0,
            truncated: Boolean(message.truncated), cancelled: Boolean(message.cancelled),
            error: message.type === "error" ? message.message : undefined });
        }
      },
    });
    return state.crossTabSearchWorker;
  }

  return { ensureSearchIndex, buildWorkspaceTree, ensureCrossTabSearchWorker };
}

module.exports = { createRuntimeWorkspaceSearchHelpers };
