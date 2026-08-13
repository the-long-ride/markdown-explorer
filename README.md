# Markdown Explorer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Install-blueviolet.svg)](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-Install-2f855a.svg)](https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer)
[![Latest Release](https://img.shields.io/github/v/release/the-long-ride/markdown-explorer?color=orange&label=Latest%20Release)](https://github.com/the-long-ride/markdown-explorer/releases/latest)

Markdown files are built for AI agents. **Markdown Explorer** makes them pleasant for humans.

It turns `.md` and `.mdx` folders into a private, searchable documentation app with workspace navigation, rendered diagrams, math, videos, highlighted code, interactive tables, charts, tabs, and support for VS Code, Chromium browsers, desktop apps (Windows, Linux, [macOS](docs/macos-install.md)), and an interactive [demo web app](https://the-long-ride.github.io/markdown-explorer/).

Homepage: [https://the-long-ride.github.io/markdown-explorer/](https://the-long-ride.github.io/markdown-explorer/)

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Homepage.png" width="900" alt="Markdown Explorer homepage with workspace navigation and reading layout" />
</p>

## Why It Feels Different

- **Read workspaces, not loose files**: file tree, table of contents, section cards, copy buttons, recent workspaces, and desktop tabs.
- **Preview more document types**: open `.html` and `.htm` files as interactive previews or converted Markdown (`Ctrl+Alt+H`), plus opt in to local conversion for DOCX, PDF, XLSX, PPTX, ODT, ODP, ODS, RTF, and TXT files.
- **Search where you need**: current file, current workspace, or every open desktop tab, with content excerpts and exact jump-to-result behavior.
- **Stay keyboard-first**: use Sidebar Cursor mode to move through folders and files with `Alt+Z`, arrow keys, Enter, and Esc.
- **Shape the workspace**: file tabs, Scope Focus, Theme Remix, and settings import/export keep large doc sets personal without changing project files.
- **Render rich Markdown**: Mermaid, LaTeX math, images, streaming video, MDX, HTML sandboxes, callouts, frontmatter, and code blocks.
- **Use data inside docs**: CSV and TSV code fences, row sorting, multi-select table filters, collapsible datasets, and automatic Bar, Line, or Pie charts.
- **Stay private**: rendering and indexing are local. No telemetry, no file uploads.

## Installation

| Platform | Get It |
| --- | --- |
| VS Code | [Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer) |
| Open VSX | [Install from Open VSX](https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer) |
| Windows desktop | [Download the latest `.exe`](https://github.com/the-long-ride/markdown-explorer/releases/latest) (or Tauri version for better performance and smaller bundle size) |
| Linux desktop | [Download `.AppImage` or `.deb`](https://github.com/the-long-ride/markdown-explorer/releases/latest) (or Tauri version for better performance and smaller bundle size) |
| macOS desktop | [Download `.dmg` for arm64 or x64](https://github.com/the-long-ride/markdown-explorer/releases/latest) (or Tauri version for better performance and smaller bundle size). First launch notes: [macOS guide](docs/macos-install.md) |
| Chromium extension | [Download `.zip` release](https://github.com/the-long-ride/markdown-explorer/releases/latest). Setup guide: [Chromium guide](docs/chromium-install.md) |
| Microsoft Store and Ubuntu App Center | Automated Tauri publishing is prepared; use [GitHub Releases](https://github.com/the-long-ride/markdown-explorer/releases/latest) until the store listings are enabled. |

## Features

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Converted-Document-Preview.png" width="32%" alt="Converted DOCX preview with best-effort quality notice" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/VS-Code-style-mutli-workspace-multi-document-tabs.png" width="32%" alt="Multi-workspace and document tabs" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Your-Explorer-Your-Themes.png" width="32%" alt="Theme Remix settings for custom Markdown Explorer themes" />
</p>

- **Workspace Navigation & Organization**
  - **Workspaces & Folders**: Open local folders, manage recent workspaces, and navigate multi-workspace desktop tabs.
  - **Desktop Tab & Focus Views**: Switch between multi-workspace **Tab View** for managing multiple workspaces simultaneously and **Focus View** for distraction-free single-workspace reading (`Ctrl+Alt+T` / `Ctrl+Alt+F`).
  - **Workspace Feature Aliases**: Assign custom alias names to workspaces for easier identification.
  - **Open Folder / File from File Explorer**: Launch folders or `.md`/`.mdx` files directly from OS File Explorer context menus.
  - **Edit from preview**: Desktop keeps **Edit** in More actions (`Ctrl+E`), while VS Code exposes a dedicated Edit icon beside More actions (`Ctrl+Alt+E` / `Cmd+Alt+E`) to open the current `.md`/`.mdx` source in a normal editor tab. Chromium/Web does not expose Edit.
  - **Locate Current File**: Highlight and reveal the currently open file in the sidebar tree using the target icon button or `Alt+Q` shortcut.
  - **Sidebar Cursor Mode**: Keyboard-first file tree navigation (`Alt+Z`) with arrow keys, `Enter`, and `Esc`.
  - **Content File Tabs & Scope Focus**: Open files in tabs and narrow sidebar view to selected files or folders.
  - **Safer Workspace Operations**: Cancel running scans, reveal files and folders in native file manager, replace missing recent workspaces, and avoid stale scan results reopening old content.
  - **Richer Context & Row Menus**: Sidebar, document-tab, and workspace-tab menus expose context-aware actions and shortcuts.
  - **Relative Workspace Links**: Navigate across workspace files (`/`, `./`, `../`) with back/forward history.
  - **Live Auto-Refresh**: Instant workspace tree updates from native filesystem change events.

- **Pin & Bookmarks**
  - **Sidebar Pinning**: Pin any file or folder to the top of the sidebar for fast one-click access. Pinned items inside subfolders are hoisted and displayed at the root level of the file tree.
  - **Persistent Bookmarks**: Save named bookmarks from selected document text. Jump back to the exact location with search-style highlighting, and manage items through rename, delete, and three-dot or right-click menus.
  - **Source-Anchored Targets**: Bookmarks store the exact Markdown source range and a fingerprint so they survive edits and relocate contextually. Multi-line, mixed-format, LaTeX, Mermaid, image, and link selections are all supported. Repeated content resolves to the saved occurrence; edited targets report **Target changed** instead of jumping incorrectly.
  - **Bookmark Sidebar Tab**: Dedicated sidebar tab with live saved-count badge, sort controls, and instant search. Tab View groups bookmarks by workspace; Focus View shows only the current workspace.
  - **Batch Management**: Checkbox selection mode with confirmed batch deletion (`Ctrl+Shift+B` on Desktop, `Alt+Shift+B` on VS Code / Chromium / Web).
  - **Fully Localized**: All pin and bookmark labels, dialogs, empty/error states, and actions are available in English, Vietnamese, French, Spanish, Chinese, Norwegian, Japanese, Korean, and Russian.

- **Document Previews & Rich Media**
  - **HTML Document Modes**: Open `.html` and `.htm` files as isolated interactive previews or converted Markdown, switch active tab with `Ctrl+Alt+H`, and use **Open in Browser** when full browser behavior is needed (with embedded local CSS/JS support).
  - **Responsive Image Rows**: Same-paragraph Markdown images stay together across viewport sizes.
  - **GFM & GitHub Callouts**: Full GFM support with callout boxes (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).
  - **Diagrams & Math**: Offline Mermaid diagrams (flowchart, sequence, ER, mindmap, Gantt, timeline, etc.) and KaTeX math formulas. Diagrams use the baseline Mermaid renderer and can be opened in the full media viewer for zoom and inspection.
  - **Image & Mermaid Diagram Modal View**: Fullscreen, zoomable media modal to pan, zoom, and inspect images and Mermaid diagrams in detail.
  - **Syntax Highlighting & Fences**: 25+ programming languages highlighted with line numbers, copy buttons, and terminal command fences (`bash`, `pwsh`, `sh`, `zsh`, `cmd`).
  - **Interactive HTML Sandboxes**: Isolated HTML iframe previews for interactive code examples.
  - **Video Embedding**: Support for local video files and YouTube/streaming video embeds.

- **Data Tables & Charts**
  - **CSV and TSV Code Fences**: Switch highlighted delimited text into interactive tables with delimiter detection, header inference, Excel-style column labels, sorting, filtering, wrapping, and chart controls.
  - **Interactive Filtering & Sorting**: Multi-select column filters, row sorting, and text wrap/unwrap controls.
  - **Collapsible Datasets**: Compact view for large datasets (1000+ rows).
  - **View-as-Chart**: Automatically convert numeric table columns into interactive Bar, Line, or Pie charts.

- **Converted Document Previews**
  - **Multi-Format Local Conversion**: Opt-in previews for DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, RTF, and TXT files. Tauri performs conversion in-process with local Rust adapters; Electron and VS Code retain `@the-long-ride/markdown-them`. See [Native document conversion](docs/native-document-conversion.md).
  - **Smart Caching**: Fast re-views using file timestamp and size caching.

- **Search & Discovery**
  - **Flexible Search Scopes**: Search inside current file, current workspace, or across all open desktop tabs.
  - **Jump-to-Result**: Click search excerpts to jump directly to exact matches.

- **Customization & Platform Support**
  - **Built-in Theme Families & Theme Remix**: Choose grouped built-in themes—including Aurora Glass, Neon Voltage, and Raw Grid—pet themes, or create, edit, import, and export custom themes with color, density, spacing, and background image controls.
  - **Keyboard Shortcuts**: Fully customizable keyboard shortcuts covering virtually all actions, navigation controls, and features in the app.
  - **Desktop Store Publishing**: Automated release pipeline for signing and submitting Tauri builds to Microsoft Store and Ubuntu App Center.
  - **Settings Navigation**: Settings uses a sidebar with Appearance, Typography, Theme Style, Keyboard Shortcuts, and Update & Backup sections so related controls stay focused instead of sharing one long form.
  - **Typography**: Electron, Tauri, and VS Code support independent **App UI, Body, Heading, Quote, and Code** font bindings. Each role can choose a detected system family or an imported `.ttf`/`.otf` file plus an explicit supported style/weight. Imported files are copied once into app-managed storage and can be reused by any role. Chromium/Web keeps bundled/web-safe fonts and leaves zoom/font discovery to the browser.
  - **Update Notifications**: Desktop releases can show a new-version dialog at startup with Download, Later, changelog, and **Skip notify for this version** actions. Skipping suppresses only that release; a newer release is shown again.
  - **Cross-Platform**: Available for VS Code, Open VSX, Desktop (Electron & Tauri), and Chromium extensions.
  - **Native OS Integration**: Windows File Explorer context menus and customizable desktop shortcuts.
  - **Privacy First**: 100% local rendering and search with zero telemetry and no file uploads.

## Search Modes

Find the exact content you need, then jump to the exact clicked match.

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Search-in-current-opened-file.png" width="31%" alt="Find inside the currently opened Markdown file" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Search-in-current-workspace.png" width="31%" alt="Search current workspace content" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Search-in-all-tabs.png" width="31%" alt="Search across all desktop workspace tabs" />
</p>

## Tables That Stay Useful

Markdown tables become real data views: search rows, sort columns, multi-select filter values, keep large datasets collapsed, and switch to charts when numeric data is detected.

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/View-data-table-easier-than-ever.png" width="32%" alt="Markdown table rendered as an easier data view" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/chart-for datatable-and-CSV-TSV.png" width="32%" alt="Data table rendered as an interactive chart" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/chart-for datatable-and-CSV-TSV_2.png" width="32%" alt="Alternative chart view for data tables and CSV/TSV" />
</p>

## Diagrams, Math, Code, Media

Mermaid diagrams render offline through the baseline Mermaid renderer, and the media viewer remains available for zooming and inspection. LaTeX math is readable, code blocks are highlighted, and Markdown can include local or streaming video. Desktop builds use JetBrains Mono for code by default and expose independent App UI, Body, Heading, Quote, and Code font bindings in Settings.

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Support-all-kinds-of-Mermaid-diagram.png" width="49%" alt="Many Mermaid diagram types rendered in Markdown Explorer" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Math-formular-display.png" width="49%" alt="LaTeX math formulas rendered in Markdown Explorer" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Support-display-25-programming-languages-with-beauti-format_2.png" width="31%" alt="Syntax-highlighted code block with line numbers" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/custom-keyboard-shortcuts-binding.png" width="31%" alt="Custom keyboard shortcuts binding" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Better-reading-markdown-files-exp.png" width="31%" alt="Optimized Markdown reading experience" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Supported-HTML-File-Preview.png" width="49%" alt="Supported HTML file preview" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/support-focus-and-full-screen-mode-turn-your-document-to-presentation.png" width="49%" alt="Focus and fullscreen mode for documents" />
</p>

## HTML And Media Tools

Use isolated HTML previews for interactive examples, and inspect images or diagrams in a zoomable media modal.

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Interactive-HTML-sandbox.png" width="49%" alt="Interactive HTML sandbox in Markdown Explorer" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Supported-HTML-File-Preview.png" width="49%" alt="Supported HTML preview in Markdown Explorer" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Mermaid-and-Image-Modal-View_1.png" width="90%" alt="Zoomable media modal for images and Mermaid diagrams" />
</p>

## Windows File Explorer

The Windows installer provides checked-by-default choices to create a desktop shortcut, add **Open with Markdown Explorer** for `.md` and `.mdx` files, and add **Open Folder in Markdown Explorer** to folder and empty-folder-background menus. Opening a Markdown file loads its containing folder as the workspace and displays that selected file. Opening a folder loads that exact folder. In Tab view this opens a workspace tab; in Focus view it replaces the current workspace. Portable and ZIP builds do not modify File Explorer automatically.

## Desktop Workspace

The desktop app opens recent folders quickly, supports drag-and-drop opening, can keep multiple workspaces alive in tabs, and automatically refreshes open workspaces from native filesystem change events without polling. Workspace loading shows the running scan count; if a scan lasts longer than three seconds, Markdown Explorer opens with the files found so far and refreshes the tree in cumulative batches of 32 while scanning continues. An empty-workspace message appears only after scanning finishes with no supported files.

<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Workspace-Selection.png" width="32%" alt="Desktop workspace selection screen" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/VS-Code-style-mutli-workspace-multi-document-tabs.png" width="32%" alt="Desktop workspace multi-document tabs view" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Homepage.png" width="32%" alt="Markdown Explorer welcome page with help section" />
</p>

## Converted Document Previews

Markdown Explorer can optionally show DOCX, PDF, HTML, XLSX, PPTX, ODT, ODP, ODS, RTF, and TXT files by converting them to Markdown locally with `@the-long-ride/markdown-them`.

Turn on **Read DOCX, PDF, Office, and text files** in Settings. The app scans those extra extensions only after the toggle is enabled, converts files only when opened, and caches converted Markdown by file timestamp and size for faster repeat views. Converted previews are best-effort and can differ from the original layout, tables, images, or styling.

## Keyboard Shortcuts

Desktop shortcuts can be customized in Settings. VS Code keeps editor-friendly defaults inside the webview.

| Action | Desktop app | VS Code extension | Chromium extension |
| --- | --- | --- | --- |
| Open Markdown Explorer | N/A | `Ctrl+Shift+M` / `Cmd+Shift+M` | N/A |
| Toggle preview for current Markdown file | N/A | `Ctrl+Alt+V` / `Cmd+Alt+V` | N/A |
| Search current workspace | `Ctrl+F` | `Ctrl+K` / `Cmd+K` | `Ctrl+K` / `Cmd+K` |
| Search all open workspace tabs | `Ctrl+Shift+F` | `Ctrl+Shift+K` / `Cmd+Shift+K` | `Ctrl+Shift+K` / `Cmd+Shift+K` |
| Find in current file | `F` | `K` | `K` |
| Back to previous file | `Ctrl+ArrowLeft` or mouse back | `Ctrl+ArrowLeft` / `Cmd+ArrowLeft` or mouse back | `Ctrl+ArrowLeft` / `Cmd+ArrowLeft` or mouse back |
| Go to next file | `Ctrl+ArrowRight` or mouse forward | `Ctrl+ArrowRight` / `Cmd+ArrowRight` or mouse forward | `Ctrl+ArrowRight` / `Cmd+ArrowRight` or mouse forward |
| Go to welcome page | `Ctrl+H` | `Ctrl+H` / `Cmd+H` | `Ctrl+H` / `Cmd+H` |
| Edit current document | `Ctrl+E` | `Ctrl+Alt+E` / `Cmd+Alt+E` | N/A |
| Open settings | `Ctrl+,` | `Ctrl+I` / `Cmd+I` | `Ctrl+I` / `Cmd+I` |
| Toggle theme | `Ctrl+L` | `Ctrl+Shift+L` / `Cmd+Shift+L` | `Ctrl+Shift+L` / `Cmd+Shift+L` |
| Refresh workspace | `F5` | `R` | `R` |
| Collapse all heading sections | `Ctrl+Shift+X` | `Ctrl+Shift+X` / `Cmd+Shift+X` | `Ctrl+Shift+X` / `Cmd+Shift+X` |
| Expand all heading sections | `Ctrl+Shift+E` | `Ctrl+Shift+E` / `Cmd+Shift+E` | `Ctrl+Shift+E` / `Cmd+Shift+E` |
| Go to workspace selection | `Ctrl+N` | `Ctrl+Alt+W` / `Cmd+Alt+W` | `Ctrl+Alt+W` / `Cmd+Alt+W` |
| Open current document folder | `Shift+Alt+R` | N/A | N/A |
| Toggle sidebar | `Ctrl+B` | `Alt+A` | `Alt+A` |
| Toggle table of contents | `Ctrl+T` | `Alt+C` | `Alt+C` |
| Locate current file | `Alt+Q` | `Alt+Q` | `Alt+Q` |
| Toggle Focus mode | `Ctrl+Alt+F` | `Ctrl+Alt+F` / `Cmd+Alt+F` | `Ctrl+Alt+F` / `Cmd+Alt+F` |
| Toggle active HTML document view | `Ctrl+Alt+H` | `Ctrl+Alt+H` / `Cmd+Alt+H` | `Ctrl+Alt+H` / `Cmd+Alt+H` |
| Toggle desktop Tabs/Focus view | `Ctrl+Alt+T` | N/A | N/A |
| Close current content tab | `Ctrl+W` | N/A | N/A |
| Close all content tabs | `Ctrl+Shift+W` | N/A | N/A |
| Close content tabs to the right | `Ctrl+Alt+W` | N/A | N/A |
| Close other content tabs | `Ctrl+Alt+O` | N/A | N/A |
| Toggle fullscreen | `F11` | N/A | N/A |
| Sidebar cursor mode | `Alt+Z` | `Alt+Z` | `Alt+Z` |
| Zoom in | `Ctrl+=`, `Ctrl+Plus`, or `Ctrl+MouseWheelUp` | Use editor/webview zoom | Use browser zoom |
| Zoom out | `Ctrl+-` or `Ctrl+MouseWheelDown` | Use editor/webview zoom | Use browser zoom |
| Reset zoom | `Ctrl+Alt+Z` | Use editor/webview zoom | Use browser zoom |

## Privacy

- No telemetry.
- No file upload.
- Local parsing, indexing, rendering, and search.
- MIT licensed public source.

## Links

- [Website](https://the-long-ride.github.io/markdown-explorer/)
- [Demo Web App](https://the-long-ride.github.io/markdown-explorer/)
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

No need to make it perfect. A small reproducible example is already a huge gift to the project 💕.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Author

[the-long-ride](https://github.com/the-long-ride) - passionate about making Markdown more enjoyable and useful for everyone. If you find this project helpful, consider starring the repository or sharing it with others who might benefit!
