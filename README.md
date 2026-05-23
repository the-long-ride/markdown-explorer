# Markdown Explorer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/the-long-ride/vscode-extension-markdown-explorer/blob/main/LICENSE)
[![VSIX Version](https://img.shields.io/badge/version-1.0.0-purple.svg)](#)

**Markdown Explorer** is a high-performance VS Code extension that transforms your markdown documents into interactive, premium HTML documentation directly inside your editor. Navigate structure tree menus, search notes globally, expand/collapse sections, filter/sort tables like Excel, and switch numeric data straight into visual charts.

---

## ✨ Special Features

### 📁 Interactive Navigation Sidebar & Breadcrumbs

- **Fast Workspace Scanner**: Scans all workspace folders instantly and builds a sidebar tree mapping directories and markdown documents.
- **Filter/Search**: Quickly filter documents by typing in the sidebar filter input.
- **Breadcrumb Tooltip**: Hovering over breadcrumbs shows full workspace paths dynamically.

### 📋 Advanced Collapsible Sections

- **Auto-Grouped Headers**: Groups all markdown content under H1 and H2 headers into collapsible accordion elements.
- **TOC Panel**: Generates an interactive "On This Page" table of contents in the sidebar, clicking an item automatically auto-expands and scrolls the section smoothly.

### 📊 Smart Data Tables (Excel-like features)

- **Header Freeze**: Table headers stick/freeze to the top of the viewport when scrolling through long datasets.
- **funnel Category Filters**: Columns with recurring text entries get category filter dropdown buttons in their headers to filter datasets interactively.
- **Text Filtering**: Built-in row filter text input filters table content live.
- **Instant Row Sorting**: Clicking table headers sorts rows in ascending or descending alphanumeric order.

### 📈 Table-to-Chart Switcher

- **Auto-Detect Numeric Data**: Tables containing numeric series automatically show view-switcher controls.
- **Render Charts**: Switch from table view directly to interactive **Bar**, **Line**, or **Pie** charts. Charts respect active category filters and text queries dynamically.

### 🔍 Syntax Highlighting & Code Blocks

- **Premium Theme Contrast**: Specially tuned contrast in both dark and light modes. Comments, parameters, and symbols are highly legible.
- **TypeScript Property Separation**: Property names (purple) and type annotations (orange) render in distinct colors, eliminating color collision.
- **Nullable Properties**: Highlight.js handles optional/nullable properties (e.g. `email?: string;` or reserved keywords like `default?: string;`) correctly, coloring property keys as attributes.

### 🖼️ Zoomable Media & SVG Modal Viewer

- **Image Modal**: Clicking any image or SVG opens a gorgeous backdrop-blur modal.
- **Interactive Pan & Zoom**: Zoom in/out via wheel or click, pan around by dragging, and cycle through all page images using navigation buttons.

---

## 🚀 How to Use

1. **Open Markdown Explorer**: Press `Ctrl+Shift+M` (or `Cmd+Shift+M` on macOS) to open the Docs Viewer.
2. **Preview Current File**: Toggle preview mode on the active editor by clicking the search magnifying icon in the title bar or using the `Ctrl+Alt+V` keybinding.
3. **Double Click to Edit**: Clicking the **Edit** button in the top right of the topbar opens the raw markdown source editor.
4. **Search Globally**: Press `Ctrl+K` to search for document names across the workspace and navigate instantly.
5. **Toggle Layouts**: Toggle the sidebar view using the layout button to collapse/expand workspace files.

---

## 🔗 Important Links

- **Repository**: [github.com/the-long-ride/vscode-extension-markdown-explorer](https://github.com/the-long-ride/vscode-extension-markdown-explorer)
- **License**: [MIT License Link](https://github.com/the-long-ride/vscode-extension-markdown-explorer/blob/main/LICENSE)
- **Changelog**: [CHANGELOG.md Link](https://github.com/the-long-ride/vscode-extension-markdown-explorer/blob/main/CHANGELOG.md)
- **Contribution & Setup Guidelines**: [GUIDELINE.md Link](https://github.com/the-long-ride/vscode-extension-markdown-explorer/blob/main/GUIDELINE.md)
