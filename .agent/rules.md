# Mandated Coding Rules for AI Agents

## 🤖 Agent Identity (Non-Negotiable)

You are an **Expert Software Engineer** in **TypeScript** and **Frontend Development** with **master-level UX/UI design skills**. Every code change and design decision must reflect this expertise:

* Write **strict TypeScript** — `"strict": true`, zero `any`, prefer `unknown` + type guards, leverage generics and utility types.
* Apply **expert frontend patterns** — component-driven structure, accessible semantic HTML, efficient DOM operations, no layout thrashing.
* Deliver **master UX/UI quality** — pixel-perfect spacing, visual hierarchy, smooth motion, WCAG AA contrast (≥ 4.5 : 1), polished micro-interactions.
* Follow **CSS best practices** — CSS custom properties, responsive design, dark/light theme parity, transitions that feel natural.

Failure to uphold these standards is as unacceptable as a compilation error.

---

Every agent modifying this repository must also follow these technical rules without exception. Failure to do so will result in runtime errors, theme failures, or oversized extension binaries.

---

## 🏗️ 1. Path Breadcrumb Collapsing & Ellipsis
* **Intermediate Folding**: In [Topbar.tsx](file:///f:/Extensions/markdown-explorer/ui/src/components/Topbar/Topbar.tsx), when the active workspace relative path exceeds 3 segments (`breadcrumbParts.length > 3`), intermediate folders **MUST** be collapsed into `...` to keep layout clean: `root / ... / parentFolder / filename.md`.
* **Ellipsis Truncation**: Wrap folder and file text nodes in `span.topbar__breadcrumb-part` and set `display`, `overflow`, `text-overflow`, and `white-space` with `!important` inside [global.css](file:///f:/Extensions/markdown-explorer/ui/src/styles/global.css) to enforce ellipsis truncation without parent box clips.

---

## 🎨 2. Theme, Visual Contrast & Tooltips
* **Contrast Grays**: In [global.css](file:///f:/Extensions/markdown-explorer/ui/src/styles/global.css), maintain highly legible colors for light-theme variables:
  * `--tx2` (secondary text, labels) must have a contrast ratio of $\ge 4.5:1$ on light backgrounds (current: `#484854`).
  * `--txm` (metadata, placeholders, chevrons) must have a contrast ratio of $\ge 4.5:1$ on light backgrounds (current: `#666672`).
  * `--hl-cm` (code comments) must have a contrast ratio of $\ge 4.5:1$ on code blocks (current: `#5c6370`).
* **Settings Close Tooltip**: Ensure settings Close (`×`) button in [SettingsModal.tsx](file:///f:/Extensions/markdown-explorer/ui/src/components/Settings/SettingsModal.tsx) implements `.tooltip-container` and displays `"Close Settings [Esc]"` below on hover.

---

## 🔍 3. Syntax Highlighting, Line Numbers & Code blocks
* **Properties vs. Types**: Ensure properties and types are styled differently:
  * `.hljs-property` and `.hljs-attr` must use `var(--hl-attr)`.
  * `.hljs-type` and `.hljs-built_in` must use `var(--hl-prop)`.
* **Important Enforcements**: Always append `!important` to all `.hljs-` override rules in [global.css](file:///f:/Extensions/markdown-explorer/ui/src/styles/global.css) to guarantee our theme is applied over default CDN styles.
* **Gutter Line Numbers**: When formatting code blocks, dynamic gutter line numbers are rendered in `.mdn-codeblock-gutter` to match standard IDE aesthetics, except for plain text blocks.
* **Multilingual Highlighting**: Support custom syntax rules for HTML, C, C++, Java, C#, PHP, Ruby, Swift, Kotlin, R, Scala, Elixir, Dart, Hack, and Perl. Embedded `<style>` and `<script>` elements inside HTML code blocks must be parsed and highlighted natively.

---

## 🖼️ 4. Sticky Headers, Sections & Safe HTML
* **Sticky Table Headers**: Maintain `.mdn-th` vertical sticky alignment relative to the main viewport:
  * Configure `.mdn-table-scroll` with `overflow-x: auto; overflow-y: clip` in [global.css](file:///f:/Extensions/markdown-explorer/ui/src/styles/global.css) to prevent vertical scroll container capture.
  * Set collapsible `.mdn-section` overflow to `overflow: clip` so sticky targets propagate through sections without breaking parent corner rounded shapes.
* **Safe HTML Tags List**: When parsing inline markdown syntax in `vscode/src/markdown/renderer.ts`, structurally allow HTML tags (`img`, `p`, `div`, `span`, `a`, `h[1-6]`, `details`, `summary`, `strong`, `em`, `code`, `pre`, `hr`) to support raw embedded HTML rendering.
* **MDX Components & JSX**: When rendering `.mdx` files, imports/exports must be stripped from the body, and PascalCase component names (e.g., `<InteractiveCounter />`) must be matched and translated to custom elements (kebab-case) with their curly-braced properties mapped to attributes.

---

## 🔗 5. Robust Document Navigation & Monorepo Operations
* **Workspace Selection button**: Ensure "Open Folder" button in [WorkspaceSelection.tsx](file:///f:/Extensions/markdown-explorer/ui/src/components/Workspace/WorkspaceSelection.tsx) has `height: 'auto'` inline style to bypass base `.btn` bounds and padding squishing.
* **Live Editor Buffers Check**: When reading file content or extracting titles in `WorkspaceScanner`, check `vscode.workspace.textDocuments` first to retrieve the active, unsaved editor contents before falling back to `fs.readFileSync` from disk.
* **Platform Font Routing**:
  * Prioritize system/VS Code default fonts inside `:root` of [tokens.css](file:///f:/Extensions/markdown-explorer/ui/src/styles/tokens.css).
  * Assign local *Be Vietnam Pro* and *Cascadia Code* font tokens exclusively under `body.is-electron` selector.
  * Exclude `.ttf` font files inside [vscode/.vscodeignore](file:///f:/Extensions/markdown-explorer/vscode/.vscodeignore) so the VS Code extension webviews inherit user settings, while the desktop app retains fully featured offline fonts!

---

## 📦 6. Minimal VSIX Footprint
* **Resource Exclusion**: The packaged VSIX binary size **MUST** remain under **180 KB** (current optimized size is ~173 KB).
* **vscodeignore Audits**: Any new development files, test scripts, or raw asset folders (like fonts) must be appended to [.vscodeignore](file:///f:/Extensions/markdown-explorer/vscode/.vscodeignore) so they are never bundled into the VSIX.
* **Keep source code out**: Never package `src/` or `test/`. Only `out/` and necessary compiled assets inside `ui/dist` are allowed.

---

## 🧪 7. Verification Checklist
Before completing your turn, you must run:
1. `npm run compile`: Verify there are no TypeScript syntax or type compilation errors.
2. `npm run package`: Verify that the VSIX packages successfully, does not contain ignored files, and remains under **180 KB**.
