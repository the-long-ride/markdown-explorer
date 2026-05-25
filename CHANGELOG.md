# Changelog

All notable changes to the **Markdown Explorer** extension will be documented in this file.

---

## [1.2.0] — 2026-05-25

### Added Features & Enhancements

#### ⚛️ Interactive MDX Support

- **MDX Extension Support**: Added native rendering for `.mdx` files, automatically parsing React-like JSX syntax, components, and event handlers.
- **Import/Export Filtering**: Cleans up and strips MDX import and export statements during rendering so they do not clutter the document.
- **Stateful Custom Web Components**: Integrated three interactive web components out of the box: `<InteractiveCounter />` for custom count increments, `<ConfettiButton />` for custom celebration particle bursts, and slot-based `<InteractiveTabs />` for nested panels.

#### 🎛️ Sandboxed HTML Live Previews

- **Isolated iframe Executions**: HTML code blocks now render in a secure, isolated `iframe` environment that safely executes Javascript and custom styling without CSS leaks to the main viewport.
- **Code/Preview Toggle**: Effortlessly toggle between the live visual rendering and raw highlighted source code with a single header button.
- **Smart Height Scaling**: Automatically listens to the document size inside the iframe and dynamically scales its height to prevent unnecessary scrollbars.

#### 🔢 Code Block Line Numbers

- **Gutter Line Numbers**: Standardized code formatting across all programming language blocks by introducing clean, vertical line numbering.

#### 🎨 Multilingual Syntax Highlighting

- **14 New Languages**: Added robust syntax highlighting rules for C, C++, Java, C#, PHP, Ruby, Swift, Kotlin, R, Scala, Elixir, Dart, Hack, and Perl.
- **Embedded Style/Script Parsing**: Highlighted custom CSS style blocks and script logic nested within HTML code blocks.

#### ⚙️ Viewer Settings Panel

- **Persistent Configuration Overlay**: Click the new gear icon (`⚙️`) to open a configuration modal. Easily customize whether to show H1 title vs filename in the file tree, and choose whether HTML blocks default to preview or code view.

#### 🔄 Live Editor Buffers & Topbar Refresh

- **Live Buffer Reading**: WorkspaceScanner dynamically queries active `textDocuments` in memory, allowing Markdown Explorer to render unsaved edits instantly when navigating files.
- **Topbar Refresh Action**: Added a circular sync button on the right of the sidebar toggle button, styled to match the theme color via `fill="currentColor"` and using the new `refresh-icon.svg` asset, to manually trigger a workspace scan and file content reload.

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
