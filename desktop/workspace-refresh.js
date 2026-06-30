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
  if (!ext) return true;
  if (BASE_SUPPORTED_EXTENSIONS.has(ext)) return true;
  return documentConversionEnabled === true && EXTRA_DOCUMENT_EXTENSIONS.has(ext);
}

function isWatchChangeRelevant({ changedPath, documentConversionEnabled } = {}) {
  if (!changedPath) return true;
  return isSupportedWatchPath(changedPath, documentConversionEnabled);
}

function shouldNotifyCurrentFileChanged({
  currentFile,
  changedPath,
  currentFileStillAvailable = true,
} = {}) {
  if (!currentFile) return false;
  if (currentFileStillAvailable === false) return true;
  if (!changedPath) return false;
  return normalizePathKey(currentFile) === normalizePathKey(changedPath);
}

module.exports = {
  isWatchChangeRelevant,
  shouldNotifyCurrentFileChanged,
};
