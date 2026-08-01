function createRuntimeCommandSearchHandlers({
  state,
  fs,
  ensureHeavyModules,
  ensureSearchIndex,
  ensureCrossTabSearchWorker,
  scanWorkspaceData,
  sendHostMessage,
}) {
  function handleSearchAcrossWorkspaces(msg) {
    ensureHeavyModules();
    ensureCrossTabSearchWorker().search({
      requestId: msg.requestId,
      query: String(msg.query || "").trim().toLowerCase(),
    });
  }

  function handleSearchWorkspace(msg) {
    ensureHeavyModules();
    const idx = ensureSearchIndex();
    const query = String(msg.query || "").trim().toLowerCase();
    const items = Array.isArray(msg.items) && msg.items.length > 0 ? msg.items : state.flatList;
    sendHostMessage({ command: "workspaceSearchResults", requestId: msg.requestId, results: idx.search(query, items, 10000) });
  }

  function handleIndexWorkspaceSearchItems(msg) {
    ensureHeavyModules();
    ensureCrossTabSearchWorker().setItems(Array.isArray(msg.items) ? msg.items : []);
  }

  function handleLoadWorkspaceSearchIndexes(msg) {
    ensureHeavyModules();
    const tabRequests = Array.isArray(msg.tabs) ? msg.tabs : [];
    if (tabRequests.length === 0) return;
    let index = 0;
    async function processNext() {
      if (index >= tabRequests.length) return;
      const tab = tabRequests[index];
      const tabId = String(tab?.tabId || "");
      const workspacePath = String(tab?.workspacePath || "");
      if (tabId && workspacePath) {
        let payload = { tabId, workspacePath, fileList: [], tree: null };
        if (fs.existsSync(workspacePath)) {
          try {
            const { tree, flat } = await scanWorkspaceData(workspacePath);
            ensureSearchIndex().prime(flat);
            payload = { tabId, workspacePath, fileList: flat, tree };
          } catch {
            // Keep empty payload for unavailable workspaces.
          }
        }
        sendHostMessage({ command: "workspaceSearchIndexLoaded", tabs: [payload] });
      }
      index += 1;
      setTimeout(processNext, 150);
    }
    setTimeout(processNext, 50);
  }

  return { handleSearchAcrossWorkspaces, handleSearchWorkspace,
    handleIndexWorkspaceSearchItems, handleLoadWorkspaceSearchIndexes };
}

module.exports = { createRuntimeCommandSearchHandlers };
