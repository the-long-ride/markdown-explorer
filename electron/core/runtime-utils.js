function isSupportedFilePathLite(filePath, docConvEnabled) {
  if (!filePath) return false;
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = filePath.slice(dotIndex).toLowerCase();
  if ([".md", ".mdx", ".markdown", ".txt"].includes(ext)) return true;
  if (docConvEnabled && [".doc", ".docx", ".pdf", ".html", ".xls", ".xlsx", ".xlm", ".pptx", ".odt", ".odp", ".ods", ".rtf"].includes(ext)) return true;
  return false;
}

function isExtraDocumentFilePathLite(filePath) {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = filePath.slice(dotIndex).toLowerCase();
  return [".doc", ".docx", ".pdf", ".html", ".xls", ".xlsx", ".xlm", ".pptx", ".odt", ".odp", ".ods", ".rtf"].includes(ext);
}

function getFileTypeLabelLite(filePath) {
  const dotIndex = filePath.lastIndexOf(".");
  const ext = dotIndex === -1 ? filePath.toLowerCase() : filePath.slice(dotIndex + 1).toLowerCase();
  const labels = { doc: "Word", docx: "Word", pdf: "PDF", html: "HTML", xls: "Excel", xlsx: "Excel", xlm: "Excel", pptx: "PowerPoint", odt: "OpenDocument Text", odp: "OpenDocument Presentation", ods: "OpenDocument Spreadsheet", rtf: "Rich Text" };
  return labels[ext] || ext.toUpperCase();
}

function getOpenDialogFiltersLite(docConvEnabled) {
  const filters = [{ name: "Markdown", extensions: ["md", "mdx", "markdown"] }];
  if (docConvEnabled) filters.push(
    { name: "Documents", extensions: ["doc", "docx", "pdf", "html", "xls", "xlsx", "xlm", "pptx", "odt", "odp", "ods", "rtf"] },
    { name: "All Files", extensions: ["*"] },
  );
  return filters;
}

function stripKnownExtensionLite(filename) {
  return filename.replace(/\.(md|mdx|markdown|txt|doc|docx|pdf|html|xls|xlsx|xlm|pptx|odt|odp|ods|rtf)$/i, "");
}

function isAccessDeniedError(err) {
  return err && (err.code === "EACCES" || err.code === "EPERM");
}

function clampZoomLevel(zoomLevel, min, max) {
  return Math.min(max, Math.max(min, zoomLevel));
}

function normalizeZoomStep(zoomLevel, step) {
  return Math.round(zoomLevel / step) * step;
}

function stripNavigationFragment(filePath) {
  const hashIndex = filePath.indexOf("#");
  return hashIndex === -1 ? filePath : filePath.slice(0, hashIndex);
}

function decodeNavigationPath(filePath) {
  try {
    return decodeURIComponent(filePath);
  } catch {
    return filePath;
  }
}

function isRootRelativeWorkspaceHref(filePath) {
  return (
    filePath.startsWith("/") &&
    !filePath.startsWith("//") &&
    !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(filePath)
  );
}

function isSameOrInsidePath(parentPath, childPath, pathApi) {
  const relative = pathApi.relative(pathApi.resolve(parentPath), pathApi.resolve(childPath));
  return relative === "" || (!!relative && !relative.startsWith("..") && !pathApi.isAbsolute(relative));
}

module.exports = { isSupportedFilePathLite, isExtraDocumentFilePathLite, getFileTypeLabelLite, getOpenDialogFiltersLite, stripKnownExtensionLite, isAccessDeniedError, clampZoomLevel, normalizeZoomStep, stripNavigationFragment, decodeNavigationPath, isRootRelativeWorkspaceHref, isSameOrInsidePath };

