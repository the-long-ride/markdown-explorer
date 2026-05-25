const fs = require('fs');
const path = require('path');

class DesktopScanner {
  static scan(rootPath) {
    const flat = [];
    const maxFiles = 1000;
    const excludes = ['.git', 'node_modules', '.vscode', 'out', 'dist'];

    function traverse(currentDir) {
      if (flat.length >= maxFiles) return;
      let entries = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch (err) {
        console.error('Failed to read directory:', currentDir, err);
        return;
      }

      for (const entry of entries) {
        if (excludes.includes(entry.name)) continue;
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          traverse(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.md' || ext === '.mdx') {
            flat.push(DesktopScanner.buildFileEntry(fullPath, rootPath));
          }
        }
      }
    }

    traverse(rootPath);
    flat.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    const tree = DesktopScanner.buildTree(flat);
    return { tree, flat };
  }

  static buildFileEntry(fsPath, rootPath) {
    const relativePath = path.relative(rootPath, fsPath);
    const parts = relativePath.split(path.sep);
    const fileName = parts[parts.length - 1];
    const isMdx = fileName.endsWith('.mdx');
    const title = DesktopScanner.extractTitle(fsPath, isMdx) ?? fileName.replace(/\.(md|mdx)$/i, '');
    return { fsPath, relativePath, parts, fileName, title };
  }

  static extractTitle(fsPath, isMdx = false) {
    try {
      const content = fs.readFileSync(fsPath, 'utf8');
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
      return jsxMatch[2]?.trim() ?? jsxMatch[4]?.trim() ?? null;
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
