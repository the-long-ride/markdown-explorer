# Contributor & Development Guidelines

This document provides complete instructions for developers and contributors on setting up, debugging, packaging, and publishing the **Markdown Explorer** VS Code extension.

---

## 🎯 Mission of this Document
The mission of `GUIDELINE.md` is to maintain code quality, ease the onboarding flow for new developers, and define standard debugging and packaging practices to ensure that the extension remains lightweight, performant, and premium.

---

## 🛠️ Developer Environment Setup

### 1. Prerequisites
Ensure you have the following installed on your system:
* **Node.js**: Version `18.x` or higher is recommended.
* **npm**: Version `9.x` or higher.
* **Visual Studio Code**: The recommended IDE for developing this extension.

### 2. Getting Started
1. Clone the repository to your local machine.
2. Open the project folder in VS Code.
3. Install package dependencies:
   ```bash
   npm install
   ```

---

## 🐞 Run & Debug (F5 Workflow)

We have configured the project for one-click debugging. You do not need to compile files manually before launching.

1. Open the project in VS Code.
2. Press **`F5`** (or go to *Run and Debug* and select **Debug Extension**).
3. This triggers the pre-launch task **`watch`**, which compiles the TypeScript files in watch mode (`npm run watch`) in the background.
4. A new **Extension Development Host** VS Code instance will launch.
5. In this new instance, open any workspace folder containing `.md` files.
6. Open a markdown document and press `Ctrl+Shift+M` or `Ctrl+Alt+V` to open and test the Docs Viewer.

*Compilation output files and sourcemaps are written to the [out/](file:///f:/Extensions/omg/out/) folder.*

---

## 🏗️ Project Architecture & File Map

* **`src/`**: TypeScript Source Files (Runtime logic)
  * [extension.ts](file:///f:/Extensions/omg/src/extension.ts): Entrypoint. Registers commands and binds extension event listeners.
  * [core/panel.ts](file:///f:/Extensions/omg/src/core/panel.ts): Webview coordinator. Prepares templates, registers handlers, and communicates with the webview.
  * [core/scanner.ts](file:///f:/Extensions/omg/src/core/scanner.ts): Workspace file scanner.
  * [markdown/parser.ts](file:///f:/Extensions/omg/src/markdown/parser.ts): Custom tokenizer for headings, lists, tables, callouts, and pre code blocks.
  * [markdown/renderer.ts](file:///f:/Extensions/omg/src/markdown/renderer.ts): Renders tokens into HTML structure.
  * [markdown/highlighter.ts](file:///f:/Extensions/omg/src/markdown/highlighter.ts): Highlighter rules.
* **`media/`**: Webview Assets & Frontend Shell
  * [panel.html](file:///f:/Extensions/omg/media/panel.html): Static HTML template. Loads Highlight.js, Chart.js, and Mermaid libraries.
  * [panel.css](file:///f:/Extensions/omg/media/panel.css): Main stylesheet. Contains dark/light theme systems and Highlight.js style variables.
  * [logos/](file:///f:/Extensions/omg/media/logos/): Extension logos (`logo-128.png` and `logo-500.png`).
  * [icons/](file:///f:/Extensions/omg/media/icons/): VS Code workbench command icons.

---

## 📦 Packaging & Publishing

### 1. Compile & Package VSIX
To package the extension into a single redistributable `.vsix` installer, run:
```bash
npm run package
```
This script compiles the TS code and triggers the VS Code Extension Manager (`vsce`) to compile it. It respects [.vscodeignore](file:///f:/Extensions/omg/.vscodeignore) configurations, excluding test cases and source code files to build a lightweight VSIX binary under **85 KB**.

### 2. Publishing
To publish the package to the Visual Studio Code Marketplace:
1. Ensure your publisher details and version number in `package.json` are correct.
2. Run:
   ```bash
   npx vsce publish
   ```
3. Provide your Personal Access Token (PAT) for the marketplace.

---

## 💅 Styling and Code Conventions
* **Theme Support**: Any styling updates in `panel.css` must support dark theme, light theme, and auto-matching (`prefers-color-scheme`). Always map styling classes to custom theme tokens.
* **Hoisting/TDZ Risks**: Because the webview script in `panel.html` is parsed in the global scope, define block-scoped constructor objects (like `Table`) above other referencing scripts (like `UI`) to prevent Temporal Dead Zone failures.
* **VSIX Footprint**: Never check in large binary mockups or design screenshots without adding them to `.vscodeignore`. Keep the packaged binary small and clean.
