const { parentPort } = require("worker_threads");
const { createSearchIndex } = require("./search-index");

const searchIndex = createSearchIndex();
let items = [];
let activeRequestId = "";

parentPort.on("message", (message) => {
  if (message?.type === "set-items") {
    activeRequestId = "";
    items = Array.isArray(message.items) ? message.items : [];
    searchIndex.prime(items);
    return;
  }

  if (message?.type !== "search") return;

  const requestId = String(message.requestId || "");
  const query = String(message.query || "");
  activeRequestId = requestId;

  void searchIndex.searchIncremental(query, items, {
    batchSize: message.batchSize,
    maxResults: message.maxResults,
    maxMatchesPerFile: message.maxMatchesPerFile,
    yieldEvery: message.yieldEvery,
    shouldCancel: () => activeRequestId !== requestId,
    onBatch(results) {
      if (activeRequestId !== requestId) return;
      parentPort.postMessage({ type: "batch", requestId, results });
    },
  }).then((result) => {
    parentPort.postMessage({ type: "done", requestId, ...result });
  }).catch((error) => {
    parentPort.postMessage({
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  });
});