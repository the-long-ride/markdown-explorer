# Markdown Explorer

<p align="left">
  <a href="https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-ff9130?style=flat-square&labelColor=000000" alt="License: MIT" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer"><img src="https://img.shields.io/badge/VS%20Code%20Marketplace-Install-ff9130?style=flat-square&logo=visualstudiocode&logoColor=white&labelColor=000000" alt="VS Code Marketplace" /></a>
  <a href="https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer"><img src="https://img.shields.io/badge/Open%20VSX-Install-ff9130?style=flat-square&logo=vscodium&logoColor=white&labelColor=000000" alt="Open VSX" /></a>
  <a href="https://github.com/the-long-ride/markdown-explorer/releases/latest"><img src="https://img.shields.io/github/v/release/the-long-ride/markdown-explorer?color=ff9130&label=Latest%20Release&style=flat-square&labelColor=000000" alt="Latest Release" /></a>
  <a href="https://github.com/the-long-ride/markdown-explorer/actions"><img src="https://img.shields.io/badge/Build-%E2%9C%93-ff9130?style=flat-square&logo=githubactions&logoColor=white&labelColor=000000" alt="GHA Build" /></a>
</p>
<p align="left">
  <a href="https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer"><img src="https://img.shields.io/badge/VS%20Code-%E2%9C%93-ff9130?style=flat-square&logo=visualstudiocode&logoColor=white&labelColor=000000" alt="VS Code" /></a>
  <a href="https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer"><img src="https://img.shields.io/badge/VSCodium-%E2%9C%93-ff9130?style=flat-square&logo=vscodium&logoColor=white&labelColor=000000" alt="VSCodium" /></a>
  <a href="https://github.com/the-long-ride/markdown-explorer/releases/latest"><img src="https://img.shields.io/badge/Windows-%E2%9C%93-ff9130?style=flat-square&logo=windows&logoColor=white&labelColor=000000" alt="Windows" /></a>
  <a href="https://github.com/the-long-ride/markdown-explorer/releases/latest"><img src="https://img.shields.io/badge/macOS-%E2%9C%93-ff9130?style=flat-square&logo=apple&logoColor=white&labelColor=000000" alt="macOS" /></a>
  <a href="https://github.com/the-long-ride/markdown-explorer/releases/latest"><img src="https://img.shields.io/badge/Linux-%E2%9C%93-ff9130?style=flat-square&logo=linux&logoColor=white&labelColor=000000" alt="Linux" /></a>
  <a href="https://the-long-ride.github.io/markdown-explorer/"><img src="https://img.shields.io/badge/Web%20App-%E2%9C%93-ff9130?style=flat-square&logo=googlechrome&logoColor=white&labelColor=000000" alt="Web App" /></a>
</p>
<p align="left">
  <a href="https://github.com/the-long-ride/markdown-explorer/releases/latest"><img src="https://img.shields.io/badge/Electron-%E2%9C%93-ff9130?style=flat-square&logo=electron&logoColor=white&labelColor=000000" alt="Electron" /></a>
  <a href="https://github.com/the-long-ride/markdown-explorer/releases/latest"><img src="https://img.shields.io/badge/Tauri-%E2%9C%93-ff9130?style=flat-square&logo=tauri&logoColor=white&labelColor=000000" alt="Tauri" /></a>
</p>

**A fast, private, open-source Markdown viewer and editor for local folders.**

**Markdown Explorer** turns `.md` and `.mdx` folders into a searchable workspace with split-view editing, Git diffs, offline Mermaid diagrams, LaTeX math, highlighted code, interactive tables and charts, document previews, and export — on the [Web App](https://the-long-ride.github.io/markdown-explorer/), VS Code, and desktop (Windows, Linux, [macOS](https://github.com/the-long-ride/markdown-explorer/blob/main/docs/macos-install.md)).

<p align="center">
  <a href="https://www.youtube.com/watch?v=44lXcn-hWe0">
    <img src="https://img.youtube.com/vi/44lXcn-hWe0/maxresdefault.jpg" width="900" alt="Watch the Markdown Explorer demo video on YouTube" />
  </a>
  <br />
  <a href="https://www.youtube.com/watch?v=44lXcn-hWe0">Watch the demo video on YouTube</a>
</p>

## Why It Feels Different

| Capability | Traditional Markdown Readers | Markdown Explorer |
| :--- | :--- | :--- |
| **Workspace Navigation** | Loose individual files; loses reading place. | File tree, TOC, Scope Focus, multi-workspace tabs, and scroll/heading memory for 100 recent files. |
| **Local Editing & Split View** | Read-only previews or separate editor windows. | Rendered, Inline Edit, and Plain modes with conflict-safe saves and two-pane synchronized split view. |
| **Local Git History & Diff** | Requires terminal or external Git GUI. | Read-only commit graph, snapshot browsing, file history, and Myers Source & Rendered Diffs. |
| **Insights & Wiki Links** | No link audits or knowledge graph. | Gallery, Link validator, Lint, Duplicates, Document Graph, `[[Wiki Links]]`, and `![[Transclusion]]`. |
| **Deep Search & Bookmarks** | Slow single-file string find only. | Streamed search (10,000 matches) across file, workspace, or all tabs with match jumps and source-anchored bookmarks. |
| **Interactive Tables & Charts** | Static tables and external spreadsheets. | Sortable/filterable CSV & TSV tables with column toggles and 9 instant chart types. |
| **Offline Diagrams & Media** | Cloud CDNs that break offline. | Offline theme-aware Mermaid diagrams, KaTeX math, 25+ code languages, HTML sandboxes, video, and zoomable media modal. |
| **Document Previews & Export** | Ignores Office/PDF files; basic print-to-PDF. | Opt-in local previews (DOCX, PDF, XLSX, PPTX, ODT, RTF, HTML, TXT) plus standalone HTML, ZIP site, and hybrid PDF exports. |
| **Privacy & Multi-Runtime** | Cloud telemetry or single-platform lock-in. | 100% local processing with zero telemetry across VS Code, Open VSX, Web App, Tauri, and Electron. |

## Installation

| Platform | Get It |
| --- | --- |
| VS Code | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer) |
| Open VSX | [Open VSX Registry](https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer) |
| Windows desktop | [Latest `.exe`](https://github.com/the-long-ride/markdown-explorer/releases/latest) (Tauri or Electron) |
| Linux desktop | [Latest `.AppImage` or `.deb`](https://github.com/the-long-ride/markdown-explorer/releases/latest) (Tauri or Electron) |
| macOS desktop | [Latest `.dmg` (arm64 / x64)](https://github.com/the-long-ride/markdown-explorer/releases/latest) · [macOS guide](https://github.com/the-long-ride/markdown-explorer/blob/main/docs/macos-install.md) |
| Web App | [Launch in Browser](https://the-long-ride.github.io/markdown-explorer/) (test workspace & local folders) |
| Stores | Microsoft Store and Ubuntu App Center publishing is prepared; use [GitHub Releases](https://github.com/the-long-ride/markdown-explorer/releases/latest) until store listings go live. |

## VS Code Extension Tutorial

Open a folder containing Markdown files and click the Markdown Explorer button in the workspace header, or use the Command Palette / context menus:

| Action | Command | Where | Win/Linux | macOS |
| --- | --- | --- | --- | --- |
| Open workspace viewer | `Markdown Explorer: Open Docs Viewer` | Explorer Header / Palette | `Ctrl+Shift+M` | `Cmd+Shift+M` |
| Toggle active file preview | `Markdown Explorer: Toggle Docs Viewer` | Editor Title / Palette | `Ctrl+Alt+V` | `Cmd+Alt+V` |
| Preview file | `Markdown Explorer: Preview This File` | File Context Menu | — | — |
| Open folder workspace | `Open Folder in Markdown Explorer` | Folder Context Menu | — | — |
| Refresh workspace | `Markdown Explorer: Refresh` | Webview Header / Palette | `R` | `R` |

> [!TIP]
> **Icon missing?** Run **Developer: Reload Window** in the Command Palette if the header icon does not appear after installing. Imported fonts stay in extension storage, and `Ctrl+Alt+E` / `Cmd+Alt+E` opens the source file in an editor tab.

## Features

<details>
<summary><b>Workspace Navigation & Organization</b></summary>

- **Workspaces & Views**: Open local folders, manage custom aliases, switch between multi-workspace **Tab View** and single-workspace **Focus View** (`Ctrl+Alt+T` / `Ctrl+Alt+F`), use content tabs and Scope Focus, and open files/folders via OS File Explorer or drag-and-drop.
- **Navigation & Hardware Parity**: Traverse relative workspace links (`/`, `./`, `../`) with back/forward history synced to Mouse Buttons 3/4 and `BrowserBack`/`BrowserForward`, plus standard macOS AppKit Edit menus.
- **Keyboard & Context Menus**: Highlight the active file (`Alt+Q`), navigate the sidebar tree via Cursor mode (`Alt+Z`), and use right-click menus on files, tabs, and workspaces.
- **Edit from preview**: Desktop keeps **Edit** in More actions (`Ctrl+E`), while VS Code exposes a dedicated Edit icon beside More actions (`Ctrl+Alt+E` / `Cmd+Alt+E`) to open the source in a normal editor tab (Web omits external-editor actions).
- **Scroll Memory & Live Scans**: Restores scroll positions and collapsed headings for up to 100 recent files per workspace, with cancellable batched scans and native filesystem auto-refresh.

</details>

<details>
<summary><b>Local Markdown Editing, Split View & Git History</b></summary>

- **Inline & Plain Editing**: Opt-in local editing in Rendered, Inline Edit, and Plain modes without external editor frameworks, backed by revision-guarded saves, Reload/Compare/Keep-mine conflict recovery, and dirty-copy guards.
- **Two-Pane Split View**: Open two documents side by side with independent modes, scroll positions, and isolated render revisions, plus 150 ms debounced preview mirroring when editing and viewing the same file.
- **Read-Only Git History & Diff**: View repository commit graphs with refs and `HEAD`, browse historical snapshots without `git checkout` (**Back to current HEAD** restores live state), and inspect Myers Source Diffs and Rendered Diffs across revisions or unsaved changes (local `git` on Desktop/VS Code; disabled on Web), localized in 9 languages. See [Local Git History and Diff](https://github.com/the-long-ride/markdown-explorer/blob/main/docs/git-history-diff.md) and [document-history comparison](https://github.com/the-long-ride/markdown-explorer/blob/main/docs/use-cases/compare-document-history.md).

</details>

<details>
<summary><b>Pin & Bookmarks</b></summary>

- **Sidebar Pinning & File Ops**: Pin files or folders to the root of the tree; create, rename (`F2` preserves tabs, buffers, bookmarks, pins, scope, and splits), and delete entries across native Trash, browser storage (`?mode=web`), and simulated `?mode=test` workspaces.
- **Source-Anchored Bookmarks**: Save highlights (text, math, Mermaid, images, links) that relocate across edits via source ranges and fingerprints, managed in a searchable sidebar tab with batch selection (`Ctrl+Shift+B` / `Alt+Shift+B`) across all 9 languages.

</details>

<details>
<summary><b>Export & Scope View</b></summary>

- **Export Center**: Export *Current document*, *Selected files*, *Folder*, or *Whole workspace* to **Standalone HTML**, **Static Website (ZIP)**, or hybrid client-side **PDF** (`pdfmake` + vector SVGs), in Document-only or interactive Full Explorer layouts with 100% offline local runtimes.
- **Scope View Modal**: Inspect linked documents in an isolated overlay with a bounded 10-step history stack (`MAX_SCOPE_DEPTH=10`), **Open file** navigation, link context menu (**Open as scope**), and keyboard/mouse history parity.

</details>

<details>
<summary><b>Document Previews & Rich Media</b></summary>

- **HTML Previews & Sandboxes**: View `.html`/`.htm` files as isolated previews or Markdown (`Ctrl+Alt+H`), use **Open in Browser**, and preview isolated HTML code-fence sandboxes.
- **Diagrams & Math**: KaTeX math and offline Mermaid diagrams. Mermaid diagrams render offline using the current Markdown Explorer theme with family-aware spacing and clean vector SVG output while keeping authored semantic colors intact. Switching theme or light/dark mode re-renders visible diagrams, and wide Gantt diagrams scroll before labels become unreadable.
- **Code, Callouts & Media**: GFM callout boxes, responsive image rows, 25+ syntax-highlighted languages with terminal fences (`bash`, `pwsh`, `sh`, `zsh`, `cmd`), local/YouTube video embeds, and a fullscreen zoomable media modal.

</details>

<details>
<summary><b>Data Tables & Charts</b></summary>

- **CSV and TSV Code Fences**: Turn delimited fences into sortable tables with delimiter detection, header inference, multi-select column filters, column visibility toggles, text wrap, and compact 1000+ row rendering.
- **9 Chart Types & Modal Viewer**: Convert numeric tables into Bar, Horizontal Bar, Line, Area, Scatter, Radar, Polar Area, Pie, or Doughnut charts with a 50%–1000% zoom/pan modal and PNG copy/native export.

</details>

<details>
<summary><b>Converted Document Previews</b></summary>

- **Opt-In Local Conversion**: Best-effort previews for DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, RTF, and TXT using in-process Rust adapters on Tauri or `@the-long-ride/markdown-them` on Electron and VS Code, cached by timestamp and file size. See [Native document conversion](https://github.com/the-long-ride/markdown-explorer/blob/main/docs/native-document-conversion.md).

</details>

<details>
<summary><b>Search & Discovery</b></summary>

- **Multi-Scope Streamed Search**: Search inside the current file, current workspace, or across all open desktop tabs — streaming up to 10,000 matches with stale-query cancellation, bounded rendering, and exact jump-to-match highlighting.

</details>

<details>
<summary><b>Workspace Insights & Wiki Links</b></summary>

- **Workspace Insights (`Ctrl+Alt+I`)**: Offline-first audit panel with Gallery, Links, Lint, Duplicates, Graph, and Related views.
- **Wiki Links & Transclusion**: Navigate `[[Note]]`, `[[Note#Heading]]`, `[[Note|Label]]`, `[[#Heading]]`, and relative Wiki Links, or embed targets via cycle-guarded `![[Note]]` transclusion.

</details>

<details>
<summary><b>Customization & Platform Support</b></summary>

- **Themes & Theme Remix**: Aurora Glass, Neon Voltage, Default, and pet theme families, plus custom theme creation, import, and export.
- **Settings, Shortcuts & Manual**: Categorized Settings sidebar, customizable keybindings, per-version update notifications, and a searchable 9-language User Manual with platform shortcut keycaps.
- **Typography**: Electron, Tauri, and VS Code support independent **App UI, Body, Heading, Quote, Code, and Mermaid** font bindings (`.ttf`/`.otf` or system fonts; Web uses IndexedDB + `FontFace`). Code defaults to JetBrains Mono, and updating the Mermaid font re-renders current diagrams.

</details>

<details>
<summary><b>Windows File Explorer Integration</b></summary>

- The Windows installer optionally adds desktop shortcuts plus **Open with Markdown Explorer** (`.md`/`.mdx`) and **Open Folder in Markdown Explorer** context menus (portable/ZIP builds leave File Explorer unchanged).

</details>

## Keyboard Shortcuts

Desktop shortcuts can be customized in Settings. VS Code keeps editor-friendly defaults inside the webview.

<details>
<summary><b>View Keyboard Shortcuts</b></summary>

| Action | Desktop app | VS Code extension | Web app |
| --- | --- | --- | --- |
| Open Markdown Explorer | N/A | `Ctrl+Shift+M` / `Cmd+Shift+M` | N/A |
| Toggle preview for current Markdown file | N/A | `Ctrl+Alt+V` / `Cmd+Alt+V` | N/A |
| Search current workspace | `Ctrl+F` | `Ctrl+K` / `Cmd+K` | `Ctrl+K` / `Cmd+K` |
| Search all open workspace tabs | `Ctrl+Shift+F` | `Ctrl+Shift+K` / `Cmd+Shift+K` | `Ctrl+Shift+K` / `Cmd+Shift+K` |
| Find in current file | `F` | `K` | `K` |
| Back to previous file | `Ctrl+ArrowLeft` or mouse back | `Ctrl+ArrowLeft` / `Cmd+ArrowLeft` or mouse back | `Ctrl+ArrowLeft` / `Cmd+ArrowLeft` or mouse back |
| Go to next file | `Ctrl+ArrowRight` or mouse forward | `Ctrl+ArrowRight` / `Cmd+ArrowRight` or mouse forward | `Ctrl+ArrowRight` / `Cmd+ArrowRight` or mouse forward |
| Go to welcome page | `Ctrl+H` | `Ctrl+H` / `Cmd+H` | `Ctrl+H` / `Cmd+H` |
| Open current document in external editor | `Ctrl+E` | `Ctrl+Alt+E` / `Cmd+Alt+E` | N/A |
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

</details>

## Privacy

- 100% local parsing, indexing, editing, diffing, search, and read-only Git history (`git` read operations only).
- Zero telemetry, analytics, or file uploads; MIT licensed open source.

## Links

- [Web App](https://the-long-ride.github.io/markdown-explorer/)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer)
- [Open VSX](https://open-vsx.org/extension/the-long-ride/vscode-extension-markdown-explorer)
- [Latest GitHub Release](https://github.com/the-long-ride/markdown-explorer/releases/latest)
- [Changelog](https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md)
- [Git History and Diff guide](https://github.com/the-long-ride/markdown-explorer/blob/main/docs/git-history-diff.md)
- [Issues](https://github.com/the-long-ride/markdown-explorer/issues)

## Report Issues

Check [existing issues](https://github.com/the-long-ride/markdown-explorer/issues) first, then include what helps reproduce the problem:

- **Title & environment**: concise summary, runtime (VS Code, Desktop, or Web), version, and OS.
- **Repro & sample**: minimal steps, expected vs. actual result, and a tiny `.md` sample, screenshot, or console log if relevant.

## License

Licensed under the [MIT License](https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE).

## Author

Built by [the-long-ride](https://github.com/the-long-ride). Star or share the repo if you find it useful!
