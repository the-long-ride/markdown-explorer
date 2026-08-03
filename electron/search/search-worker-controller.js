const path = require("path");
const { Worker } = require("worker_threads");

function createSearchWorkerController({
  onMessage,
  onError = (error) => console.error("Cross-tab search worker failed:", error),
  workerPath = path.join(__dirname, "search-worker.js"),
} = {}) {
  const worker = new Worker(workerPath);
  let disposed = false;

  worker.on("message", (message) => {
    if (!disposed) onMessage?.(message);
  });
  worker.on("error", (error) => {
    if (!disposed) onError(error);
  });

  return {
    setItems(items) {
      if (disposed) return;
      worker.postMessage({
        type: "set-items",
        items: Array.isArray(items) ? items : [],
      });
    },

    search({
      requestId,
      query,
      matchCase = false,
      tabIds,
      batchSize = 100,
      maxResults = 2000,
      maxMatchesPerFile = 200,
      yieldEvery = 25,
    }) {
      if (disposed) return;
      worker.postMessage({
        type: "search",
        requestId,
        query,
        matchCase,
        tabIds: Array.isArray(tabIds) ? tabIds : undefined,
        batchSize,
        maxResults,
        maxMatchesPerFile,
        yieldEvery,
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      void worker.terminate();
    },
  };
}

module.exports = { createSearchWorkerController };