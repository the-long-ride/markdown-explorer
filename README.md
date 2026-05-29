# Markdown Explorer 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Install-blueviolet.svg)](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer)
[![Latest Release - Download](https://img.shields.io/github/v/release/the-long-ride/markdown-explorer?color=orange&label=Latest%20Release)](https://github.com/the-long-ride/markdown-explorer/releases/latest)

Markdown files are built for AI agents, but **Markdown Explorer** is made for humans. 

Tired of reading raw Markdown files or plain, boring previews? Markdown Explorer transforms your markdown documents into a premium, interactive web-app experience. Use it directly inside VS Code or as a standalone desktop app (available for Windows, Linux and [macOS](docs/macos-install.md)).

![Markdown Explorer Overview](https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Workspace-overview-desktop.png)

---

## 🌟 Key Features

### 📁 Sidebar Navigation Tree
Instantly scans your workspace to build an interactive folder tree. Browse your documentation with ease.
<img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/navigation-support.png" width="800" alt="Sidebar Navigation" />

### 🔍 Instant Global Search (`Ctrl+K`)
Find any document in milliseconds via a quick-search overlay.
<img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/quick-searching.png" width="800" alt="Global Search" />

### 🗂️ Desktop Workspace Tabs
Open multiple folders in the desktop app, switch between workspace tabs, rename tabs, and search across every open tab with `Ctrl+Shift+K`.

### 📋 Interactive Tables & Charts
- **Funnel Filters**: Filter columns by values instantly.
- **Header Sorting**: Sort data ascending or descending.
- **Charts**: Turn data tables into interactive Bar, Line, or Pie charts with one click.
<p float="left">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/datatable-reading-more-comfortable.png" width="49%" alt="Interactive Tables" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/see-datatable-as-common-chart-type.png" width="49%" alt="Charts Switcher" />
</p>

### 🎨 High-Contrast Code Highlighting & Mermaid Diagrams
- **Clean Syntax Styling**: Clear colors separating variables, properties, and types.
- **Mermaid Vector SVG**: Native, offline rendering for workflows and diagrams.
<p float="left">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/support-code-block.png" width="49%" alt="Code Syntax Highlighting" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/mermaid-chart.png" width="49%" alt="Mermaid Chart" />
</p>

### 🖼️ Zoomable Backdrop Media Modal
Zoom in/out with the mouse wheel and drag to pan across high-res graphics smoothly.
<img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/image-modal.png" width="800" alt="Image Viewer" />

### 🎛️ Isolated HTML Sandboxes & Custom MDX
- Run HTML/CSS/JavaScript safely in isolated iframes.
- Renders `.mdx` files with stateful custom elements like counters and tabs.
<p float="left">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/HTML-interactive_1.png" width="32%" alt="HTML Sandbox" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/HTML-interactive_2.png" width="32%" alt="Sandbox Script Execution" />
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/HTML-interactive_3.png" width="32%" alt="Toggle Source Code" />
</p>

### 🖥️ Standalone Desktop App
Explore workspaces offline without running VS Code. Manage your recently opened workspaces easily. Fully supported on Windows (Portable), Linux (deb & AppImage formats), and [macOS](docs/macos-install.md) (dmg & zip, Intel + Apple Silicon).
<img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/Desktop-app-workspace-selection.png" width="800" alt="Workspace Selection" />

### ⌨️ Customizable Keyboard Shortcuts
Configure and rebind keyboard triggers to match your own layout preferences.
<img src="https://raw.githubusercontent.com/the-long-ride/markdown-explorer/main/media/demo/More-keyboard-shortcut.png" width="800" alt="Custom Keybindings" />

### 🐾 Anime Pet Themes
Choose cute transparent-background pet artwork, including White Shiba, Shiba, Black Shiba, K-Ink, Cat, Hamster, and Corgi themes.

---

## 🚀 How to Get Started

### VS Code Extension:
1. Search for **Markdown Explorer** on the Marketplace and click **Install**.
2. Press `Ctrl+Shift+M` (or `Cmd+Shift+M` on macOS) to launch the workspace viewer.
3. Toggle the view on any open markdown file using `Ctrl+Alt+V` (or `Cmd+Alt+V`).

### Standalone Desktop App:
- **Windows**: Download the portable `.exe` from the latest GitHub Release and run it. No installation needed.
- **Linux**: Download the `.deb` or `.AppImage` package from the latest GitHub Release.
- **[macOS](docs/macos-install.md)**: Download the `.dmg` for your chip (`arm64` for Apple Silicon, `x64` for Intel). See the [macOS Installation Guide](docs/macos-install.md) for first-launch steps (Gatekeeper bypass).

---

## 🔒 100% Offline & Private
- **Zero Telemetry**: We don't collect, track, or upload any analytics, usage metrics, or file content.
- **100% Local**: All markdown parsing, indexing, and visualization are done entirely on your machine.

---

## 🗺️ Roadmap 

* **📥 Drag & Drop Opening**: Drop a folder or markdown file into the app window to inspect it instantly.

---

## 🔗 Links
- **VS Code Marketplace**: [Install Extension](https://marketplace.visualstudio.com/items?itemName=the-long-ride.vscode-extension-markdown-explorer)
- **GitHub Repository**: [github.com/the-long-ride/markdown-explorer](https://github.com/the-long-ride/markdown-explorer)
- **Release Logs**: [CHANGELOG.md](https://github.com/the-long-ride/markdown-explorer/blob/main/CHANGELOG.md)
- **License**: [MIT](https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE)

## 🐞 Report Issues & Get Help

Before opening a new issue on GitHub, please check whether the issue already exists in the repository's Issues page. This helps avoid duplicates and lets us respond faster.

If you do need to open a new issue, please include the following to help us triage and fix the problem quickly:

- **Search first**: Check https://github.com/the-long-ride/markdown-explorer/issues to see if your problem is already reported.
- **Short, descriptive title**: One line summary of the problem or requested feature.
- **Steps to reproduce**: Exact steps you took (files used, buttons clicked, commands run).
- **Expected vs actual behavior**: What you expected to happen and what actually happened.
- **Environment details**: OS (Linux/Windows/macOS), app version or extension version, and whether you used the VS Code extension or Desktop app.
- **Screenshots / minimal sample files**: Attach a screenshot or a small markdown file that reproduces the issue when possible.
- **Console logs / errors**: Any relevant error messages from the developer console or the app logs.

We appreciate clear, reproducible reports — they help us fix bugs and improve the product faster. Thank you for helping improve Markdown Explorer!
