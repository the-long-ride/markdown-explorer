import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rootReadmePath = path.join(rootDir, 'README.md');
const vscodeReadmePath = path.join(rootDir, 'vscode', 'README.md');

export function generateVscodeReadme(rootReadmeContent, existingVscodeReadmeContent = '') {
  const tutorialMatch = existingVscodeReadmeContent.match(
    /## VS Code Extension Tutorial[\s\S]*?(?=\n## Features)/,
  );
  const tutorialSection = tutorialMatch
    ? tutorialMatch[0].trim()
    : `## VS Code Extension Tutorial

Open any folder containing Markdown files in VS Code to get started. Use the Markdown Explorer button in the workspace header, or open the Command Palette:

| Goal | Command / Action | Access Point | Shortcut (Win/Linux) | Shortcut (macOS) |
| --- | --- | --- | --- | --- |
| **Open Docs Viewer** | \`Markdown Explorer: Open Docs Viewer\` | Explorer Header Icon / Command Palette | \`Ctrl+Shift+M\` | \`Cmd+Shift+M\` |
| **Toggle Active File Preview** | \`Markdown Explorer: Toggle Docs Viewer\` | Editor Title Icon / Command Palette | \`Ctrl+Alt+V\` | \`Cmd+Alt+V\` |
| **Preview Selected File** | \`Markdown Explorer: Preview This File\` | Right-click \`.md\`/\`.mdx\` in File Explorer | Context Menu | Context Menu |
| **Open Folder Workspace** | \`Open Folder in Markdown Explorer\` | Right-click folder in File Explorer | Context Menu | Context Menu |
| **Refresh Workspace** | \`Markdown Explorer: Refresh\` | Webview Header / Command Palette | \`R\` | \`R\` |

> [!TIP]
> **Icon Missing?** The Explorer header icon adapts automatically to your VS Code color theme. If it does not appear after installing or updating, run **Developer: Reload Window** in the Command Palette.

In VS Code, imported fonts live in extension global storage and do not change VS Code editor fonts. Use the dedicated Edit icon beside More actions (\`Ctrl+Alt+E\` / \`Cmd+Alt+E\`) to open the current Markdown source in a normal editor tab.`;

  let content = rootReadmeContent;

  const GITHUB_BLOB_BASE = 'https://github.com/the-long-ride/markdown-explorer/blob/main';
  content = content.replace(/href="docs\//g, `href="${GITHUB_BLOB_BASE}/docs/`);
  content = content.replace(/\]\(docs\//g, `](${GITHUB_BLOB_BASE}/docs/`);
  content = content.replace(/\]\(LICENSE\)/g, `](${GITHUB_BLOB_BASE}/LICENSE)`);
  content = content.replace(/\]\(CHANGELOG\.md\)/g, `](${GITHUB_BLOB_BASE}/CHANGELOG.md)`);

  if (content.includes('## Features') && !content.includes('## VS Code Extension Tutorial')) {
    content = content.replace(
      /\r?\n## Features\r?\n/,
      `\n\n${tutorialSection}\n\n## Features\n`,
    );
  }

  content = content.replace(/\r\n/g, '\n');
  content = content.replace(/\n{3,}/g, '\n\n');

  return content;
}

export function syncReadme() {
  if (!fs.existsSync(rootReadmePath)) {
    console.warn(`Root README not found at ${rootReadmePath}`);
    return;
  }
  const rootContent = fs.readFileSync(rootReadmePath, 'utf8');
  const existingVscodeContent = fs.existsSync(vscodeReadmePath)
    ? fs.readFileSync(vscodeReadmePath, 'utf8')
    : '';

  const generated = generateVscodeReadme(rootContent, existingVscodeContent);

  if (generated !== existingVscodeContent) {
    fs.writeFileSync(vscodeReadmePath, generated, 'utf8');
    console.log('Synced: vscode/README.md from root README.md');
  } else {
    console.log('vscode/README.md is already up to date with root README.md');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncReadme();
}
