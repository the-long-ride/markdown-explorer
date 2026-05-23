# Changelog

All notable changes to the **Markdown Explorer** extension will be documented in this file.

---

## [1.1.1] — 2026-05-24

### Added Features & Enhancements

#### 🚀 Immediate Activity Bar Launch

- **Instant Opening**: Clicking the Markdown Explorer icon in the activity bar now immediately launches the main webview panel in the editor area, automatically skipping and closing the primary sidebar view.

#### 🎛️ Consolidated Title Actions

- **Single Toggle Button**: Consolidated the editor toolbar buttons by removing the duplicate preview button, displaying a single Markdown Explorer toggle icon in the editor title bar.

#### ⌨️ Shortcut Documentation

- **Launch Keys Info**: Added clear keyboard shortcut documentation (`Ctrl+Shift+M` or `Cmd+Shift+M` on macOS) to both the Welcome page and the README.md to help users trigger the explorer easily.

#### 🖼️ Raw HTML Image & Layout Support

- **Safe HTML Rendering**: Enabled parsing of standard formatting, layout, and image tags (`<img>`, `<p>`, `<div>`, etc.), allowing raw HTML images to render styled and open in the fullscreen zoom modal perfectly.

#### 🔗 Robust Document Link Navigation

- **Space & Path Resolving**: Decodes URL encoded relative paths (such as `%20` for spaces) and dynamically resolves base paths and checks file existence on disk via `fs.existsSync` to prevent loading lockups or "File not found" pages.

#### 📜 MIT License Link

- **Welcome Page License**: Included a direct link to the repository's MIT License on GitHub in the Welcome Page subtitle.

---

## [1.1.0] — 2026-05-23

### Added Features & Enhancements

#### 🏠 Welcome Page & Home Button

- **Offline-First Welcome Page**: Introduced a Welcome page displaying project repository links, author details, usage guidelines, and a strict privacy pledge (100% offline use, zero tracking, and no external tracking libraries).
- **Topbar Home Button**: Integrated a theme-matching Home button (`| ⌂`) using the `homepage-icon.svg` asset. Clicking it navigates back to the Welcome page.
- **Edit Button Disablement**: Automatically disables the topbar "Edit" button when on the Welcome page.

#### 📁 Left Activity Bar Sidebar Icon

- **Sidebar Integration**: Contributed a custom view container to the left activity bar using the `markdown-manifier-light.svg` icon. Selecting it immediately opens or reveals the Markdown Explorer.

#### ⌨️ Toggle Keybinding & Documentation

- **Keybinding Documentation**: Explicitly documented the `Ctrl+Alt+V` (or `Cmd+Alt+V` on macOS) keybinding to toggle the Markdown Explorer preview.
- **Privacy Section**: Added a dedicated privacy, security, and offline-first section to the README.

### Fixed Issues

- **Packaging Fix**: Resolved an issue where compiled JavaScript files in the `out/` folder were excluded from the VSIX due to `.gitignore` rules. Added `!out/**` to `.vscodeignore` to guarantee all compiled code is packaged.

---

## [1.0.0] — 2026-05-23

This is the initial release of the Markdown Explorer extension.

### Implemented Features

#### 📁 Navigation & Workspace

- **Workspace Directory Tree**: Automated scanning of active workspace folders and building a sidebar navigation menu for files.
- **Fast Search**: Press `Ctrl+K` to open a global search popover to quickly search and switch between markdown notes.
- **Breadcrumb Tooltip**: breadcrumbs in the header dynamically display the file's workspace folder path on hover.

#### 📝 Collapsible Sections & Table of Contents (TOC)

- **Collapsible Header Sections**: H1 and H2 markdown headers automatically group consecutive tokens into collapsible accordion elements.
- **Interactive TOC Panel**: Generates a smooth-scroll "On This Page" panel to jump directly to document sections.

#### 📊 Smart Tables & Live Charts

- **Sticky Table Headers**: Freezes the row headers to the top of the scrolling viewport (similar to Excel freeze panes).
- **Funnel Category Filter Dropdowns**: Scans table columns for recurring categorical values and creates a funnel icon to filter cell contents.
- **Live Text Queries**: Standard table search bar for filtering rows in real-time.
- **Dynamic Table-to-Chart Conversion**: Autodetects numeric columns and renders **Bar**, **Line**, or **Pie** charts using Chart.js.

#### 🎨 Premium Styles & Light Theme Legibility

- **High Contrast Syntax Highlighting**: Specially tuned contrast for light-theme systems, making comments, punctuation, variables, and parameters readable.
- **TypeScript Member Separated Colors**: Colors property keys (purple) and type annotations (orange) differently to separate types from properties.
- **Nullable Properties Highlights**: Custom post-processor highlights TypeScript nullable/optional keys (`key?: type`), including reserved keywords (e.g. `default?:`).
- **Extension Logo**: Implemented custom rounded-square purple logo (`logo-128.png` in topbar and `logo-500.png` in marketplace) and resolved SVG theme-colors.

#### 🖼️ Image and Diagram Modals

- **Zoomable Media Viewer**: Backdrop-blurred fullscreen overlay to view screenshots, images, and SVGs.
- **Drag-to-Pan & Scale**: Mouse wheel zooming and click-and-drag panning.

#### 📦 Optimized Package Size

- **vscodeignore Configuration**: Configured strict ignore rules, compressing the extension binaries down to a lightweight **84.7 KB**.
