const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const {
  getExtension,
  isMarkdownFilePath,
  isSupportedFilePath,
  stripKnownExtension,
} = require('../render/document-converter');
const DEFAULT_IGNORED_FOLDERS = [
  '.git', 'node_modules', '.vscode', 'dist', 'out', 'build',
  'coverage', '.next', '.nuxt', '.turbo', '.cache', 'vendor',
  'target', 'bin', 'obj',
];

function loadIgnorePatterns(rootPath) {
  const ignorePath = path.join(rootPath, '.markdown-explorer-ignore');
  try {
    const content = fs.readFileSync(ignorePath, 'utf8');
    return content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

class DesktopScanner {
  // Async scanner — uses BFS with setImmediate yielding every YIELD_EVERY files
  // so the main thread stays responsive during large workspace scans.
  static async scan(rootPath, options = {}) {
    const flat = [];
    const customIgnores = loadIgnorePatterns(rootPath);
    const excludes = [...DEFAULT_IGNORED_FOLDERS, ...customIgnores];
    const documentConversionEnabled = options.documentConversionEnabled === true;
    const YIELD_EVERY = 30;

    const dirQueue = [rootPath];
    let filesSinceYield = 0;
    let titleBatch = []; // collect markdown files needing title extraction

    while (dirQueue.length > 0) {
      const currentDir = dirQueue.shift();
      let entries;
      try {
        entries = await fsp.readdir(currentDir, { withFileTypes: true });
      } catch (err) {
        console.error('Failed to read directory:', currentDir, err);
        continue;
      }

      for (const entry of entries) {
        if (excludes.includes(entry.name)) continue;
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          dirQueue.push(fullPath);
        } else if (entry.isFile()) {
          if (isSupportedFilePath(fullPath, documentConversionEnabled)) {
            // Fast path: use filename as title, extract real title async below
            const isMdx = fullPath.toLowerCase().endsWith('.mdx');
            const isMarkdown = fullPath.match(/\.(md|mdx|markdown)$/i);
            const entryObj = {
              ...DesktopScanner.buildFileEntryLite(fullPath, rootPath, isMarkdown ? 'pending' : stripKnownExtension(fullPath)),
              _needsTitle: isMarkdown ? isMdx : false,
            };
            flat.push(entryObj);
            if (isMarkdown) titleBatch.push({ entry: entryObj, isMdx: !!isMdx });
            filesSinceYield++;
          }
        }
      }

      // Yield to event loop periodically to keep UI responsive
      if (filesSinceYield >= YIELD_EVERY) {
        filesSinceYield = 0;
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    // Extract titles asynchronously in batches (yielding between each)
    const TITLE_BATCH = 8;
    for (let i = 0; i < titleBatch.length; i += TITLE_BATCH) {
      const batch = titleBatch.slice(i, i + TITLE_BATCH);
      for (const { entry, isMdx } of batch) {
        try {
          const title = await DesktopScanner.extractTitleAsync(entry.fsPath, isMdx);
          if (title) entry.title = title;
        } catch {
          // keep the pending/placeholder title
        }
      }
      if (i + TITLE_BATCH < titleBatch.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    flat.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    const tree = DesktopScanner.buildTree(flat);
    return { tree, flat };
  }

  // Lightweight file entry builder (used during scan, title filled later)
  static buildFileEntryLite(fsPath, rootPath, placeholderTitle) {
    const relativePath = path.relative(rootPath, fsPath);
    const parts = relativePath.split(path.sep);
    const fileName = parts[parts.length - 1];
    const ext = getExtension(fileName);
    const isMarkdown = isMarkdownFilePath(fileName);
    const title = placeholderTitle || stripKnownExtension(fileName);
    const documentKind = isMarkdown ? 'markdown' : 'document';
    return { fsPath, relativePath, parts, fileName, title, extension: ext, documentKind };
  }

  // Async title extraction — reads the first 64 KB and extracts H1 / frontmatter.
  static async extractTitleAsync(fsPath, isMdx = false) {
    try {
      const content = await DesktopScanner.readTitleChunkAsync(fsPath);
      if (isMdx) {
        const mdxTitle = DesktopScanner.extractMdxTitle(content);
        if (mdxTitle) return mdxTitle;
      }
      const match = /^#+\s+(.+)$/m.exec(content);
      return match?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  static async readTitleChunkAsync(fsPath) {
    let fd;
    try {
      fd = await fsp.open(fsPath, 'r');
      const buffer = Buffer.allocUnsafe(8 * 1024);
      const { bytesRead } = await fd.read(buffer, 0, buffer.length, 0);
      return buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      if (fd) await fd.close();
    }
  }

  static buildFileEntry(fsPath, rootPath) {
    const relativePath = path.relative(rootPath, fsPath);
    const parts = relativePath.split(path.sep);
    const fileName = parts[parts.length - 1];
    const ext = getExtension(fileName);
    const isMarkdown = isMarkdownFilePath(fileName);
    const isMdx = ext === '.mdx';
    const title = isMarkdown
      ? DesktopScanner.extractTitle(fsPath, isMdx) ?? stripKnownExtension(fileName)
      : stripKnownExtension(fileName);
    const documentKind = isMarkdown ? 'markdown' : 'document';
    return { fsPath, relativePath, parts, fileName, title, extension: ext, documentKind };
  }

  static extractTitle(fsPath, isMdx = false) {
    try {
      const content = DesktopScanner.readTitleChunk(fsPath);
      if (isMdx) {
        const mdxTitle = DesktopScanner.extractMdxTitle(content);
        if (mdxTitle) return mdxTitle;
      }
      const match = /^#+\s+(.+)$/m.exec(content);
      return match?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  static readTitleChunk(fsPath) {
    const fd = fs.openSync(fsPath, 'r');
    try {
      const buffer = Buffer.allocUnsafe(8 * 1024);
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      return buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  }

  static extractMdxTitle(content) {
    // 1. Frontmatter title
    const fmMatch = /^---\n([\s\S]*?)\n---/.exec(content);
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const sep = line.indexOf(':');
        if (sep > 0 && line.slice(0, sep).trim() === 'title') {
          return line.slice(sep + 1).trim().replace(/^['"]|['"]$/g, '');
        }
      }
    }

    // 2. export const title = ...
    const exportMatch = /export\s+(?:const|let|var)\s+title\s*=\s*(['"`])(.*?)\1/.exec(content);
    if (exportMatch) {
      return exportMatch[2].trim();
    }

    // 3. export const meta = { title: ... }
    const metaMatch = /export\s+(?:const|let|var)\s+meta\s*=\s*\{[\s\S]*?title\s*:\s*(['"`])(.*?)\1/.exec(content);
    if (metaMatch) {
      return metaMatch[2].trim();
    }

    // 4. JSX title prop
    const jsxMatch = /<[A-Z]\w*\s+[^>]*?title=(?:(['"`])(.*?)\1|\{(['"`])(.*?)\3\})/.exec(content);
    if (jsxMatch) {
      const title = (jsxMatch[2] ?? jsxMatch[4]);
      return title ? title.trim() : null;
    }

    return null;
  }

  static buildTree(flat) {
    const root = { name: 'root', path: '', children: [], files: [] };

    for (const file of flat) {
      let node = root;
      const dirs = file.parts.slice(0, -1);

      for (let i = 0; i < dirs.length; i++) {
        const name = dirs[i];
        let child = node.children.find(c => c.name === name);
        if (!child) {
          child = { name, path: dirs.slice(0, i + 1).join('/'), children: [], files: [] };
          node.children.push(child);
        }
        node = child;
      }

      node.files.push(file);
    }

    return root;
  }
}

module.exports = DesktopScanner;
module.exports.loadIgnorePatterns = loadIgnorePatterns;
