# Cross-Runtime Interactive Export Runtime and Windows Shell UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Electron-specific export/PDF path with one shared, offline, feature-driven export runtime that preserves Markdown Explorer theme/interactions across HTML, Static Website, and hybrid PDF output; expand Export Center scope/selection UX; and add a deterministic Windows file-context action that opens a clicked Markdown file inside its parent-folder workspace.

**Architecture:** Keep source resolution, enhanced document snapshots, feature detection, asset graph construction, HTML/site composition, and PDF composition in shared UI/export modules. Runtime hosts expose only workspace-contained binary resource access and artifact-save adapters. HTML output uses small feature-specific local runtime bundles. PDF is composed client-side with lazy-loaded `pdfmake`, keeping normal text semantic/selectable and representing complex blocks as SVG/image nodes. Windows shell launch intent becomes a structured external-open request rather than an overloaded path string.

**Tech Stack:** React 19, TypeScript 5.8, Vite 8, Chart.js 4.5, existing Mermaid/KaTeX/highlight.js enhancement pipeline, `pdfmake@^0.3.11`, Electron, Tauri/Rust, VS Code extension APIs, Chromium File System Access API, Vitest/Testing Library, Node contract tests, Cargo tests.

**Spec:** `docs/superpowers/specs/2026-08-19-export-runtime-interactive-html-shell-ux-design.md`

## Global Constraints

- Preserve existing HTML, PDF, and Static Website formats; do not add DOCX/EPUB.
- Preserve Document-only / Full Explorer layout and separate / merged batch semantics unless a format makes an option inapplicable.
- Whole workspace means every renderable document in `state.fileList`, recursively and independently of current Explorer filtering.
- Additional workspace files are explicit opt-in resources for HTML and Static Website only. They never apply to PDF and never implicitly turn Whole workspace into a repository archive.
- Exported HTML/site output must work fully offline with zero CDN dependency.
- Only feature/runtime bundles actually required by the exported pages may be shipped.
- User-authored HTML preview JavaScript remains executable only in its isolated, network-blocked preview sandbox for HTML/site output.
- HTML preview blocks auto-fit their full rendered height. The outer exported page owns normal vertical scrolling.
- PDF keeps ordinary textual content selectable/searchable and uses SVG/image capture only for complex visual blocks.
- PDF generation must work in Electron, Tauri, VS Code, and Chromium without a system Print Center.
- Remove the PDF footer feature completely: no option, no protocol fields, no native footer template, no tests that preserve it.
- Cross-runtime binary resource reads must canonicalize/contain paths inside the active workspace. Do not surface `.git` in the Additional files picker by default.
- Missing automatically referenced assets produce document-level warnings; missing explicitly selected extras fail packaging.
- Large export jobs use bounded concurrency rather than `Promise.all` over the whole workspace.
- Preserve the current collision-safe portable output-path encoding.
- Keep production file-size contracts: `.ts/.tsx <= 400`, `.css <= 500`, `.js <= 350`, `.rs <= 350` lines. Split responsibilities rather than growing `ExportCenterModal.tsx`.
- Register every new production module/component in the coverage manifest with meaningful tests.
- Each implementation task below is test-first and should end in a focused commit before moving on.

---

## File Structure

New/major shared export modules:

```text
ui/src/export/
  exportModel.ts                  # extend job/source model
  exportSnapshot.ts               # enhanced offscreen snapshots + feature detection
  exportTheme.ts                  # portable theme snapshot
  exportResources.ts              # typed binary-resource bridge helpers
  exportAssets.ts                 # referenced/extra asset graph
  exportRuntimeAssets.ts          # load feature bundle text + union manifests
  exportSite.ts                   # HTML package/static-site assembly
  exportSave.ts                   # runtime-independent save adapter facade
  exportJobRunner.ts              # bounded orchestration + activity events
  pdf/
    pdfModel.ts                   # local PDF model/types
    pdfSemantic.ts                # DOM -> semantic pdfmake nodes
    pdfVisualCapture.ts           # SVG/canvas/static-preview capture
    pdfFonts.ts                   # optional exportable-font registration/fallback
    pdfComposer.ts                # pdfmake loading/composition/buffer output
  runtime/
    entry-core.ts                 # copy/collapse portable handlers
    entry-html-preview.ts         # exported preview resize bridge handling
    entry-media.ts                # image/Mermaid SVG modal viewer
    entry-table.ts                # portable table interactions
    entry-charts.ts               # Chart.js + chart modal/table-chart behavior
ui/scripts/
  build-export-runtime.mjs        # deterministic per-feature IIFE builds
```

New/major Export Center UI modules:

```text
ui/src/components/shared/SearchableSelect.tsx
ui/src/components/Export/exportSelectionModel.ts
ui/src/components/Export/ExportMultiSelect.tsx
ui/src/components/Export/ExportAdditionalFilesPanel.tsx
ui/src/components/Export/ExportCenterSourcePanel.tsx
ui/src/components/Export/ExportCenterModal.tsx
ui/src/styles/global/global-export-center.css
ui/src/styles/global/global-export-selectors.css   # create if needed to keep CSS contract
```

Runtime resource/save adapters:

```text
electron/core/runtime-export-resources.js
vscode/src/core/panelExportResources.ts
tauri/src/runtime/export_resources.rs
chromium-xtension/src/chrome-host-export.ts
```

Windows external-open files:

```text
electron/core/external-open.js
electron/main.js
electron/core/main-bootstrap.js
electron/build/installer.nsh
tauri/src/runtime/external_open.rs
tauri/src/core/bootstrap.rs
tauri/src/app_state.rs
tauri/src/host_message.rs
tauri/windows/explorer-hooks.nsh
ui/src/types/hostMessages.ts
ui/src/hooks/useDesktopTabSearchSync.ts
```

The existing `ui/src/export/exportHtml.ts` remains the public HTML composition/path helper but should shed theme capture, binary resource handling, and site packaging into the focused modules above.

---

## Task 1: Expand the export model and pure source-selection semantics

**Files:**
- Modify: `ui/src/export/exportModel.ts`
- Create: `ui/src/components/Export/exportSelectionModel.ts`
- Modify: `tests/unit/ui/export/export-model.test.ts`
- Create: `tests/unit/ui/export/export-selection-model.test.ts`
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Add failing model tests for Whole workspace and explicit extras.**

Add assertions that the source-mode union accepts `workspace`, `buildExportJob` preserves sorted/deduplicated document files, and explicit extras are stored separately from document files and rejected for PDF.

Representative job shape:

```ts
export interface ExportJob {
  format: ExportFormat;
  layout: ExportLayout;
  batchMode: ExportBatchMode;
  files: MdFile[];
  extraResourcePaths: string[];
}
```

Test that:

```ts
buildExportJob({
  format: 'html',
  layout: 'document',
  batchMode: 'separate',
  files: [files[1], files[0]],
  extraResourcePaths: ['examples/demo.json', 'downloads/reference.pdf'],
}).extraResourcePaths
```

is normalized, deduplicated, and sorted, while the same extras passed to `format: 'pdf'` are omitted/rejected according to one explicit model rule. Prefer rejecting non-empty PDF extras so invalid state cannot reach the runner.

- [ ] **Step 2: Run the focused model test and confirm it fails.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-model.test.ts
```

Expected: failure because `workspace`/`extraResourcePaths` are not modeled yet.

- [ ] **Step 3: Implement the minimal model changes.**

Use:

```ts
export type ExportSourceMode = 'current' | 'selected' | 'folder' | 'workspace';
```

Keep `files` as the resolved renderable-document list. Keep extras as workspace-relative resource paths, never mixed into `MdFile[]`.

- [ ] **Step 4: Add failing filtered bulk-selection tests.**

Create `setFilteredSelection` with the contract:

```ts
export function setFilteredSelection(
  current: ReadonlySet<string>,
  visible: readonly string[],
  selected: boolean,
): Set<string>
```

Tests must prove that selecting/unselecting while search is active changes only `visible`, preserving selections outside the filter.

- [ ] **Step 5: Run and then implement the pure selection helper.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-selection-model.test.ts
```

Implement the helper without React state or DOM dependencies.

- [ ] **Step 6: Register coverage and rerun both tests.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-model.test.ts tests/unit/ui/export/export-selection-model.test.ts
```

- [ ] **Step 7: Commit.**

```bash
git add ui/src/export/exportModel.ts ui/src/components/Export/exportSelectionModel.ts tests/unit/ui/export/export-model.test.ts tests/unit/ui/export/export-selection-model.test.ts tests/manifest/coverage-manifest.ts
git commit -m "feat(export): model workspace scope and extra resources"
```

---

## Task 2: Add a typed cross-runtime binary export-resource contract

**Files:**
- Modify: `ui/src/types/webviewMessages.ts`
- Modify: `ui/src/types/hostMessages.ts`
- Create: `ui/src/export/exportResources.ts`
- Create: `tests/unit/ui/export/export-resources.test.ts`
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Write failing bridge-helper tests.**

Define list/read request-response contracts that are JSON-safe across all four runtimes:

```ts
export interface ExportWorkspaceResourceInfo {
  readonly relativePath: string;
  readonly size: number;
}

export interface ListWorkspaceExportResourcesMessage {
  readonly command: 'listWorkspaceExportResources';
  readonly requestId: string;
}

export interface ReadWorkspaceExportResourceMessage {
  readonly command: 'readWorkspaceExportResource';
  readonly requestId: string;
  readonly resourcePath: string;
  readonly documentPath?: string;
}
```

Host responses should use `dataBase64` for binary data and carry a normalized workspace-relative resolved path plus MIME type.

Tests should mock `PlatformBridge`, emit matching/non-matching request IDs, cover timeout, and decode base64 to `Uint8Array`.

- [ ] **Step 2: Run the focused test and confirm failure.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-resources.test.ts
```

- [ ] **Step 3: Implement typed messages and helpers.**

Add helper signatures:

```ts
export function listWorkspaceExportResources(
  bridge: PlatformBridge,
  timeoutMs?: number,
): Promise<readonly ExportWorkspaceResourceInfo[]>;

export function readWorkspaceExportResource(
  bridge: PlatformBridge,
  resourcePath: string,
  options?: { documentPath?: string; timeoutMs?: number },
): Promise<ExportWorkspaceResourceReadResult>;
```

Do not put resource traversal logic in `PlatformBridge` itself; keep it export-specific.

- [ ] **Step 4: Rerun the focused test and TypeScript build.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-resources.test.ts
pnpm --filter ./ui run build
```

- [ ] **Step 5: Commit.**

```bash
git add ui/src/types/webviewMessages.ts ui/src/types/hostMessages.ts ui/src/export/exportResources.ts tests/unit/ui/export/export-resources.test.ts tests/manifest/coverage-manifest.ts
git commit -m "feat(export): add binary workspace resource protocol"
```

---

## Task 3: Implement workspace-contained resource adapters in Electron, Tauri, VS Code, and Chromium

**Files:**
- Create: `electron/core/runtime-export-resources.js`
- Modify: `electron/core/main-runtime.js`
- Modify: `electron/core/main-bootstrap.js`
- Create: `tests/unit/electron/export-resources.test.ts`
- Create: `tauri/src/runtime/export_resources.rs`
- Modify: `tauri/src/runtime/mod.rs`
- Modify: `tauri/src/dispatcher/commands_external.rs`
- Create/extend Rust tests in: `tauri/src/runtime/export_resources.rs`
- Create: `vscode/src/core/panelExportResources.ts`
- Modify: `vscode/src/core/panel.ts`
- Create: `tests/unit/vscode/panel-export-resources.test.ts`
- Modify: `chromium-xtension/src/file-access.ts`
- Create: `chromium-xtension/src/chrome-host-export.ts`
- Modify: `chromium-xtension/src/chrome-host.ts`
- Create: `tests/unit/chromium/chrome-host-export.test.ts`
- Modify: `tests/manifest/coverage-manifest.ts`

Implement each host in its own red-green cycle; do not write all four before running tests.

- [ ] **Step 1: Electron failing tests.**

Cover:
- recursive listing returns regular files with workspace-relative paths;
- `.git/**` is omitted;
- direct absolute/path-traversal requests outside the workspace return `outside-workspace`;
- a relative asset such as `../images/logo.png` can resolve relative to `documentPath` only when the canonical target remains inside the workspace;
- binary bytes are returned as base64.

- [ ] **Step 2: Run Electron test and confirm failure.**

```bash
pnpm exec vitest run tests/unit/electron/export-resources.test.ts
```

- [ ] **Step 3: Implement Electron adapter and wire handlers.**

Keep the new `.js` module under 350 LOC. Use `fs.realpathSync`/equivalent canonical checks and regular-file stat checks. The module should expose small pure helpers plus `listWorkspaceExportResources` / `readWorkspaceExportResource` runtime handlers.

- [ ] **Step 4: Rerun Electron focused tests.**

```bash
pnpm exec vitest run tests/unit/electron/export-resources.test.ts tests/unit/electron/main-runtime.test.ts
```

- [ ] **Step 5: Tauri failing Rust tests, then implement.**

Add a focused module with canonical containment and `.git` filtering. Export it from `runtime/mod.rs`; dispatch the two commands in `commands_external.rs` and emit typed result messages.

```bash
cargo test --manifest-path tauri/Cargo.toml export_resources
```

Expected first run: new tests fail to compile/pass until the module exists; second run passes after implementation.

- [ ] **Step 6: VS Code failing tests, then implement.**

Use the first active workspace folder as root and `workspace.fs.readFile` where practical. Reject resources outside the workspace root and do not enumerate `.git`.

```bash
pnpm exec vitest run tests/unit/vscode/panel-export-resources.test.ts
```

- [ ] **Step 7: Chromium failing tests, then implement.**

Extend `file-access.ts` with recursive file enumeration and binary reads from the active `FileSystemDirectoryHandle`; containment is guaranteed by traversal from the root handle. Keep `.git` out of normal enumeration.

```bash
pnpm exec vitest run tests/unit/chromium/chrome-host-export.test.ts
```

- [ ] **Step 8: Run all adapter-focused tests and register coverage.**

```bash
pnpm exec vitest run tests/unit/electron/export-resources.test.ts tests/unit/vscode/panel-export-resources.test.ts tests/unit/chromium/chrome-host-export.test.ts
cargo test --manifest-path tauri/Cargo.toml export_resources
```

- [ ] **Step 9: Commit.**

```bash
git add electron/core/runtime-export-resources.js electron/core/main-runtime.js electron/core/main-bootstrap.js tests/unit/electron/export-resources.test.ts tauri/src/runtime/export_resources.rs tauri/src/runtime/mod.rs tauri/src/dispatcher/commands_external.rs vscode/src/core/panelExportResources.ts vscode/src/core/panel.ts tests/unit/vscode/panel-export-resources.test.ts chromium-xtension/src/file-access.ts chromium-xtension/src/chrome-host-export.ts chromium-xtension/src/chrome-host.ts tests/unit/chromium/chrome-host-export.test.ts tests/manifest/coverage-manifest.ts
git commit -m "feat(export): read workspace resources across runtimes"
```

---

## Task 4: Add one cross-runtime export-artifact save facade

**Files:**
- Create: `ui/src/export/exportSave.ts`
- Modify: `ui/src/types/webviewMessages.ts`
- Modify: `ui/src/types/hostMessages.ts`
- Modify: `electron/core/main-bootstrap.js` and/or focused save handler module
- Modify: `tauri/src/dispatcher/commands_external.rs`
- Modify: `vscode/src/core/panel.ts`
- Modify: `chromium-xtension/src/chrome-host.ts` only if host routing is needed
- Modify: `ui/src/dom/saveTauriImage.ts` to delegate generic export saves or leave PNG-only compatibility thin
- Create: `tests/unit/ui/export/export-save.test.ts`
- Modify existing host tests as needed
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Write failing UI save-facade tests.**

Use one artifact contract:

```ts
export interface ExportArtifact {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ExportSaveResult {
  ok: boolean;
  cancelled?: boolean;
  path?: string;
  error?: string;
}
```

Verify the facade sends one generic `saveExportFile` request to Electron/Tauri/VS Code, and uses browser object-URL download as the Chromium fallback. Multi-file outputs must already be ZIPs before this layer.

- [ ] **Step 2: Run the UI test and confirm failure.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-save.test.ts
```

- [ ] **Step 3: Implement UI facade plus typed generic save result.**

Do not retain a PDF-specific save protocol. Keep request IDs/timeouts/cancel handling consistent with existing Tauri generic save behavior.

- [ ] **Step 4: Add/adjust host tests first, then implement host generic-save support.**

Electron: native save dialog + `fs.writeFile`.

VS Code: `window.showSaveDialog` + `workspace.fs.writeFile`.

Tauri: reuse the existing generic `saveExportFile` handler and make its typed result available to the shared facade.

Chromium: use `Blob` + object URL + anchor download after generation; do not require a delayed File System Access picker that may lose user activation.

- [ ] **Step 5: Run focused UI + host tests.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-save.test.ts tests/unit/electron/ipc-handlers.test.ts tests/unit/vscode/panel.test.ts
pnpm run test:tauri
```

- [ ] **Step 6: Commit.**

```bash
git add ui/src/export/exportSave.ts ui/src/types/webviewMessages.ts ui/src/types/hostMessages.ts ui/src/dom/saveTauriImage.ts electron/core/main-bootstrap.js tauri/src/dispatcher/commands_external.rs vscode/src/core/panel.ts tests tests/manifest/coverage-manifest.ts
git commit -m "feat(export): save generated artifacts across runtimes"
```

---

## Task 5: Rebuild Export Center source and extras controls with searchable custom UI

**Files:**
- Create: `ui/src/components/shared/SearchableSelect.tsx`
- Create: `ui/src/components/Export/ExportMultiSelect.tsx`
- Create: `ui/src/components/Export/ExportAdditionalFilesPanel.tsx`
- Modify: `ui/src/components/Export/ExportCenterSourcePanel.tsx`
- Modify: `ui/src/components/Export/ExportCenterModal.tsx`
- Modify: `ui/src/styles/global/global-export-center.css`
- Create/import if needed: `ui/src/styles/global/global-export-selectors.css`
- Modify: `ui/src/styles/global.css`
- Create: `tests/unit/ui/components/export-source-controls.test.tsx`
- Modify: `tests/unit/ui/components/export-center-close.test.tsx`
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Write failing render/behavior tests for the four source modes.**

Tests must find Current document, Selected documents, Folder, and Whole workspace. Whole workspace should show the resolved renderable-document count and no picker.

- [ ] **Step 2: Add failing searchable multi-select tests.**

Verify:
- rows use the existing `SwitchButton` (`role="switch"`), not native checkboxes;
- search filters by file name and relative path;
- Select all / Unselect all modifies only filtered rows;
- clearing search preserves off-filter selections.

- [ ] **Step 3: Add failing searchable folder-dropdown tests.**

Follow the existing `FontSearchDropdown` interaction model: search input, ArrowUp/ArrowDown, Enter, Escape, click-outside. Do not refactor `FontSearchDropdown` unless sharing a small utility clearly reduces duplication.

- [ ] **Step 4: Add failing Additional workspace files tests.**

The panel:
- is visible for HTML and Static Website;
- is absent for PDF;
- starts empty;
- accepts file/folder resource metadata from `listWorkspaceExportResources`;
- uses searchable switches + filtered bulk actions;
- does not show `.git` entries even if a mock host incorrectly returns them.

- [ ] **Step 5: Run the failing component tests.**

```bash
pnpm exec vitest run tests/unit/ui/components/export-source-controls.test.tsx tests/unit/ui/components/export-center-close.test.tsx
```

- [ ] **Step 6: Implement focused components.**

Use `ui/src/components/shared/SwitchButton.tsx`. Keep selection state in `ExportCenterModal`, but keep search/open/highlight UI state local to selector components.

- [ ] **Step 7: Remove the PDF footer UI test and replace it with an absence assertion.**

The existing footer test must change to assert that selecting PDF shows no `Include PDF footer` checkbox and no `Markdown Explorer - @the-long-ride` text.

- [ ] **Step 8: Make the activity/results region flex-fill remaining modal space.**

Use a stable activity panel with an empty state. Required layout semantics:

```css
.export-center__body { min-height: 0; }
.export-center__activity {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
```

Remove the old short `max-height: 132px` results behavior. Keep the modal itself viewport bounded and avoid a second page-level scrollbar.

- [ ] **Step 9: Run component tests and UI build.**

```bash
pnpm exec vitest run tests/unit/ui/components/export-source-controls.test.tsx tests/unit/ui/components/export-center-close.test.tsx
pnpm --filter ./ui run build
```

- [ ] **Step 10: Commit.**

```bash
git add ui/src/components/shared/SearchableSelect.tsx ui/src/components/Export ui/src/styles/global/global-export-center.css ui/src/styles/global/global-export-selectors.css ui/src/styles/global.css tests/unit/ui/components tests/manifest/coverage-manifest.ts
git commit -m "feat(export): add searchable source and extra-file controls"
```

---

## Task 6: Fix HTML preview sizing at the source and remove polling/clamping

**Files:**
- Modify: `ui/src/markdown/htmlPreviewDocument.ts`
- Modify: `ui/src/dom/globalHandlers.ts`
- Modify: `tests/node/html-preview-content.test.mjs`
- Modify/create: `tests/unit/ui/dom/globalHandlers-pure.test.ts`

- [ ] **Step 1: Add failing child-document tests for observer-driven resize.**

Assert generated preview HTML includes `ResizeObserver` (and a mutation/load fallback where required), posts the existing `{ type: 'resize-iframe', id, height }` shape, and no longer contains the unconditional `setInterval(..., 100)` poll.

- [ ] **Step 2: Add failing parent-resize tests.**

Given a valid resize message with `height: 2400`, the iframe style must become `2400px`; there must be no `Math.min(data.height, viewportCap)` behavior. Invalid/non-finite/non-positive heights should be ignored.

- [ ] **Step 3: Run focused tests and confirm failure.**

```bash
node --test tests/node/html-preview-content.test.mjs
pnpm exec vitest run tests/unit/ui/dom/globalHandlers-pure.test.ts
```

- [ ] **Step 4: Implement observer-driven full-height resize.**

Keep the existing preview ID validation and network guard untouched. If `ResizeObserver` is unavailable, use a finite load/mutation fallback rather than a permanent polling loop.

- [ ] **Step 5: Run focused tests.**

```bash
node --test tests/node/html-preview-content.test.mjs
pnpm exec vitest run tests/unit/ui/dom/globalHandlers-pure.test.ts
```

- [ ] **Step 6: Commit.**

```bash
git add ui/src/markdown/htmlPreviewDocument.ts ui/src/dom/globalHandlers.ts tests/node/html-preview-content.test.mjs tests/unit/ui/dom/globalHandlers-pure.test.ts
git commit -m "fix(html-preview): auto-fit rendered preview height"
```

---

## Task 7: Create enhanced offscreen export snapshots and deterministic feature detection

**Files:**
- Create: `ui/src/export/exportSnapshot.ts`
- Modify: `ui/src/export/documentSnapshot.ts` only for shared source-loader extraction if needed
- Reuse: `ui/src/components/Content/runContentEnhancements.ts`
- Create: `tests/unit/ui/export/export-snapshot.test.ts`
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Write failing feature-detection tests.**

Define a compact manifest:

```ts
export type ExportFeature =
  | 'core'
  | 'htmlPreview'
  | 'mediaModal'
  | 'dataTable'
  | 'charts';
```

Do not include Mermaid as a runtime JS feature when the snapshot already contains rendered SVG. Mermaid content should imply `mediaModal`, not loading the full Mermaid renderer into exported pages. Rendered KaTeX/highlighted code likewise need CSS/core behavior, not KaTeX/highlight.js runtime JS.

Test representative markup for:
- plain content => `core` only;
- code tools => `core`;
- image or Mermaid SVG => `mediaModal`;
- HTML preview iframe => `htmlPreview`;
- enhanced table => `dataTable`;
- chart-capable table/chart metadata => `dataTable + charts`.

- [ ] **Step 2: Run the feature test and confirm failure.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-snapshot.test.ts
```

- [ ] **Step 3: Implement an offscreen enhanced snapshot.**

Start from `loadDocumentSnapshot`, mount its rendered HTML into an offscreen but layout-capable `.mdn-body`, run `runContentEnhancements` with a cancellation function, then serialize the enhanced DOM. Record visual block metadata before removing the staging host.

Representative type:

```ts
export interface ExportDocumentSnapshot extends DocumentSnapshot {
  features: ReadonlySet<ExportFeature>;
  visualBlocks: readonly ExportVisualBlock[];
  warnings: readonly string[];
}
```

- [ ] **Step 4: Add bounded queue tests.**

Create/export a small `mapWithConcurrency` utility in this module or a focused helper and verify no more than 2-3 snapshot jobs execute concurrently. This replaces the modal's current unbounded `Promise.allSettled(job.files.map(...))` behavior.

- [ ] **Step 5: Run tests and build.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-snapshot.test.ts tests/unit/ui/export/document-snapshot.test.ts
pnpm --filter ./ui run build
```

- [ ] **Step 6: Commit.**

```bash
git add ui/src/export/exportSnapshot.ts ui/src/export/documentSnapshot.ts tests/unit/ui/export/export-snapshot.test.ts tests/manifest/coverage-manifest.ts
git commit -m "feat(export): snapshot enhanced portable document state"
```

---

## Task 8: Build feature-specific offline export runtime bundles

**Files:**
- Create: `ui/src/dom/portableContentHandlers.ts`
- Create: `ui/src/dom/portableMediaViewer.ts`
- Refactor minimally as needed: `ui/src/dom/copyHandlers.ts`, `ui/src/dom/headingSectionHandlers.ts`, `ui/src/dom/tableHandlers.ts`, `ui/src/dom/tableChartViewer.ts` and focused chart-viewer helpers
- Create runtime entries under: `ui/src/export/runtime/`
- Create: `ui/scripts/build-export-runtime.mjs`
- Modify: `ui/package.json`
- Modify: `ui/vite.config.ts` only if build integration cannot remain script-only
- Create: `ui/src/export/exportRuntimeAssets.ts`
- Create: `tests/node/export-runtime-build.test.mjs`
- Create: `tests/unit/ui/export/export-runtime-assets.test.ts`
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Write a failing runtime-build contract test.**

The build script must accept an optional output directory for tests and emit deterministic standalone IIFE files such as:

```text
core.js
html-preview.js
media.js
table.js
charts.js
```

Assertions:
- `core.js` does not contain Chart.js or Mermaid renderer code;
- `charts.js` contains the chart capability and bundles its Chart.js dependency locally;
- no emitted runtime contains `http://`, `https://`, unpkg/jsdelivr CDN references, or host bridge calls;
- running the builder twice yields the same filenames.

- [ ] **Step 2: Run the Node contract and confirm failure.**

```bash
node --test tests/node/export-runtime-build.test.mjs
```

- [ ] **Step 3: Extract host-free portable handlers.**

`portableContentHandlers` should initialize only browser-portable interactions. App `globalHandlers.ts` may reuse it, but exported runtime entries must not import app navigation, native editor, update, filesystem, or host IPC paths.

`portableMediaViewer` should provide a lightweight browser modal for exported images and rendered Mermaid SVG. Keep current modal visual conventions but avoid React/app shell dependency in exported output.

- [ ] **Step 4: Implement one runtime entry at a time.**

Example core entry:

```ts
import { installPortableContentHandlers } from '../../dom/portableContentHandlers';
installPortableContentHandlers(document);
```

The charts entry may import `chart.js/auto` and the portable chart/table viewer initializer. The table-only entry must not import Chart.js.

- [ ] **Step 5: Implement `build-export-runtime.mjs`.**

Use Vite's programmatic build with one entry per output, `format: 'iife'`, minification, deterministic output names, and no dynamic chunks. Do not commit generated runtime files; generate them as part of UI dev/build workflows into a known local/public output directory.

Update UI scripts so all normal runtime builds generate these assets first without recursive script invocation.

- [ ] **Step 6: Add failing/then passing loader tests.**

`exportRuntimeAssets.ts` should map a feature union to exactly the required bundle names, load local bundle text, cache successful reads, and throw a clear build/configuration error when a required local runtime asset is missing.

```bash
pnpm exec vitest run tests/unit/ui/export/export-runtime-assets.test.ts
node --test tests/node/export-runtime-build.test.mjs
```

- [ ] **Step 7: Run the UI build in all modes affected by the script.**

```bash
pnpm --filter ./ui run build
pnpm --filter ./ui run build:electron
pnpm --filter ./ui run build:tauri
pnpm --filter ./ui run build:vscode
```

- [ ] **Step 8: Commit.**

```bash
git add ui/src/dom/portableContentHandlers.ts ui/src/dom/portableMediaViewer.ts ui/src/dom ui/src/export/runtime ui/src/export/exportRuntimeAssets.ts ui/scripts/build-export-runtime.mjs ui/package.json ui/vite.config.ts tests/node/export-runtime-build.test.mjs tests/unit/ui/export/export-runtime-assets.test.ts tests/manifest/coverage-manifest.ts
git commit -m "feat(export): build minimal offline interaction runtimes"
```

---

## Task 9: Replace broad stylesheet capture with a portable theme snapshot

**Files:**
- Create: `ui/src/export/exportTheme.ts`
- Modify: `ui/src/export/exportHtml.ts`
- Modify: `tests/unit/ui/export/export-html.test.ts`
- Create: `tests/unit/ui/export/export-theme.test.ts`
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Add failing theme-snapshot tests.**

Required model:

```ts
export interface ExportThemeSnapshot {
  rootAttributes: Readonly<Record<string, string>>;
  cssVariables: Readonly<Record<string, string>>;
  cssText: string;
  fontFaceCss: string;
}
```

Tests should prove active theme classes/data attributes and computed CSS variables are captured, while obvious app-only selectors such as Export Center, update UI, window chrome, or modal backdrop are not indiscriminately dumped into output.

- [ ] **Step 2: Add failing exported-page scrolling tests.**

Assert generated CSS explicitly permits document scrolling and does not leak `overflow: hidden`/fixed viewport rules onto exported `html`, `body`, or `.mdn-export-page`.

Representative reset:

```css
html, body {
  min-height: 100%;
  height: auto;
  overflow-x: hidden;
  overflow-y: auto;
}
```

- [ ] **Step 3: Run focused tests and confirm failure.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-theme.test.ts tests/unit/ui/export/export-html.test.ts
```

- [ ] **Step 4: Implement scoped portable theme capture.**

Capture only theme/root variables and stylesheet rules relevant to document/export features (`.mdn-body`, code, tables, Mermaid/SVG, preview, media/chart viewer, typography, `@font-face`, required keyframes). Preserve theme token fidelity without carrying app layout constraints.

- [ ] **Step 5: Update `buildStandaloneExportHtml` to consume `ExportThemeSnapshot`.**

Apply root attributes to generated `<html>`/`<body>` as appropriate and keep the export shell CSS thin.

- [ ] **Step 6: Rerun tests and build.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-theme.test.ts tests/unit/ui/export/export-html.test.ts
pnpm --filter ./ui run build
```

- [ ] **Step 7: Commit.**

```bash
git add ui/src/export/exportTheme.ts ui/src/export/exportHtml.ts tests/unit/ui/export/export-theme.test.ts tests/unit/ui/export/export-html.test.ts tests/manifest/coverage-manifest.ts
git commit -m "fix(export): preserve active theme without app layout leakage"
```

---

## Task 10: Build the referenced/explicit asset graph and HTML package composer

**Files:**
- Create: `ui/src/export/exportAssets.ts`
- Create: `ui/src/export/exportSite.ts`
- Modify: `ui/src/export/exportHtml.ts`
- Modify: `tests/unit/ui/export/export-assets.test.ts`
- Modify: `tests/unit/ui/export/export-html.test.ts`
- Create: `tests/unit/ui/export/export-site.test.ts`
- Modify: `tests/unit/ui/export/zip-store.test.ts` only if new edge cases require it
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Add failing asset-graph tests.**

Use:

```ts
export interface ExportAsset {
  sourcePath: string;
  outputPath: string;
  bytes: Uint8Array;
  mimeType: string;
  kind: 'referenced' | 'extra';
}
```

Cover local `img[src]`, `source[src]`, media `poster`, and other currently supported portable local references. Resolve paths through `readWorkspaceExportResource`, not direct `fetch(file:)`.

- [ ] **Step 2: Test failure semantics before implementation.**

Automatic referenced missing asset => snapshot/package warning and HTML remains exportable.

Explicit selected extra missing/unreadable => packaging rejects with a path-specific error.

Duplicate automatic + explicit resource => emitted once.

Folder extras expand using the resource metadata list and preserve workspace-relative paths.

- [ ] **Step 3: Run and implement the asset graph.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-assets.test.ts
```

- [ ] **Step 4: Add failing HTML artifact-kind/package tests.**

Required behavior:
- one HTML document, no explicit extras => self-contained `.html`;
- one HTML document + explicit extras => `HTML package (.zip)` with HTML + extras;
- multi-document HTML => package/ZIP according to existing batch semantics;
- Static Website => ZIP with index/pages/shared runtime/assets/extras;
- runtime bundles included are exactly the union returned by the feature manifests;
- collision-safe `exportHtmlPath` behavior remains unchanged.

- [ ] **Step 5: Implement site/package assembly.**

Standalone HTML should inline referenced binary assets as data URLs where practical. Site/package mode should write referenced resources once and rewrite paths to stable package-relative locations. Explicit extras remain ordinary files.

- [ ] **Step 6: Run focused tests.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-assets.test.ts tests/unit/ui/export/export-html.test.ts tests/unit/ui/export/export-site.test.ts tests/unit/ui/export/zip-store.test.ts
```

- [ ] **Step 7: Commit.**

```bash
git add ui/src/export/exportAssets.ts ui/src/export/exportSite.ts ui/src/export/exportHtml.ts tests/unit/ui/export tests/manifest/coverage-manifest.ts
git commit -m "feat(export): package offline HTML assets and extras"
```

---

## Task 11: Implement the hybrid shared PDF compositor with pdfmake

**Files:**
- Modify: `ui/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `ui/src/export/pdf/pdfModel.ts`
- Create: `ui/src/export/pdf/pdfSemantic.ts`
- Create: `ui/src/export/pdf/pdfVisualCapture.ts`
- Create: `ui/src/export/pdf/pdfFonts.ts`
- Create: `ui/src/export/pdf/pdfComposer.ts`
- Create: `tests/unit/ui/export/pdf-semantic.test.ts`
- Create: `tests/unit/ui/export/pdf-visual-capture.test.ts`
- Create: `tests/unit/ui/export/pdf-composer.test.ts`
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Add `pdfmake@^0.3.11` only.**

```bash
pnpm --filter ./ui add pdfmake@^0.3.11
```

Do not add html2canvas, jsPDF, pdf-lib, or a second PDF stack. Keep PDF generation lazy so the normal app startup bundle does not eagerly load pdfmake.

- [ ] **Step 2: Write failing semantic-conversion tests.**

`pdfSemantic.ts` should map enhanced DOM into a small local PDF node model first, then to pdfmake definitions. Cover:
- h1-h6;
- paragraphs with bold/italic/inline code/links;
- ordered/unordered lists;
- blockquotes;
- regular tables;
- pre/code;
- document boundary/page break markers.

The test must prove ordinary text remains text nodes, not a page-sized image.

- [ ] **Step 3: Run semantic tests and implement minimally.**

```bash
pnpm exec vitest run tests/unit/ui/export/pdf-semantic.test.ts
```

- [ ] **Step 4: Write failing complex-block capture tests.**

Required visual behavior:
- rendered Mermaid SVG => serialized SVG node where valid;
- chart canvas => PNG data URL using `toDataURL` before staging DOM is discarded;
- ordinary local image => data URI/image node;
- HTML preview => static visual representation generated without executing user script in a same-origin capture context.

Security rule for PDF previews: PDF is static. Do **not** weaken the HTML sandbox by using `sandbox="allow-scripts allow-same-origin"`. Capture initial/static markup with scripts disabled, or fall back to a framed preview representation if browser serialization cannot safely rasterize it.

- [ ] **Step 5: Implement native-browser visual capture without another rendering dependency.**

Prefer SVG serialization/`<foreignObject>` + canvas for static DOM capture where supported. Enforce explicit width/height/pixel ceilings and return a deterministic fallback node when a complex block exceeds limits or cannot be captured.

- [ ] **Step 6: Add font tests and implement fallback-first custom font support.**

Use pdfmake's embedded default Roboto VFS as the guaranteed fallback. When an active custom font is exportable/readable, add its bytes to a job-local VFS/font map; a font read failure must warn/fallback rather than fail the export.

- [ ] **Step 7: Add failing compositor tests.**

Dynamically load pdfmake:

```ts
const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
  import('pdfmake/build/pdfmake'),
  import('pdfmake/build/vfs_fonts'),
]);
pdfMake.addVirtualFileSystem(pdfFonts);
```

Then compose one document definition and use promise-based `getBuffer()`. Tests should mock the loader at the boundary and verify:
- merged exports add deliberate document page breaks;
- separate exports return one artifact per snapshot;
- Mermaid uses SVG instead of raster when possible;
- normal text remains semantic;
- there is no footer definition;
- no host/runtime check affects generation.

- [ ] **Step 8: Run PDF-focused tests and UI build.**

```bash
pnpm exec vitest run tests/unit/ui/export/pdf-semantic.test.ts tests/unit/ui/export/pdf-visual-capture.test.ts tests/unit/ui/export/pdf-composer.test.ts
pnpm --filter ./ui run build
```

- [ ] **Step 9: Verify pdfmake remains lazy in built output.**

Inspect the Vite manifest/chunks or add a build contract asserting pdfmake is not pulled into the eager main chunk. If Vite names the lazy vendor chunk, add it to the existing lazy-modulepreload exclusion list as needed.

- [ ] **Step 10: Commit.**

```bash
git add ui/package.json pnpm-lock.yaml ui/src/export/pdf tests/unit/ui/export/pdf-*.test.ts ui/vite.config.ts tests/manifest/coverage-manifest.ts
git commit -m "feat(export): compose hybrid PDFs in shared UI runtime"
```

---

## Task 12: Introduce a shared export job runner and reduce ExportCenterModal to orchestration/UI state

**Files:**
- Create: `ui/src/export/exportJobRunner.ts`
- Modify: `ui/src/components/Export/ExportCenterModal.tsx`
- Modify: `ui/src/export/exportModel.ts`
- Create: `tests/unit/ui/export/export-job-runner.test.ts`
- Modify: `tests/unit/ui/components/export-center-close.test.tsx`
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Write failing runner tests for stage/activity events.**

Define activity events such as:

```ts
export type ExportActivityStage =
  | 'queued'
  | 'rendering'
  | 'capturing'
  | 'packaging'
  | 'saved'
  | 'warning'
  | 'failed';
```

The runner should accept dependencies (`snapshot`, `theme`, `resource reader`, `runtime asset loader`, `save`) so tests do not need real browser dialogs or pdfmake.

- [ ] **Step 2: Cover error semantics.**

Tests:
- separate mode: one document may fail while successful document artifacts remain saved/reported;
- merged HTML/PDF and Static Website: a required document failure prevents final save;
- missing automatic asset emits warning;
- missing explicit extra prevents package save;
- stale/cancelled modal generation can ignore late UI updates without attempting to abort underlying safe work.

- [ ] **Step 3: Cover artifact labeling before export.**

Expose a pure preview helper returning labels such as:

```ts
'HTML (.html)'
'HTML package (.zip)'
'Static Website (.zip)'
'PDF (.pdf)'
'PDF files'
```

The label must account for document count/batch mode and explicit extras.

- [ ] **Step 4: Run the runner test and confirm failure.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-job-runner.test.ts
```

- [ ] **Step 5: Implement the runner using bounded snapshots + new composers/save facade.**

No `appRuntime === 'desktop'` PDF gate. The runner receives resolved `job.files`; Whole workspace resolution remains a UI/model concern.

- [ ] **Step 6: Refactor `ExportCenterModal.tsx`.**

The modal should own:
- form state;
- source resolution;
- extras selection;
- activity state;
- close/stale-generation behavior;
- invoking `runExportJob`.

It should no longer own HTML/site/PDF generation internals. Remove `pdfFooterEnabled`, old direct asset embedding, direct ZIP assembly, and `exportPdfViaHost` imports.

- [ ] **Step 7: Update UI tests.**

Prove:
- PDF is selectable for every `AppRuntime` fixture;
- Whole workspace sends all `state.fileList` files to the job;
- additional files are not included for PDF;
- activity panel receives stage rows and retains close/Escape behavior while running;
- artifact label changes to HTML package before export when extras are selected.

- [ ] **Step 8: Run focused tests/build.**

```bash
pnpm exec vitest run tests/unit/ui/export/export-job-runner.test.ts tests/unit/ui/components/export-center-close.test.tsx tests/unit/ui/components/export-source-controls.test.tsx
pnpm --filter ./ui run build
```

- [ ] **Step 9: Commit.**

```bash
git add ui/src/export/exportJobRunner.ts ui/src/export/exportModel.ts ui/src/components/Export/ExportCenterModal.tsx tests/unit/ui/export/export-job-runner.test.ts tests/unit/ui/components/export-center-close.test.tsx tests/manifest/coverage-manifest.ts
git commit -m "refactor(export): run all formats through shared export pipeline"
```

---

## Task 13: Remove the old Electron PDF/footer protocol and native renderer

**Files:**
- Delete: `ui/src/export/pdfExport.ts`
- Modify: `ui/src/types/webviewMessages.ts`
- Modify: `ui/src/types/hostMessages.ts`
- Delete: `electron/core/pdf-export.js`
- Modify: `electron/core/main-bootstrap.js`
- Delete/replace: `tests/unit/ui/export/pdf-export-host.test.ts`
- Delete/replace: `tests/unit/electron/pdf-export.test.ts`
- Delete/replace: `tests/unit/electron/pdf-export-ipc.test.ts`
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Write/adjust failing contracts that assert the old path is gone.**

Tests should fail while any of these remain:
- `ExportPdfMessage` / `ExportPdfResultMessage`;
- `footerEnabled` / `footerText` PDF bridge fields;
- `PDF_FOOTER_TEXT`;
- `footerTemplate`;
- `webContents.printToPDF` export registration;
- the old Electron `exportPdf` IPC handler.

Keep generic `saveExportFile` coverage instead.

- [ ] **Step 2: Run affected tests and confirm failure.**

```bash
pnpm exec vitest run tests/unit/ui/export tests/unit/electron/pdf-export.test.ts tests/unit/electron/pdf-export-ipc.test.ts
```

- [ ] **Step 3: Remove the obsolete production path and stale tests.**

Delete the old renderer rather than retaining an unused fallback. Remove imports/constructor injection from `main-bootstrap.js`.

- [ ] **Step 4: Search for footer/old PDF protocol residue.**

```bash
git grep -n -E "PDF_FOOTER_TEXT|footerEnabled|footerText|exportPdfResult|command: ['\"]exportPdf['\"]|printToPDF" -- ui electron tests
```

Expected: no export-footer/old direct-PDF implementation references. Incidental unrelated print APIs are acceptable only if not part of Export Center.

- [ ] **Step 5: Run UI/Electron tests.**

```bash
pnpm run test:ui
pnpm run test:electron
```

- [ ] **Step 6: Commit.**

```bash
git add -A ui/src/export/pdfExport.ts ui/src/types electron/core/pdf-export.js electron/core/main-bootstrap.js tests/unit/ui/export tests/unit/electron tests/manifest/coverage-manifest.ts
git commit -m "refactor(export): remove Electron-only PDF and footer path"
```

---

## Task 14: Add structured external-open requests and parent-folder workspace focus

**Files:**
- Modify: `electron/core/external-open.js`
- Modify: `electron/main.js`
- Modify: `electron/core/main-bootstrap.js`
- Modify: `tests/unit/electron/external-open.test.ts`
- Modify: `tests/unit/electron/main.test.ts`
- Modify: `tauri/src/runtime/external_open.rs`
- Modify: `tauri/src/core/bootstrap.rs`
- Modify: `tauri/src/app_state.rs`
- Modify: `tauri/src/host_message.rs`
- Modify: `ui/src/types/hostMessages.ts`
- Modify: `ui/src/hooks/useDesktopTabSearchSync.ts`
- Modify/create: `tests/unit/ui/desktop-tabs.test.ts` or focused `tests/unit/ui/hooks/use-desktop-tab-search-sync.test.tsx`
- Modify: `tests/manifest/coverage-manifest.ts`

- [ ] **Step 1: Write failing Electron parser tests.**

Change the parser result from path string to structured request:

```ts
type ExternalOpenRequest =
  | { mode: 'file'; filePath: string }
  | { mode: 'folder'; folderPath: string }
  | { mode: 'file-with-parent-workspace'; filePath: string; folderPath: string };
```

Cases:
- plain `.md/.mdx` => `file`;
- plain directory => `folder`;
- `--open-with-folder C:\repo\docs\guide.md` => parent `C:\repo\docs` + original file;
- invalid/non-Markdown target after flag => no request;
- unrelated installer flags remain ignored.

- [ ] **Step 2: Run parser tests and implement Electron request parsing/queueing.**

```bash
pnpm exec vitest run tests/unit/electron/external-open.test.ts tests/unit/electron/main.test.ts
```

The startup queue and second-instance path should carry the full request object. Emit `externalOpenRequest` rather than a bare `externalOpenPath`.

- [ ] **Step 3: Write failing Tauri parser tests and implement equivalent serializable request.**

Use a Rust enum/struct that serializes to the same UI shape. Change `AppStateInner.external_open_path` to an optional request field. Startup and single-instance handlers should preserve mode and focus the app window.

```bash
cargo test --manifest-path tauri/Cargo.toml external_open
```

- [ ] **Step 4: Write failing UI message-routing tests.**

For `file-with-parent-workspace`, use the existing workspace operation/tab flow and send:

```ts
bridge.postMessage({
  command: 'activateWorkspace',
  workspacePath: request.folderPath,
  filePath: request.filePath,
  openFirstFile: false,
  ...operation,
});
```

This lets the host load/scan the parent workspace and then send content for the exact clicked file, avoiding a UI race.

Plain file/folder requests should retain the current semantics through `openPath`/workspace tab creation.

- [ ] **Step 5: Run Electron/Tauri/UI routing tests.**

```bash
pnpm exec vitest run tests/unit/electron/external-open.test.ts tests/unit/electron/main.test.ts tests/unit/ui/desktop-tabs.test.ts
cargo test --manifest-path tauri/Cargo.toml external_open
```

- [ ] **Step 6: Commit.**

```bash
git add electron/core/external-open.js electron/main.js electron/core/main-bootstrap.js tests/unit/electron/external-open.test.ts tests/unit/electron/main.test.ts tauri/src/runtime/external_open.rs tauri/src/core/bootstrap.rs tauri/src/app_state.rs tauri/src/host_message.rs ui/src/types/hostMessages.ts ui/src/hooks/useDesktopTabSearchSync.ts tests/unit/ui tests/manifest/coverage-manifest.ts
git commit -m "feat(shell): open Markdown file with parent workspace"
```

---

## Task 15: Register both Windows Markdown file verbs in Electron and Tauri installers

**Files:**
- Modify: `electron/build/installer.nsh`
- Modify: `tauri/windows/explorer-hooks.nsh`
- Create: `tests/node/windows-explorer-context-contract.test.mjs`

- [ ] **Step 1: Write a failing installer contract test.**

Assert both installer files contain, for both `.md` and `.mdx`:

```text
Open in Markdown Explorer
Open in Markdown Explorer with this folder
--open-with-folder "%1"
```

Also assert:
- existing `Open Folder in Markdown Explorer` directory/background verbs remain;
- both file verbs are controlled by the existing Markdown context-menu installer checkbox;
- uninstall deletes both file verb keys;
- the old visible wording `Open with Markdown Explorer` is gone.

- [ ] **Step 2: Run the Node contract and confirm failure.**

```bash
node --test tests/node/windows-explorer-context-contract.test.mjs
```

- [ ] **Step 3: Implement separate registry verbs.**

Conceptually:

```text
SystemFileAssociations\.md\shell\MarkdownExplorer
SystemFileAssociations\.md\shell\MarkdownExplorerWithFolder
SystemFileAssociations\.mdx\shell\MarkdownExplorer
SystemFileAssociations\.mdx\shell\MarkdownExplorerWithFolder
```

The second command passes `--open-with-folder "%1"`. Do not add another installer checkbox.

- [ ] **Step 4: Rerun contract tests and installer-related build tests.**

```bash
node --test tests/node/windows-explorer-context-contract.test.mjs
pnpm run test:node
```

- [ ] **Step 5: Commit.**

```bash
git add electron/build/installer.nsh tauri/windows/explorer-hooks.nsh tests/node/windows-explorer-context-contract.test.mjs
git commit -m "feat(windows): add open-with-parent-folder context action"
```

---

## Task 16: Add representative export fixtures, close coverage gaps, and perform full verification

**Files:**
- Modify/add: `manual-tests/test-diagrams.md` only if it is the established all-features fixture, otherwise create `manual-tests/test-export-interactions.md`
- Create: `manual-tests/export-workspace/` small multi-folder fixture if repository conventions allow fixture directories
- Modify: `tests/manifest/coverage-manifest.ts`
- Modify: relevant docs/reference catalogs if typed host commands changed
- Modify: PR #40 description after verification

- [ ] **Step 1: Add an all-interactions manual export fixture.**

It should contain at least:
- code block with Copy + collapse/expand;
- Mermaid SVG;
- local image;
- HTML preview with user script and content tall enough to verify auto-height;
- data table that can switch to chart;
- chart modal flow;
- enough ordinary text/list/table content to verify PDF selection/search.

A separate multi-folder fixture should validate Whole workspace, folder export, internal links, referenced assets, and explicit supplementary files.

- [ ] **Step 2: Update protocol/reference docs that enumerate UI-to-host or host-to-UI messages.**

At minimum inspect/update:
- `docs/instructions/05-reference/01-ui-to-host-command-catalog.md`
- `docs/instructions/05-reference/02-host-to-ui-message-catalog.md`
- `docs/instructions/01-architecture/06-security-trust-boundaries.md`

Document resource containment, generic save, and structured external-open requests. Remove obsolete Electron PDF/footer protocol documentation.

- [ ] **Step 3: Run coverage/contracts before the full matrix.**

```bash
pnpm run test:contracts
pnpm run test:translations
```

Fix every coverage-manifest or LOC contract failure before proceeding.

- [ ] **Step 4: Run the full test matrix.**

```bash
pnpm run test:ui
pnpm run test:electron
pnpm run test:vscode
pnpm run test:chromium
pnpm run test:node
pnpm run test:tauri
```

Do not claim completion if any applicable test is failing.

- [ ] **Step 5: Run all primary builds.**

```bash
pnpm run build:ui
pnpm run build:ui:electron
pnpm run build:ui:tauri
pnpm run build:vscode
pnpm run build:chromium
```

If the repo's normal CI also packages Electron/Tauri installers for this PR, run the corresponding packaging/build commands locally where the current platform permits.

- [ ] **Step 6: Perform manual artifact verification.**

Verify at least:
- one self-contained HTML file offline with no network;
- one HTML ZIP with an explicit extra file;
- one Static Website ZIP across multiple folders;
- one PDF containing selectable/searchable ordinary text plus Mermaid/chart/preview visual blocks;
- HTML preview outer-page scrolling and full-height behavior;
- code Copy + expand/collapse;
- image/Mermaid modal;
- table -> chart -> chart modal;
- theme fidelity against the active Markdown Explorer theme;
- no PDF footer anywhere.

- [ ] **Step 7: Verify Windows shell behavior on both installer variants where build environment permits.**

From a clicked `docs/guide.md`:
- **Open in Markdown Explorer** opens single-file mode;
- **Open in Markdown Explorer with this folder** loads `docs/` and focuses `guide.md`;
- repeated invocation while app is already running follows the same behavior;
- uninstall removes both Markdown file verbs.

- [ ] **Step 8: Run residue and size checks.**

```bash
git grep -n -E "PDF_FOOTER_TEXT|footerEnabled|footerText|exportPdfResult|Direct PDF export is currently available" -- .
git diff --check
pnpm run test:contracts
```

Expected first grep: no obsolete export-footer/Electron-only PDF strings.

- [ ] **Step 9: Commit final fixtures/docs/coverage updates.**

```bash
git add manual-tests docs tests/manifest/coverage-manifest.ts
git commit -m "test(export): cover interactive cross-runtime artifacts"
```

- [ ] **Step 10: Update PR #40 and wait for final CI/review evidence.**

PR description should now state:
- all runtimes support direct generated PDF artifacts;
- HTML/site output is offline and feature-driven;
- Whole workspace + Additional files behavior;
- footer removal;
- searchable switch selectors/activity layout;
- Windows parent-folder context action.

Fetch the final head's GitHub Actions checks and review threads. Resolve any actionable findings, rerun affected tests, push, and re-check. Completion requires the final head's applicable CI jobs to be green and no unresolved actionable review comments.

---

## Acceptance Checklist

- [ ] Export Center has Current / Selected / Folder / Whole workspace sources.
- [ ] Selected documents and Additional files use searchable switch lists with filtered Select all/Unselect all semantics.
- [ ] Folder selection uses a custom searchable keyboard-accessible dropdown.
- [ ] Additional files are HTML/site-only and opt-in.
- [ ] Activity log fills remaining modal body space and scrolls internally.
- [ ] Standalone HTML reflects active theme, remains page-scrollable, and works offline.
- [ ] HTML preview blocks auto-fit full rendered height and retain isolated user-script behavior.
- [ ] Copy/collapse, image/Mermaid modal, data-table/chart switching, and chart modal work in exported HTML when their feature bundle is included.
- [ ] Runtime JS excludes unused packages/features and has no CDN dependency.
- [ ] PDF generation is shared across Electron/Tauri/VS Code/Chromium and never routes through the system Print Center.
- [ ] PDF ordinary text is selectable/searchable; complex rendered blocks retain visual fidelity with safe static capture rules.
- [ ] PDF footer UI/protocol/native logic is completely removed.
- [ ] Whole workspace exports every renderable document recursively independent of current Explorer filtering.
- [ ] Referenced assets are deduplicated; missing references warn; missing explicit extras fail packaging.
- [ ] Resource reads are workspace-contained across all runtimes.
- [ ] Existing single-file Windows action is `Open in Markdown Explorer`.
- [ ] New `Open in Markdown Explorer with this folder` loads the immediate parent folder and focuses the clicked `.md/.mdx` in cold-start and already-running cases.
- [ ] LOC and coverage-manifest contracts pass.
- [ ] Full test/build matrix passes on the final head.
- [ ] PR #40 final CI is green and review has no unresolved actionable finding.
