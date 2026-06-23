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
  if (!markdownThem) {
    markdownThem = require("@the-long-ride/markdown-them");
  }
  return markdownThem;
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
  if (isMarkdownFilePath(filePath)) return true;
  if (isTextDocumentFilePath(filePath)) return true;
  return documentConversionEnabled && isConvertibleDocumentFilePath(filePath);
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
  if (!documentConversionEnabled) {
    return [
      { name: "Supported Files", extensions: ["md", "mdx", "txt"] },
      { name: "Markdown Files", extensions: ["md", "mdx"] },
      { name: "Text Files", extensions: ["txt"] },
    ];
  }
  return [
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
  ];
}

function normalizePreviewMarkdown(markdown, filePath) {
  const trimmed = String(markdown || "").trim();
  const title = stripKnownExtension(path.basename(filePath)).replace(/[\r\n]+/g, " ").trim();
  if (!trimmed) {
    return `# ${title}\n\n_No readable content was found while preparing this preview._`;
  }
  if (/^#\s+.+$/m.test(trimmed)) return trimmed;
  return `# ${title}\n\n${trimmed}`;
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

function createDocumentConverter() {
  const cache = new Map();

  async function getCachedConversion(filePath, stat) {
    const cached = cache.get(filePath);
    if (
      cached &&
      cached.mtimeMs === stat.mtimeMs &&
      cached.size === stat.size
    ) {
      return {
        markdown: cached.markdown,
        previewInfo: {
          kind: "converted",
          sourceExtension: getExtension(filePath),
          sourceLabel: getFileTypeLabel(filePath),
          durationMs: cached.durationMs,
          fromCache: true,
        },
      };
    }
    return null;
  }

  async function readMarkdown(filePath) {
    const ext = getExtension(filePath);

    if (MARKDOWN_EXTENSIONS.has(ext)) {
      return {
        markdown: await fs.promises.readFile(filePath, "utf8"),
        previewInfo: null,
      };
    }

    if (TEXT_DOCUMENT_EXTENSIONS.has(ext)) {
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
    }

    if (!CONVERTIBLE_DOCUMENT_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported file type: ${ext || path.basename(filePath)}`);
    }

    const stat = await fs.promises.stat(filePath);
    const cached = await getCachedConversion(filePath, stat);
    if (cached) return cached;

    const startedAt = Date.now();
    const markdown = normalizePreviewMarkdown(
      await getMarkdownThem().generateMarkdown(filePath),
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
  createDocumentConverter,
  getExtension,
  getFileTypeLabel,
  getOpenDialogFilters,
  isConvertibleDocumentFilePath,
  isExtraDocumentFilePath,
  isKnownSupportedFilePath,
  isMarkdownFilePath,
  isSupportedFilePath,
  isTextDocumentFilePath,
  stripKnownExtension,
};
