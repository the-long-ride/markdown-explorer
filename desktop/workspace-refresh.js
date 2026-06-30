const path = require("path");

const BASE_SUPPORTED_EXTENSIONS = new Set([".md", ".mdx", ".markdown", ".txt"]);
const EXTRA_DOCUMENT_EXTENSIONS = new Set([
  ".doc",
  ".docx",
  ".pdf",
  ".html",
  ".xls",
  ".xlsx",
  ".xlm",
  ".pptx",
  ".odt",
  ".odp",
  ".ods",
  ".rtf",
]);

function normalizePathKey(filePath) {
  return String(filePath || "").replace(/\\/g, "/").toLowerCase();
}

function isSupportedWatchPath(filePath, documentConversionEnabled) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  return !ext ? true
    : BASE_SUPPORTED_EXTENSIONS.has(ext) ? true
    : documentConversionEnabled === true && EXTRA_DOCUMENT_EXTENSIONS.has(ext);
}

function isWatchChangeRelevant({ changedPath, documentConversionEnabled } = {}) {
  return !changedPath ? true : isSupportedWatchPath(changedPath, documentConversionEnabled);
}

function shouldNotifyCurrentFileChanged({
  currentFile,
  changedPath,
  currentFileStillAvailable = true,
} = {}) {
  return !currentFile ? false
    : currentFileStillAvailable === false ? true
    : !changedPath ? false
    : normalizePathKey(currentFile) === normalizePathKey(changedPath);
}

module.exports = {
  isSupportedWatchPath,
  isWatchChangeRelevant,
  shouldNotifyCurrentFileChanged,
};
