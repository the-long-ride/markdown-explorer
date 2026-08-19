# Interactive Cross-Runtime Export Runtime and Windows Shell UX Design

**Date:** 2026-08-19  
**Branch:** `feat/export-center-scope-view`  
**PR:** #40 (`feat: add Export Center and Scope View`)  
**Status:** Approved design, pending written-spec review

## 1. Purpose

This design extends the Export Center work already present on `feat/export-center-scope-view` into a shared export subsystem that behaves consistently across Electron, Tauri, VS Code, and Chromium variants.

The goals are to:

- make exported HTML visually match the active Markdown Explorer theme;
- keep exported HTML interactive where the interaction is portable outside the app;
- keep HTML preview blocks fully visible instead of constrained to a short internal viewport;
- generate offline/self-contained web exports without CDN dependencies;
- package only the JavaScript/CSS/runtime features actually required by the exported documents;
- support direct PDF export in every runtime without routing users through a system print center;
- preserve searchable/selectable text in PDF while retaining high visual fidelity for complex rendered blocks;
- add Whole workspace and Additional workspace files source semantics;
- replace native export selectors and checkbox lists with searchable custom controls and switches;
- make the Export activity/log panel fill the remaining modal space;
- remove the existing PDF footer feature completely;
- add a Windows Explorer command that opens the clicked Markdown file with its parent folder as the workspace and immediately focuses that file.

This specification is architectural. It intentionally defines shared boundaries and runtime contracts before implementation.

## 2. Current-State Constraints

The current Export Center model supports `current`, `selected`, and `folder` source modes, with HTML, PDF, and Static Website formats. The branch already includes document/explorer layouts, separate/merged batch behavior, portable output path encoding, Scope View, Electron PDF support, and generic save behavior for other runtimes.

The current PDF path is asymmetric: Electron owns the working `printToPDF` path while the UI contains a runtime guard that rejects direct PDF export elsewhere. That architecture is replaced by the shared PDF design below.

The existing exported HTML is primarily a rendered/styled snapshot. It does not carry a purpose-built export interaction runtime, so app interactions such as Copy, expand/collapse, image/diagram modal view, and chart workflows do not reliably remain after export.

The existing HTML preview document already has an isolated sandbox, a local-first network guard, and a resize message bridge. This design extends that mechanism instead of creating a second preview security model.

Both Electron and Tauri Windows installers already register `.md`/`.mdx` file context commands and folder context commands. Their runtime startup paths already parse externally supplied Markdown files and directories. The new shell UX therefore extends existing launch behavior rather than introducing a separate startup system.

## 3. Decisions Locked During Design Review

The following decisions are explicit requirements:

1. **Whole workspace scope:** recursively include every document type Markdown Explorer can render, not only `.md`/`.mdx`.
2. **Additional workspace files:** supported for HTML and Static Website exports only. They are explicit opt-in supplementary resources and do not turn Whole workspace into a repository archive.
3. **HTML offline policy:** exported HTML and Static Website output have no CDN/network dependency for Markdown Explorer runtime assets.
4. **HTML preview scripts:** user-authored JavaScript remains executable inside the same isolated, network-blocked preview sandbox model.
5. **HTML preview sizing:** previews auto-fit to their complete rendered height. Normal document scrolling belongs to the outer exported page, not to a short iframe viewport.
6. **PDF strategy:** hybrid semantic/visual PDF. Normal document content remains selectable/searchable; complex rendered blocks use visual capture where required.
7. **PDF footer:** remove the footer feature completely, including UI, state, protocol fields, renderer templates, and footer-specific tests.
8. **Windows Explorer command:** `Open in Markdown Explorer with this folder` opens the clicked file's parent directory as the workspace and immediately opens/focuses the clicked `.md`/`.mdx` file.
9. **Existing single-file shell behavior remains:** `Open in Markdown Explorer` still opens only the clicked file.

## 4. Architecture Overview

The shared export flow is:

```text
Source resolver
  -> rendered document snapshots
  -> feature detector
  -> asset graph
  -> format composer
  -> runtime save adapter
```

Only the final save step is runtime-specific. Document selection, rendered snapshots, feature detection, asset resolution, HTML composition, site composition, and PDF composition are shared UI/export-layer responsibilities.

### 4.1 Source resolver

The resolver converts Export Center selections into a normalized export source graph. Primary source modes are:

- Current document
- Selected documents
- Folder
- Whole workspace

Whole workspace resolves every Markdown Explorer-renderable document recursively from the loaded workspace. It preserves workspace-relative paths and does not depend on the current Explorer search/filter state.

Additional workspace files are a secondary resource selection that applies only to HTML and Static Website formats. They may contain individual files or recursively selected folders. They preserve workspace-relative paths.

### 4.2 Rendered document snapshot

Export operates on the document after Markdown Explorer rendering/enhancement rather than on raw Markdown-to-HTML conversion alone.

A snapshot captures the portable rendered state required to reproduce the document, including relevant:

- rendered markup;
- active theme tokens and theme-root state;
- typography and custom font information;
- code/highlight rendering;
- Mermaid SVG/result state;
- data-table and chart-capable metadata;
- image/media metadata;
- HTML preview configuration;
- portable interaction markers.

Host-only state is never serialized into export output.

### 4.3 Feature detector

Each snapshot yields a deterministic feature manifest. Feature categories should remain small and independently testable. Representative features are:

- `core`
- `codeTools`
- `htmlPreview`
- `mermaid`
- `mediaModal`
- `dataTable`
- `charts`
- `chartModal`
- `math`

The exact internal names are implementation details, but the capability boundary is required: output must not ship Mermaid, Chart.js, table enhancement, or other runtime code unless exported content actually needs it.

For Static Website output, the site runtime is the union of features used by any exported page and is written once as shared local assets. For standalone HTML, required runtime code is embedded/self-contained unless the result is intentionally packaged as a ZIP due to explicit additional files.

### 4.4 Asset graph

The asset graph tracks two distinct categories:

1. **Automatic referenced assets** — files actually referenced by exported documents, such as local images, media, fonts, and other portable resources.
2. **Explicit additional workspace files** — supplementary files/folders the user deliberately selected.

Automatic referenced assets are included only when needed. Explicit extras are opt-in and preserve their workspace-relative structure.

Duplicate resources must be deduplicated deterministically. Explicit extras that are already included automatically must not be emitted twice.

Resolved paths must remain inside the workspace root. Symlink/junction traversal must not allow an export selection to escape the workspace.

## 5. HTML and Static Website Output

### 5.1 Theme fidelity

Exported web output must look like the current Markdown Explorer rendering, not like a generic handcrafted export theme.

The exporter captures the relevant active theme state and produces a scoped export theme stylesheet using the same theme tokens/styles that drive the current rendered document. A thin export-shell stylesheet is allowed for document/static-site layout, but it must not become a second visual theme implementation.

The snapshot must preserve the active appearance that materially affects rendering, including:

- theme style/mode;
- CSS custom properties;
- custom theme overrides;
- typography and custom font choices when exportable;
- spacing, borders, radii, code/table styling;
- Mermaid/chart theme inputs;
- document background/foreground choices.

The generated root/body must explicitly allow normal vertical page scrolling. Screen-only app constraints such as `overflow: hidden`, fixed-height modal wrappers, and viewport-bound content containers must not leak into exported pages.

### 5.2 Portable interaction runtime

Exported HTML keeps interactions that can run entirely in a normal browser without Markdown Explorer host APIs.

Required portable behaviors include, where present:

- code Copy buttons;
- code/content expand-collapse controls;
- Mermaid diagram modal/view behavior;
- image/media modal view;
- enhanced data-table behavior that is portable outside the app;
- data-table to chart switching;
- chart rendering and chart modal view;
- chart legends, zoom/pan, and other browser-only chart interactions that are meaningful in exported output;
- HTML preview interaction;
- rendered math and syntax highlighting.

Host-dependent actions are omitted from output, including native editor commands, native shell/path operations, app-update actions, runtime bridge commands, and other features requiring Electron/Tauri/VS Code host IPC.

### 5.3 Minimal JavaScript/package output

The export runtime is feature-manifest driven.

A simple document that uses only code blocks and images must not ship Mermaid, Chart.js, data-table enhancement, HTML-preview support, or unrelated app code. A site that contains charts on only one page may ship the chart capability once as a shared local site asset, but it must not ship the complete Markdown Explorer application bundle.

The output has zero CDN/runtime network dependency. Third-party packages needed by a selected capability are bundled locally as part of that capability.

### 5.4 HTML preview blocks

HTML previews retain user-authored JavaScript execution inside the existing isolated preview model.

Security requirements:

- preview content remains isolated from the surrounding exported page;
- the existing local-first/network-blocked behavior is preserved;
- no Markdown Explorer bridge tokens or host filesystem privileges are exposed;
- exported preview scripts do not gain access to host APIs.

Sizing requirements:

- the preview iframe grows to the complete rendered content height;
- the outer exported document owns normal vertical scrolling;
- the preview should not show a short internal scrollbar merely because of a low fixed/max height;
- size updates must respond after initial load and after dynamic content changes;
- resize behavior should prefer event/observer-driven updates over continuous polling where practical;
- user-created internal scroll regions inside the preview remain allowed when authored intentionally.

### 5.5 HTML packaging behavior

A single HTML document without explicit supplementary files remains a self-contained `.html` where practical.

When explicit Additional workspace files are selected, the result becomes an **HTML package ZIP** so those resources can remain normal files with preserved relative paths. The Export Center must reveal this before export instead of unexpectedly producing a ZIP.

Multi-document HTML output may also use package/ZIP behavior when required by the existing batch format semantics.

Static Website always produces an offline site package with local pages, local runtime assets, referenced resources, and optional explicit extras.

## 6. PDF Export

### 6.1 Cross-runtime model

Direct PDF generation is a shared export capability for Electron, Tauri, VS Code, and Chromium. The UI must not gate PDF based on `appRuntime === 'desktop'` or any equivalent Electron-only condition.

The shared flow is:

```text
Rendered snapshot
  -> semantic PDF extraction
  -> complex-block visual capture
  -> pagination/layout
  -> PDF bytes
  -> runtime save adapter
```

Electron `webContents.printToPDF` is no longer the architectural requirement. It may be removed if the shared compositor fully replaces it; maintaining two materially different PDF renderers is not desired.

There is no system Print Center/system print flow in the intended UX.

### 6.2 Semantic content

Normal document elements should remain native/selectable/searchable PDF content wherever the chosen PDF library supports them reliably. This includes:

- headings;
- paragraphs and inline emphasis;
- lists;
- links;
- blockquotes;
- normal tables;
- code text;
- document boundaries/page breaks;
- basic metadata.

Text should remain crisp at zoom and usable with normal PDF search/copy workflows.

### 6.3 Complex rendered blocks

Blocks whose appearance depends strongly on browser rendering are handled as atomic visual blocks where necessary. Examples include:

- Mermaid diagrams;
- Chart.js charts;
- interactive HTML previews;
- heavily enhanced data-table/chart states;
- specialized rich media/rendered widgets.

SVG should remain vector when the selected PDF implementation can embed it reliably. Otherwise the renderer captures a sufficiently high-resolution raster representation. The surrounding semantic text remains native PDF text.

### 6.4 Pagination

Pagination is shared logic, not a host-specific print behavior.

Normal semantic content may break naturally across pages. Complex atomic blocks should try to remain together. Oversized blocks may be scaled within a readability threshold and then split/tiled using block-specific logic when necessary rather than being blindly clipped.

The exporter must impose reasonable memory/dimension ceilings for captured bitmaps/canvases so a pathological chart/preview cannot allocate unbounded memory.

### 6.5 Theme and fonts

The PDF compositor receives the same export theme snapshot used by web output.

PDF should preserve the active Markdown Explorer visual identity—colors, typography, spacing, code/table styling, and complex-block appearance—without attempting to reproduce inappropriate screen-only behaviors such as sticky/fixed viewport chrome.

Custom fonts are embedded when exportable and supported. Failure to embed one font should fall back predictably rather than fail the whole export.

### 6.6 Footer removal

The current PDF footer feature is removed completely.

There is no `Markdown Explorer - @the-long-ride` footer, no footer toggle, no footer state/protocol option, and no hidden always-on replacement.

### 6.7 Batch behavior

Separate mode produces one PDF per resolved document.

Merged mode composes one combined PDF with deliberate document boundaries. The preferred path is a single compositor job rather than generating many independent PDFs and merging afterward, unless implementation constraints make the latter demonstrably safer.

Additional workspace files never apply to PDF.

## 7. Export Center UX

### 7.1 Layout hierarchy

The modal becomes a compact job builder with this conceptual order:

```text
Source
Optional additional files
Format / layout / batch options
Export activity
Footer actions
```

Controls consume only the height they require. Export activity fills the remaining modal body.

### 7.2 Primary source controls

Primary sources are mutually exclusive:

- Current document
- Selected documents
- Folder
- Whole workspace

Whole workspace shows a compact resolved-document count and has no document picker.

### 7.3 Selected documents

The existing native checkbox list is replaced by a custom searchable multi-selector.

Each document row contains a switch and compact identifying information. Required controls include:

- search;
- Select all;
- Unselect all;
- switch per row;
- keyboard-accessible navigation where consistent with project patterns.

When search is active, Select all/Unselect all applies to the currently filtered rows. Existing selections outside the filter remain unchanged. Clearing search must preserve prior selection.

### 7.4 Folder selector

The native folder `<select>` is replaced with a custom searchable dropdown.

It displays workspace-relative folder paths and supports:

- search by folder name and full relative path;
- keyboard navigation;
- Enter to select;
- Escape/click-outside to close;
- recursive inclusion of renderable documents beneath the selected folder.

### 7.5 Additional workspace files selector

This section is visible only for HTML and Static Website formats.

It is a searchable custom multi-selector using switch rows plus Select all/Unselect all. It can explicitly include individual files or folders. Folder selection recursively includes its files while preserving relative paths.

The initial selection is empty.

Whole workspace never implicitly selects every repository file. Referenced document assets remain automatic and separate from explicit extras.

Internal/sensitive infrastructure such as `.git` should not be surfaced as a normal extra by default unless existing workspace policy deliberately exposes it.

### 7.6 Format-aware result labeling

The UI must reveal the actual artifact type before export.

Examples:

- `HTML (.html)` for one self-contained HTML artifact;
- `HTML package (.zip)` when explicit extras/package semantics require it;
- `Static Website (.zip)`;
- `PDF (.pdf)` or a clear multi-file result description for separate batch export.

Impossible/inapplicable combinations should be disabled with concise explanation instead of being accepted and rejected only after execution.

### 7.7 Export activity/log panel

The activity panel fills all vertical space remaining between controls and the modal footer.

Layout requirements:

- `flex: 1`-style growth;
- `min-height: 0`-style containment so internal scrolling works;
- internal overflow for large jobs;
- stable empty state before first export;
- no large unused blank region below short result rows.

Entries should expose useful stage/status transitions such as queued, rendering, capturing, packaging, saved, warning, and failed.

For batch jobs, failures identify the source document/resource and failing stage.

## 8. Windows File Explorer Integration

### 8.1 File menu behavior

For `.md` and `.mdx`, install two file verbs under the existing Markdown context-menu installer choice:

1. **Open in Markdown Explorer** — existing single-file behavior.
2. **Open in Markdown Explorer with this folder** — open the clicked file's parent folder as the workspace, then immediately open/focus the clicked file.

The existing wording `Open with Markdown Explorer` should be normalized to `Open in Markdown Explorer` so both actions read as a coherent pair.

No additional installer checkbox is required. The existing `.md/.mdx context menus` option installs/removes both file verbs together.

Folder context-menu behavior remains separately controlled by the existing `Open Folder in Markdown Explorer` installer choice.

### 8.2 Launch argument

Use an explicit launch mode rather than inferring intent from a normal file path.

Conceptual invocation:

```text
MarkdownExplorer.exe --open-with-folder "C:\repo\docs\guide.md"
```

The application, not NSIS, resolves the parent folder and normalizes paths.

The existing invocation remains valid:

```text
MarkdownExplorer.exe "C:\repo\docs\guide.md"
```

and keeps single-file behavior.

### 8.3 Structured external-open request

External open handling should carry intent, not only a bare path. Conceptually the runtime/UI contract represents:

- file open;
- folder open;
- file-with-parent-workspace open.

For file-with-parent-workspace, the request includes enough information to bind the parent workspace and then focus the original file.

This structured model must work both on first launch and when Markdown Explorer is already running.

### 8.4 Already-running instance

When the command targets an already-running instance, the app should:

1. bring the existing window to the foreground;
2. load/switch to the clicked file's parent folder workspace;
3. wait until that workspace can resolve the target file;
4. select/open the clicked file;
5. preserve the normal explorer/sidebar state for the workspace.

This sequence prevents a race where the target file is opened before the new workspace scan is ready.

### 8.5 Deterministic parent semantics

The new shell command always uses the immediate parent directory. It does not search upward for `.git`, `package.json`, or another inferred project root.

For:

```text
C:\repo\docs\guides\install.md
```

the workspace is exactly:

```text
C:\repo\docs\guides
```

and `install.md` becomes the active file.

Electron and Tauri installers must install and uninstall equivalent registry verbs.

## 9. Error Handling

Export failures should be reported at the smallest safe scope.

For separate multi-document export, one failed document does not erase already successful outputs. The activity panel reports the file and stage.

For artifact types that must be internally complete—such as a merged PDF or packaged Static Website—the final artifact should not be saved as successful if a required document fails. Recoverable warnings such as a missing optional referenced asset may be represented explicitly, but required content must not disappear silently.

An explicitly selected Additional workspace file is required input. If it cannot be read, packaging fails instead of pretending the requested extra was included.

Error messages should distinguish source resolution, document rendering, complex-block capture, asset loading, packaging, and save-adapter failures.

## 10. Security and Privacy

The export subsystem must not accidentally grant exported content host capabilities.

Requirements:

- no host IPC bridge tokens in exported HTML;
- no privileged filesystem APIs exposed to exported preview scripts;
- HTML preview network blocking remains active;
- no CDN dependency for Markdown Explorer runtime assets;
- additional-file resolution remains workspace-contained;
- symlink/junction escape is rejected;
- Whole workspace only includes renderable documents and their required assets, not arbitrary repository files;
- explicit extras remain user-selected;
- internal directories such as `.git` are not normal selectable extras by default.

## 11. Performance and Resource Management

Whole-workspace export must use bounded work rather than rendering the entire workspace simultaneously.

A recommended flow is:

1. resolve source metadata;
2. build a stable ordered document list;
3. render/capture documents with limited concurrency;
4. release large temporary canvases/images after each document;
5. accumulate shared feature/asset hashes incrementally;
6. package once the required graph is complete.

Runtime bundles are deterministic for a given feature set so output can be tested, cached, and deduplicated predictably.

Complex visual capture must enforce size/memory ceilings and use scaling/tiling rules for oversized content.

## 12. Testing Strategy

Implementation follows test-driven development around shared layers before host adapters.

Required automated coverage includes:

- Current / Selected / Folder / Whole workspace source resolution;
- Whole workspace includes all Markdown Explorer-renderable documents recursively;
- search plus filtered Select all / Unselect all semantics;
- selection persistence when search filters change;
- folder recursive resolution;
- Additional workspace files path preservation and folder expansion;
- referenced-asset and explicit-extra deduplication;
- workspace containment / symlink-junction escape rejection;
- HTML artifact switching from `.html` to ZIP when explicit extras require it;
- feature-manifest detection and absence of unused Mermaid/Chart.js/etc. runtime code;
- offline web output with no CDN dependency;
- active theme token/style capture;
- exported page vertical scrolling;
- HTML preview auto-height updates after initial and dynamic content changes;
- HTML preview network isolation;
- exported code Copy and expand/collapse;
- Mermaid modal/view behavior;
- image/media modal behavior;
- data-table to chart behavior and chart modal behavior;
- PDF semantic text extraction;
- PDF complex-block visual fallback/vector path where supported;
- PDF pagination and oversized-block handling;
- separate/merged PDF behavior and naming;
- complete removal of PDF footer behavior;
- external-open parsing for normal file, normal folder, and `--open-with-folder`;
- structured external-open delivery to an already-running Electron/Tauri instance;
- parent-workspace-then-focus ordering;
- Electron and Tauri installer registry verbs and uninstall cleanup;
- existing portable output-path collision behavior.

Manual/export fixtures should include:

- one document exercising code controls, Mermaid, images, HTML preview, data table, charts, and chart modal behavior;
- one multi-folder workspace exercising Whole workspace and Additional workspace files;
- representative light/dark/custom-theme exports;
- a large/oversized diagram or chart for PDF capture/pagination validation.

Before completion, run the full repository test/build matrix plus targeted Electron/Tauri packaging checks where practical. Generated HTML/Static Website and hybrid PDF artifacts should also be manually inspected.

Existing repository source-file LOC and coverage contracts remain in force. Export Center UI, feature detection, asset resolution, PDF composition, web runtime features, and shell-launch parsing should remain split into focused modules instead of growing one large controller/component.

## 13. Scope Boundaries

### In scope

- shared feature-manifest export pipeline;
- HTML fidelity/interactivity fixes;
- HTML preview auto-height behavior;
- fully offline export runtime packaging;
- hybrid cross-runtime PDF generation;
- removal of PDF footer support;
- Whole workspace source mode;
- Additional workspace files for HTML/Static Website;
- searchable custom document/folder/extra selectors with switches and bulk actions;
- Export activity panel layout/progress behavior;
- Windows `.md/.mdx` file-with-parent-workspace command for Electron and Tauri installers;
- corresponding tests/fixtures/documentation.

### Out of scope

- treating Whole workspace as a full source repository archive;
- arbitrary PDF attachments for Additional workspace files;
- CDN-based export dependencies;
- searching upward for an inferred project root in the new Windows command;
- exporting host-only Markdown Explorer features into static pages;
- adding a second installer checkbox solely for the new file-with-folder command;
- system print-center based PDF export as the required path.

## 14. Success Criteria

The design is successful when all of the following hold:

1. A document exported from any supported runtime has the same shared HTML/PDF generation behavior; only saving differs by runtime.
2. Exported HTML visually follows the active Markdown Explorer theme and remains vertically scrollable.
3. HTML preview blocks expand to their complete rendered height and retain sandboxed interaction.
4. Copy, expand/collapse, Mermaid/image modal viewing, data-table chart switching, and chart modal behavior remain functional in offline web output when those features are present.
5. Exported JavaScript/CSS contains only capabilities required by the selected documents/site, not the complete application bundle.
6. PDF export is available across Electron, Tauri, VS Code, and Chromium without a system print dialog and keeps normal text searchable/selectable.
7. Complex PDF blocks preserve visual fidelity through vector/visual capture paths.
8. PDF footer UI and implementation are absent.
9. Whole workspace exports all renderable documents recursively, while unrelated raw files remain excluded unless explicitly selected for HTML/Static Website output.
10. Export Center uses searchable custom selectors, switches, Select all/Unselect all, and a results panel that fills the remaining modal area.
11. Windows users can choose between single-file open and parent-folder-workspace open, with the clicked file immediately focused in the latter mode.
12. The full repository quality gates and targeted export/shell tests pass before the implementation is declared complete.
