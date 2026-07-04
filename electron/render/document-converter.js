const fs = require("fs");
const path = require("path");

const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);
const TEXT_DOCUMENT_EXTENSIONS = new Set([".txt"]);
const CONVERTIBLE_DOCUMENT_EXTENSIONS = new Set([
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
const EXTRA_DOCUMENT_EXTENSIONS = new Set([
  ...CONVERTIBLE_DOCUMENT_EXTENSIONS,
  ...TEXT_DOCUMENT_EXTENSIONS,
]);
const ALL_SUPPORTED_EXTENSIONS = new Set([
  ...MARKDOWN_EXTENSIONS,
  ...EXTRA_DOCUMENT_EXTENSIONS,
]);

const CONVERSION_QUALITY_WARNING =
  "This preview was converted to Markdown. Layout, images, tables, and styling may not perfectly match the original file.";

let markdownThem = null;

function getMarkdownThem() {
  return markdownThem || (markdownThem = require("@the-long-ride/markdown-them"));
}

function getExtension(filePath) {
  return path.extname(filePath || "").toLowerCase();
}

function isMarkdownFilePath(filePath) {
  return MARKDOWN_EXTENSIONS.has(getExtension(filePath));
}

function isTextDocumentFilePath(filePath) {
  return TEXT_DOCUMENT_EXTENSIONS.has(getExtension(filePath));
}

function isConvertibleDocumentFilePath(filePath) {
  return CONVERTIBLE_DOCUMENT_EXTENSIONS.has(getExtension(filePath));
}

function isExtraDocumentFilePath(filePath) {
  return EXTRA_DOCUMENT_EXTENSIONS.has(getExtension(filePath));
}

function isSupportedFilePath(filePath, documentConversionEnabled = false) {
  return isMarkdownFilePath(filePath) || isTextDocumentFilePath(filePath) || (documentConversionEnabled && isConvertibleDocumentFilePath(filePath));
}

function isKnownSupportedFilePath(filePath) {
  return ALL_SUPPORTED_EXTENSIONS.has(getExtension(filePath));
}

function stripKnownExtension(fileName) {
  const ext = path.extname(fileName);
  return ext ? fileName.slice(0, -ext.length) : fileName;
}

function getFileTypeLabel(filePath) {
  const ext = getExtension(filePath);
  return ext ? ext.slice(1).toUpperCase() : "Document";
}

function getOpenDialogFilters(documentConversionEnabled = false) {
  return documentConversionEnabled
    ? [
        {
          name: "Supported Documents",
          extensions: [
            "md",
            "mdx",
            "doc",
            "docx",
            "pdf",
            "html",
            "xls",
            "xlsx",
            "xlm",
            "pptx",
            "odt",
            "odp",
            "ods",
            "rtf",
            "txt",
          ],
        },
        { name: "Markdown and Text Files", extensions: ["md", "mdx", "txt"] },
        { name: "Markdown Files", extensions: ["md", "mdx"] },
        {
          name: "Converted Document Files",
          extensions: [
            "doc",
            "docx",
            "pdf",
            "html",
            "xls",
            "xlsx",
            "xlm",
            "pptx",
            "odt",
            "odp",
            "ods",
            "rtf",
          ],
        },
      ]
    : [
        { name: "Supported Files", extensions: ["md", "mdx", "txt"] },
        { name: "Markdown Files", extensions: ["md", "mdx"] },
        { name: "Text Files", extensions: ["txt"] },
      ];
}

function normalizePreviewMarkdown(markdown, filePath) {
  const trimmed = String(markdown || "").trim();
  const title = stripKnownExtension(path.basename(filePath)).replace(/[\r\n]+/g, " ").trim();
  return !trimmed
    ? `# ${title}\n\n_No readable content was found while preparing this preview._`
    : /^#\s+.+$/m.test(trimmed)
      ? trimmed
      : `# ${title}\n\n${trimmed}`;
}

function createFailureMarkdown(filePath, err) {
  const title = stripKnownExtension(path.basename(filePath)).replace(/[\r\n]+/g, " ").trim();
  const message = err instanceof Error ? err.message : String(err || "Unknown conversion error");
  return [
    `# ${title}`,
    "",
    `Markdown Explorer could not convert this ${getFileTypeLabel(filePath)} file.`,
    "",
    "```text",
    message,
    "```",
  ].join("\n");
}

function classifyExtension(ext) {
  return MARKDOWN_EXTENSIONS.has(ext) ? "markdown"
    : TEXT_DOCUMENT_EXTENSIONS.has(ext) ? "text"
    : CONVERTIBLE_DOCUMENT_EXTENSIONS.has(ext) ? "convertible"
    : "unsupported";
}

async function readMarkdownFile(ext, filePath, resolveMarkdownThem, cache) {
  const fileType = classifyExtension(ext);

  if (fileType === "unsupported") {
    throw new Error(`Unsupported file type: ${ext || path.basename(filePath)}`);
  } else if (fileType === "markdown") {
    return {
      markdown: await fs.promises.readFile(filePath, "utf8"),
      previewInfo: null,
    };
  } else if (fileType === "text") {
    return {
      markdown: normalizePreviewMarkdown(
        await fs.promises.readFile(filePath, "utf8"),
        filePath,
      ),
      previewInfo: {
        kind: "text",
        sourceExtension: ext,
        sourceLabel: getFileTypeLabel(filePath),
      },
    };
  } else {
    const stat = await fs.promises.stat(filePath);
    const cached = await getCachedConversionResult(cache, filePath, stat);
    if (cached) return cached;

    const startedAt = Date.now();
    const markdown = normalizePreviewMarkdown(
      await resolveMarkdownThem().generateMarkdown(filePath),
      filePath,
    );
    const durationMs = Date.now() - startedAt;

    cache.set(filePath, {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      markdown,
      durationMs,
    });

    return {
      markdown,
      previewInfo: {
        kind: "converted",
        sourceExtension: ext,
        sourceLabel: getFileTypeLabel(filePath),
        durationMs,
        fromCache: false,
      },
    };
  }
}

async function getCachedConversionResult(cache, filePath, stat) {
  const cached = cache.get(filePath);
  return (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size)
    ? {
        markdown: cached.markdown,
        previewInfo: {
          kind: "converted",
          sourceExtension: getExtension(filePath),
          sourceLabel: getFileTypeLabel(filePath),
          durationMs: cached.durationMs,
          fromCache: true,
        },
      }
    : null;
}

function createDocumentConverter({ getMarkdownThem: injectedGetMarkdownThem } = {}) {
  const cache = new Map();
  const resolveMarkdownThem = injectedGetMarkdownThem || getMarkdownThem;

  async function readMarkdown(filePath) {
    const ext = getExtension(filePath);
    return readMarkdownFile(ext, filePath, resolveMarkdownThem, cache);
  }

  return {
    readMarkdown,
    createFailureMarkdown,
  };
}

module.exports = {
  ALL_SUPPORTED_EXTENSIONS,
  CONVERTIBLE_DOCUMENT_EXTENSIONS,
  EXTRA_DOCUMENT_EXTENSIONS,
  MARKDOWN_EXTENSIONS,
  TEXT_DOCUMENT_EXTENSIONS,
  CONVERSION_QUALITY_WARNING,
  classifyExtension,
  createDocumentConverter,
  createFailureMarkdown,
  getExtension,
  getFileTypeLabel,
  getMarkdownThem,
  getOpenDialogFilters,
  isConvertibleDocumentFilePath,
  isExtraDocumentFilePath,
  isKnownSupportedFilePath,
  isMarkdownFilePath,
  isSupportedFilePath,
  isTextDocumentFilePath,
  normalizePreviewMarkdown,
  readMarkdownFile,
  getCachedConversionResult,
  stripKnownExtension,
};
