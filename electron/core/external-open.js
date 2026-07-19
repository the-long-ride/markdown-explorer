const path = require('path');

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);

function isMarkdownFile(filePath) {
  return MARKDOWN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function findExternalOpenPath(argv, fs) {
  for (const value of Array.isArray(argv) ? argv.slice(1) : []) {
    if (!value || value.startsWith('-') || !fs.existsSync(value)) continue;
    const stat = fs.statSync(value);
    if (stat.isDirectory() || (stat.isFile() && isMarkdownFile(value))) return value;
  }
  return null;
}

function createExternalOpenQueue() {
  let pendingPath = null;
  return {
    push(filePath) { pendingPath = filePath || null; },
    take() {
      const next = pendingPath;
      pendingPath = null;
      return next;
    },
  };
}

module.exports = { findExternalOpenPath, createExternalOpenQueue };
