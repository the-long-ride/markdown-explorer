function createRuntimeCommandSearchHandlers({
  state,
  fs,
  ensureHeavyModules,
  ensureSearchIndex,
  ensureCrossTabSearchWorker,
  scanWorkspaceData,
  sendHostMessage,
}) {
  const indexedSearchPaths = new Set();
  let workspaceSearchGeneration = 0;

  function handleSearchAcrossWorkspaces(msg) {
    ensureHeavyModules();
    const request = {
      requestId: msg.requestId,
      query: String(msg.query || "").trim(),
      matchCase: Boolean(msg.matchCase),
    };
    if (Array.isArray(msg.tabIds)) request.tabIds = msg.tabIds.map(String);
    ensureCrossTabSearchWorker().search(request);
  }

  function handleSearchWorkspace(msg) {
    ensureHeavyModules();
    const idx = ensureSearchIndex();
    const query = String(msg.query || "").trim();
    const items = Array.isArray(msg.items) ? msg.items : state.flatList;
    const generation = ++workspaceSearchGeneration;
    const requestId = msg.requestId;
    if (typeof idx.searchIncremental !== "function") {
      let results = [];
      try {
        results = idx.search(query, items, 10000, { matchCase: Boolean(msg.matchCase) });
      } catch {
        // Always answer so the UI clears its loading state.
      }
      sendHostMessage({ command: "workspaceSearchResults", requestId, results, done: true, total: results.length, truncated: false, cancelled: false });
      return;
    }

    void idx.searchIncremental(query, items, {
      matchCase: Boolean(msg.matchCase),
      batchSize: 100,
      maxResults: 10000,
      maxMatchesPerFile: 200,
      yieldEvery: 25,
      shouldCancel: () => generation !== workspaceSearchGeneration,
      onBatch(results) {
        if (generation === workspaceSearchGeneration) {
          sendHostMessage({ command: "workspaceSearchResults", requestId, results, done: false });
        }
      },
    }).then((summary) => {
      if (generation === workspaceSearchGeneration) {
        sendHostMessage({ command: "workspaceSearchResults", requestId, results: [], done: true, ...summary });
      }
    }).catch((error) => {
      if (generation === workspaceSearchGeneration) {
        sendHostMessage({
          command: "workspaceSearchResults",
          requestId,
          results: [],
          done: true,
          total: 0,
          truncated: false,
          cancelled: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  function handleIndexWorkspaceSearchItems(msg) {
    ensureHeavyModules();
    const items = Array.isArray(msg.items) ? msg.items : [];
    indexedSearchPaths.clear();
    for (const item of items) {
      if (item?.fsPath) indexedSearchPaths.add(String(item.fsPath));
    }
    ensureSearchIndex().prime(items);
    ensureCrossTabSearchWorker().setItems(items);
  }

  function handleLoadSearchPreview(msg) {
    ensureHeavyModules();
    const requestId = String(msg.requestId || '');
    const filePath = String(msg.filePath || '');
    const respond = (payload) => sendHostMessage({
      command: 'searchPreviewResult',
      requestId,
      filePath,
      ...payload,
    });
    const isCurrentWorkspaceFile = state.flatList.some((item) => String(item?.fsPath || '') === filePath);
    if (!requestId || !filePath || (!isCurrentWorkspaceFile && !indexedSearchPaths.has(filePath))) {
      respond({ ok: false, reason: 'outside-workspace' });
      return;
    }
    try {
      const markdownSource = ensureSearchIndex().read(filePath);
      if (markdownSource === null) {
        respond({ ok: false, reason: fs.existsSync(filePath) ? 'unsupported' : 'missing' });
        return;
      }
      respond({ ok: true, markdownSource });
    } catch {
      respond({ ok: false, reason: 'unreadable' });
    }
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

  return { handleSearchAcrossWorkspaces, handleSearchWorkspace, handleLoadSearchPreview,
    handleIndexWorkspaceSearchItems, handleLoadWorkspaceSearchIndexes };
}

module.exports = { createRuntimeCommandSearchHandlers };
