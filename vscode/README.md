# Markdown Explorer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Install-blueviolet.svg)](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-Install-2f855a.svg)](https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer)
[![Latest Release](https://img.shields.io/github/v/release/the-long-ride/markdown-explorer?color=orange&label=Latest%20Release)](https://github.com/the-long-ride/markdown-explorer/releases/latest)

Markdown files are built for AI agents. **Markdown Explorer** makes them pleasant for humans.

It turns `.md` and `.mdx` folders into a private, searchable documentation app inside VS Code, with workspace navigation, rendered diagrams, math, videos, highlighted code, interactive tables, charts, and a real reading layout. A standalone desktop app is also available for Windows, Linux, and [macOS](https://github.com/the-long-ride/markdown-explorer/blob/main/docs/macos-install.md).

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Search-in-all-tabs.png" width="900" alt="Markdown Explorer searching across open workspace tabs" />
</p>

## Why It Feels Different

- **Read workspaces, not loose files**: file tree, table of contents, section cards, copy buttons, and polished document navigation.
- **Search where you need**: current file or current workspace in VS Code, with content excerpts and exact jump-to-result behavior.
- **Render rich Markdown**: Mermaid, LaTeX math, images, streaming video, MDX, HTML sandboxes, callouts, frontmatter, and code blocks.
- **Use data inside docs**: sort, filter, multi-select table filters, collapse large tables, and switch tables into Bar, Line, or Pie charts.
- **Stay private**: rendering and indexing are local. No telemetry, no file uploads.

## Install

| Platform | Get It |
| --- | --- |
| VS Code | [Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer) |
| Open VSX | [Install from Open VSX](https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer) |
| Desktop app | [Download the latest GitHub Release](https://github.com/the-long-ride/markdown-explorer/releases/latest) |

## Search Modes

Find the exact content you need, then jump to the exact clicked match.

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Search-in-current-opened-file.png" width="31%" alt="Find inside the currently opened Markdown file" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Search-in-current-workspace.png" width="31%" alt="Search current workspace content" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Search-in-all-tabs.png" width="31%" alt="Search across desktop workspace tabs" />
</p>

## Tables That Stay Useful

Markdown tables become real data views: search rows, sort columns, multi-select filter values, keep large datasets collapsed, and switch to charts when numeric data is detected.

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Suport-interact-with-large-data-table.png" width="49%" alt="Large table with multi-select filters and sorted rows" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/View-as-chart-instead-with-datatable.png" width="49%" alt="Markdown table rendered as an interactive chart" />
</p>

## Diagrams, Math, Code, Media

Mermaid diagrams render offline, LaTeX math is readable, code blocks are highlighted, and Markdown can include local or streaming video.

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Adapt-all-kind-of-mermaid-diagram.png" width="49%" alt="Many Mermaid diagram types rendered in Markdown Explorer" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Math-formular-display.png" width="49%" alt="LaTeX math formulas rendered in Markdown Explorer" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Support-display-25-programming-languages-with-beauti-format.png" width="49%" alt="Syntax-highlighted code block with line numbers" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Support-Streaming-Video.png" width="49%" alt="YouTube video embedded inside a Markdown document" />
</p>

## HTML And Media Tools

Use isolated HTML previews for interactive examples, and inspect images or diagrams in a zoomable media modal.

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Interactive-HTML-sandbox_1.png" width="49%" alt="Interactive HTML sandbox in Markdown Explorer" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Mermaid-and-Image-Modal-View.png" width="49%" alt="Zoomable media modal for images and Mermaid diagrams" />
</p>

## Shortcuts

| Action | Desktop app | VS Code |
| --- | --- | --- |
| Open Markdown Explorer | N/A | `Ctrl+Shift+M` / `Cmd+Shift+M` |
| Toggle preview for current Markdown file | N/A | `Ctrl+Alt+V` / `Cmd+Alt+V` |
| Search current workspace | `Ctrl+F` | `Ctrl+K` / `Cmd+K` |
| Search all open workspace tabs | `Ctrl+Shift+F` | N/A |
| Find in current file | `F` | `K` |
| Back to previous file | `Ctrl+ArrowLeft` or mouse back | `Ctrl+ArrowLeft` / `Cmd+ArrowLeft` or mouse back |
| Go to next file | `Ctrl+ArrowRight` or mouse forward | `Ctrl+ArrowRight` / `Cmd+ArrowRight` or mouse forward |
| Go to welcome page | `Ctrl+H` | `Ctrl+H` / `Cmd+H` |
| Open settings | `Ctrl+I` | `Ctrl+I` / `Cmd+I` |
| Toggle theme | `Ctrl+Shift+L` | `Ctrl+Shift+L` / `Cmd+Shift+L` |
| Refresh workspace | `F5` | Use VS Code command or reload webview |
| Collapse all heading sections | `Ctrl+Shift+X` | `Ctrl+Shift+X` / `Cmd+Shift+X` |
| Expand all heading sections | `Ctrl+Shift+E` | `Ctrl+Shift+E` / `Cmd+Shift+E` |
| Go to workspace selection | `Ctrl+Shift+H` | N/A |
| Toggle sidebar | `Ctrl+Shift+P` | `Ctrl+Shift+P` / `Cmd+Shift+P` |
| Zoom in | `Ctrl+=`, `Ctrl+Plus`, or `Ctrl+MouseWheelUp` | Use editor/webview zoom |
| Zoom out | `Ctrl+-` or `Ctrl+MouseWheelDown` | Use editor/webview zoom |

## Privacy

- No telemetry.
- No file upload.
- Local parsing, indexing, rendering, and search.
- MIT licensed public source.

## Links

- [Website](https://the-long-ride.github.io/markdown-explorer/)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer)
- [Open VSX](https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer)
- [Latest GitHub Release](https://github.com/the-long-ride/markdown-explorer/releases/latest)
- [Changelog](https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md)
- [Issues](https://github.com/the-long-ride/markdown-explorer/issues)

## Report Issues

Bug reports and feature ideas are very welcome. Clear reports make fixes faster, and screenshots or tiny sample Markdown files are especially helpful.

Before opening a new issue, please take a quick look at the [existing issues](https://github.com/the-long-ride/markdown-explorer/issues) so we can keep related reports together.

When you open an issue, include what you can:

- **Short title**: one clear sentence, such as `Search result opens wrong match`.
- **App surface**: VS Code extension or desktop app.
- **Version**: app or extension version, plus OS.
- **Steps to reproduce**: the smallest click/key sequence that triggers the problem.
- **Expected behavior**: what you thought should happen.
- **Actual behavior**: what happened instead.
- **Screenshot or screen recording**: useful for layout, theme, zoom, and interaction bugs.
- **Minimal Markdown sample**: helpful for parser, Mermaid, math, table, video, or code-block issues.
- **Console or log output**: include errors from VS Code Developer Tools, Electron Developer Tools, or the terminal when available.

No need to make it perfect. A small reproducible example is already a huge gift to the project.
