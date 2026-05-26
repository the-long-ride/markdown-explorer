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
* **5-Tier Progressive Folding**: In [Topbar.tsx](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/components/Topbar/Topbar.tsx), format the relative path with a 5-tier progressive folding algorithm (Tier 1: full path, Tier 2: root/sub/.../parent/file, Tier 3: root/.../parent/file, Tier 4: .../parent/file, Tier 5: .../file...me.md) targeted to fit within a 45-character budget.
* **Ellipsis Truncation**: Wrap folder and file text nodes in `span.topbar__breadcrumb-part` and set `display`, `overflow`, `text-overflow`, and `white-space` with `!important` inside [global.css](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/styles/global.css) to enforce ellipsis truncation without parent box clips.
* **Viewport-Adaptive Tooltip**: Set the breadcrumb tooltip to `max-width: max(280px, calc(100vw - 340px))` in [global.css](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/styles/global.css) to scale with the viewport without overflowing, use zero-width spaces after slashes to break lines cleanly at slashes, and omit rendering on the Welcome Page.

---

## 🎨 2. Theme, Visual Contrast & Tooltips
* **Contrast Grays**: In [global.css](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/styles/global.css), maintain highly legible colors for light-theme variables:
  * `--tx2` (secondary text, labels) must have a contrast ratio of $\ge 4.5:1$ on light backgrounds (current: `#484854`).
  * `--txm` (metadata, placeholders, chevrons) must have a contrast ratio of $\ge 4.5:1$ on light backgrounds (current: `#666672`).
  * `--hl-cm` (code comments) must have a contrast ratio of $\ge 4.5:1$ on code blocks (current: `#5c6370`).
* **Settings Close Tooltip**: Ensure settings Close (`×`) button in [SettingsModal.tsx](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/components/Settings/SettingsModal.tsx) implements `.tooltip-container` and displays `"Close Settings [Esc]"` below on hover.
* **Modal Window Controls & Stacking**: The window controls/theme bar in `WorkspaceSelection.tsx` and `App.tsx` and the `.topbar` in `global.css` must have `z-index: 200000` to remain fully active and interactive above any modal backdrops (which have `z-index: 100000`).
* **Floating Close Buttons**: Floating close buttons (like `.mdn-modal-close` in `MediaModal.tsx`) must be positioned at `top: calc(var(--topbar-h) + 12px)` to prevent clashing/overlapping with the window control buttons.
* **Recent Workspaces List constraints**: The scrollable workspaces container in the search modal must show at most 5 items at the same time (using `max-height: 352px` and `overflow-y: auto`) and must explicitly set `overflow-x: hidden` to prevent a horizontal scrollbar.

---

## 🔍 3. Syntax Highlighting, Line Numbers & Code blocks
* **Properties vs. Types**: Ensure properties and types are styled differently:
  * `.hljs-property` and `.hljs-attr` must use `var(--hl-attr)`.
  * `.hljs-type` and `.hljs-built_in` must use `var(--hl-prop)`.
* **Important Enforcements**: Always append `!important` to all `.hljs-` override rules in [global.css](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/styles/global.css) to guarantee our theme is applied over default CDN styles.
* **Gutter Line Numbers**: When formatting code blocks, dynamic gutter line numbers are rendered in `.mdn-codeblock-gutter` to match standard IDE aesthetics, except for plain text blocks.
* **Multilingual Highlighting**: Support custom syntax rules for HTML, C, C++, Java, C#, PHP, Ruby, Swift, Kotlin, R, Scala, Elixir, Dart, Hack, and Perl. Embedded `<style>` and `<script>` elements inside HTML code blocks must be parsed and highlighted natively.
* **Clipboard Copying**: Register `UI.copyCode` and `UI_copyCode` globally to use `PlatformBridge.copyToClipboard` when available, with a fallback to `navigator.clipboard`.
* **Mermaid Auto-rendering**: Automatically detect un-tagged or plain text code blocks starting with any valid Mermaid diagram keyword and render them as actual Mermaid graphics. The full recognized keyword list is:
  * `graph`, `flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `stateDiagram-v2`, `erDiagram`, `journey`, `gantt`, `pie`, `quadrantChart`, `xychart-beta`, `mindmap`, `timeline`, `gitGraph`, `sankey-beta`, `block`, `block-beta`, `packet`, `packet-beta`, `kanban`, `architecture`, `architecture-beta`, `zenuml`, `requirementDiagram`, `info`, `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`.
  * Keep this list in sync with the `mermaidKeywords` array in [renderer.ts](file:///home/the-long-ride/workspace/markdown-explorer/vscode/src/markdown/renderer.ts).
* **Mermaid Keyword Casing**: C4 diagram keywords are PascalCase (`C4Context`, not `c4Diagram`). Architecture diagrams use `architecture-beta` (not `architecture`). Edge directions in `architecture-beta` use single uppercase letters (`L`, `R`, `T`, `B`).
* **ZenUML Registration**: ZenUML is NOT included in the core Mermaid package. It requires `@mermaid-js/mermaid-zenuml` installed as a dependency and must be registered via `mermaid.registerExternalDiagrams([zenuml])` inside [main.tsx](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/main.tsx) before `mermaid.initialize()` is called.
* **requirementDiagram Properties**: Valid properties are `id`, `text`, `risk` (`low`/`medium`/`high`), and `verifymethod` (`test`/`inspection`/`demonstration`/`analysis`). The property `severity` is not valid.
* **Collapsible Code Blocks**: For code blocks with more than 20 lines, render them as collapsed (`max-height: 380px` with a gradient fade) with a "Show More" / "Show Less" toggle button.
* **Inline Code Styling**: Style `.mdn-inline-code` representing backticks with a warm Claude-like orange color (`#ff7e40` in dark, `#d95420` in light), `0.88em` font size, and `2px 6px` padding.

---

## 🖼️ 4. Sticky Headers, Sections & Safe HTML
* **Sticky Table Headers**: Maintain `.mdn-th` vertical sticky alignment relative to the main viewport:
  * Configure `.mdn-table-scroll` with `overflow-x: auto; overflow-y: clip` in [global.css](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/styles/global.css) to prevent vertical scroll container capture.
  * Set collapsible `.mdn-section` overflow to `overflow: clip` so sticky targets propagate through sections without breaking parent corner rounded shapes.
* **Safe HTML Tags List**: When parsing inline markdown syntax in `vscode/src/markdown/renderer.ts`, structurally allow HTML tags (`img`, `p`, `div`, `span`, `a`, `h[1-6]`, `details`, `summary`, `strong`, `em`, `code`, `pre`, `hr`) to support raw embedded HTML rendering.
* **MDX Components & JSX**: When rendering `.mdx` files, imports/exports must be stripped from the body, and PascalCase component names (e.g., `<InteractiveCounter />`) must be matched and translated to custom elements (kebab-case) with their curly-braced properties mapped to attributes.

---

## 🔗 5. Robust Document Navigation & Monorepo Operations
* **Workspace Selection button**: Ensure "Open Folder" button in [WorkspaceSelection.tsx](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/components/Workspace/WorkspaceSelection.tsx) has `height: 'auto'` inline style to bypass base `.btn` bounds and padding squishing.
* **Live Editor Buffers Check**: When reading file content or extracting titles in `WorkspaceScanner`, check `vscode.workspace.textDocuments` first to retrieve the active, unsaved editor contents before falling back to `fs.readFileSync` from disk.
* **Platform Font Routing**:
  * Prioritize system/VS Code default fonts inside `:root` of [tokens.css](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/styles/tokens.css).
  * Assign local *Be Vietnam Pro* and *Cascadia Code* font tokens exclusively under `body.is-electron` selector.
  * Exclude `.ttf` font files inside [vscode/.vscodeignore](file:///home/the-long-ride/workspace/markdown-explorer/vscode/.vscodeignore) so the VS Code extension webviews inherit user settings, while the desktop app retains fully featured offline fonts!

---

## 📦 6. Minimal VSIX Footprint
* **Resource Exclusion**: The packaged VSIX binary size **MUST** remain under **180 KB** (current optimized size is ~173 KB).
* **vscodeignore Audits**: Any new development files, test scripts, or raw asset folders (like fonts) must be appended to [.vscodeignore](file:///home/the-long-ride/workspace/markdown-explorer/vscode/.vscodeignore) so they are never bundled into the VSIX.
* **Keep source code out**: Never package `src/` or `test/`. Only `out/` and necessary compiled assets inside `ui/dist` are allowed.

---

## 🧪 7. Verification Checklist
Before completing your turn, you must run:
1. `npm run compile`: Verify there are no TypeScript syntax or type compilation errors.
2. `npm run package`: Verify that the VSIX packages successfully, does not contain ignored files, and remains under **180 KB**.

---

## 📖 8. Readme & Changelog Synchronization
* **Sync Documentation**: Whenever modifying the root `README.md` or `CHANGELOG.md` (e.g. updating roadmap or version changelogs), you **MUST** synchronize these changes to the VS Code sub-project's documentation files under `./vscode` (specifically `vscode/README.md` and `vscode/CHANGELOG.md`) to maintain documentation parity.

---

## 📝 9. Safe Split Multiple Commits
* **Commit Splitting**: When preparing changes to commit, you **MUST** split them into separate, logical, atomic commits (e.g. separate commits for configuration updates, feature implementation, and documentation/version bumps) rather than squashing everything into a single massive commit.

---

## 🎯 10. User Selection in Webview
* **Default Selection Lock Override**: VS Code webviews globally disable text selection (`user-select: none`). To allow document content to be selectable, set `user-select: text; -webkit-user-select: text;` on `html, body` at the top of [global.css](file:///home/the-long-ride/workspace/markdown-explorer/ui/src/styles/global.css).
* **Interactive Element Containment**: Elements that should not be selectable during click/drag must explicitly set `user-select: none; -webkit-user-select: none;`. These include: `.topbar`, `.btn`, `.window-control-btn`, `.sidebar`, `.tree-folder`, `.tree-file`, `.sidebar-resize`.
* **Section Title Selectability**: Collapsible section headers (`.mdn-section-header`) carry `user-select: none` for click-to-collapse. However, the title text inside (`.mdn-section-title`) must explicitly set `user-select: text; -webkit-user-select: text;` so users can copy heading text.
* **Input Fields**: Always ensure input/search boxes (`.search-bar input`, `.sidebar__search input`) set `user-select: text; -webkit-user-select: text;` to allow text selection and cursor interaction.

---

## 🚀 11. "Good Version" Release Workflow
When the user says **"good version"**, perform the following steps in order:

1. **Bump version**: Increment the **patch** number only (e.g. `1.3.5` → `1.3.6`). Update `version` in:
   - `vscode/package.json`
   - `ui/package.json`
   - `desktop/package.json`
2. **Update CHANGELOG.md** (root): Add a new `## [x.x.x] — YYYY-MM-DD` section at the top describing all changes since the last version.
3. **Sync documentation**: Copy the updated root `CHANGELOG.md` to `vscode/CHANGELOG.md` and root `README.md` to `vscode/README.md`.
4. **Update agent rules & docs**: Update `.agent/rules.md` and any relevant `.agent/*.md` knowledge base files to reflect new patterns learned.
5. **Safe split commits**: Stage and commit in logical atomic groups, for example:
   - `feat: ...` / `fix: ...` — for source code changes
   - `chore: bump version to x.x.x and update changelogs/documentation`
6. **Create and push git tag**: `git tag vx.x.x && git push && git push --tags`
