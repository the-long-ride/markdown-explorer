const path = require('path');

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);
const OPEN_WITH_FOLDER_FLAG = '--open-with-folder';

function isMarkdownFile(filePath) {
  return MARKDOWN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function requestForPath(filePath, fs) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return { mode: 'folder', folderPath: filePath };
  if (stat.isFile() && isMarkdownFile(filePath)) return { mode: 'file', filePath };
  return null;
}

function findExternalOpenRequest(argv, fs, options = {}) {
  const isPackaged = typeof options === 'boolean' ? options : (options?.isPackaged ?? true);
  const startIndex = isPackaged ? 1 : 2;
  const args = Array.isArray(argv) ? argv.slice(startIndex) : [];
  const withFolderIndex = args.indexOf(OPEN_WITH_FOLDER_FLAG);
  if (withFolderIndex >= 0) {
    const filePath = args[withFolderIndex + 1];
    const request = requestForPath(filePath, fs);
    if (!request || request.mode !== 'file') return null;
    return {
      mode: 'file-with-parent-workspace',
      filePath: request.filePath,
      folderPath: path.dirname(request.filePath),
    };
  }

  for (const value of args) {
    if (!value || value.startsWith('-')) continue;
    const request = requestForPath(value, fs);
    if (request) return request;
  }
  return null;
}

const findExternalOpenPath = findExternalOpenRequest;

function createExternalOpenQueue() {
  let pendingRequest = null;
  return {
    push(request) { pendingRequest = request || null; },
    take() {
      const next = pendingRequest;
      pendingRequest = null;
      return next;
    },
  };
}

module.exports = { findExternalOpenRequest, findExternalOpenPath, createExternalOpenQueue };
