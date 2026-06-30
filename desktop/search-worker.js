const { createSearchIndex } = require("./search-index");

function resolveMessageItems(message) {
  return Array.isArray(message?.items) ? message.items : [];
}

function resolveRequestId(message) {
  return String(message?.requestId || "");
}

function resolveQuery(message) {
  return String(message?.query || "");
}

function handleWorkerMessage(message, { searchIndex, items, activeRequestId, postMessage }) {
  const resolvedItems = resolveMessageItems(message);
  /* v8 ignore next - optional chaining else path: V8 creates extra branch for message=null/undefined */
  if (message?.type === "set-items") {
    activeRequestId.value = "";
    items.value = resolvedItems;
    searchIndex.prime(resolvedItems);
    return { activeRequestId: activeRequestId.value, items: resolvedItems };
  }

  if (message?.type !== "search") return null;

  const requestId = resolveRequestId(message);
  const query = resolveQuery(message);
  activeRequestId.value = requestId;

  void searchIndex.searchIncremental(query, items.value, {
    batchSize: message.batchSize,
    maxResults: message.maxResults,
    maxMatchesPerFile: message.maxMatchesPerFile,
    yieldEvery: message.yieldEvery,
    shouldCancel: () => activeRequestId.value !== requestId,
    onBatch(results) {
      if (activeRequestId.value !== requestId) return;
      postMessage({ type: "batch", requestId, results });
    },
  }).then((result) => {
    postMessage({ type: "done", requestId, ...result });
  }).catch((error) => {
    postMessage({
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  return { activeRequestId: requestId };
}

function createSearchWorkerHandler(postMessage) {
  const searchIndex = createSearchIndex();
  const items = { value: [] };
  const activeRequestId = { value: "" };

  function handleMessage(message) {
    return handleWorkerMessage(message, {
      searchIndex,
      items,
      activeRequestId,
      postMessage,
    });
  }

  return { handleMessage, searchIndex };
}

module.exports = { createSearchWorkerHandler, handleWorkerMessage, resolveMessageItems, resolveRequestId, resolveQuery };

/* v8 ignore next 6 - worker_threads entry point, untestable in unit test enviroment */
const { parentPort } = require("worker_threads");
if (parentPort) {
  const handler = createSearchWorkerHandler((msg) => parentPort.postMessage(msg));
  parentPort.on("message", handler.handleMessage);
}
