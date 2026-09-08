---
timestamp: '2026-09-07T18:00:00+07:00'
name: Current Application State
topic: Unreleased synchronized product and runtime snapshot
document_type: reference
status: active
ui_spec: true
parent_docs:
- ../README.md
related_docs:
- 03-settings-catalog.md
- 04-shortcut-catalog.md
- 10-localization-catalog.md
- ../04-runtimes/06-runtime-parity.md
- ../03-features/12-settings-preferences-import-export.md
- ../03-features/15-localization-welcome-onboarding.md
- ../../git-history-diff.md
- ../../use-cases/compare-document-history.md
source_scope:
- ../../../ui/src
- ../../../electron
- ../../../tauri
- ../../../vscode
- ../../../chromium-xtension
- ../../../website-app
test_scope:
- ../../../tests/node/localization-settings-doc-sync-contract.test.mjs
- ../../../tests/manifest/editor-git-split-coverage-manifest.ts
runtime_scope:
- electron
- tauri
- vscode
- chromium
- web
keywords:
- current state
- unreleased
- settings
- typography
- localization
- shortcuts
- runtime parity
- editing
- git history
- split view
---

# Current Application State

This reference is the synchronized **Unreleased** snapshot of Markdown Explorer as of 2026-09-07. Feature, runtime, protocol, and catalog documents remain the normative detailed specifications; this page is the compact cross-product map used to detect documentation drift.

## Supported runtimes

Markdown Explorer shares the renderer across **Electron**, **Tauri**, **VS Code**, **Chromium**, and the website/browser-file runtime. The renderer capability-gates native actions rather than pretending every host owns the same filesystem, updater, window, editor, font, zoom, or Git APIs.

| Capability | Electron | Tauri | VS Code | Chromium / Web |
|---|---|---|---|---|
| Workspace/folder browsing | Native desktop bridge | Native Tauri bridge | VS Code workspace APIs | Browser File System Access API where available |
| Local Markdown Inline Edit / Plain editing | Yes | Yes | Yes | Yes when writable file permission exists; otherwise read-only |
| Conflict-protected local save | Yes | Yes | Yes | Yes when writable file permission exists; otherwise read-only |
| Open current document in external editor | `Ctrl+E`, action in More Actions | `Ctrl+E`, action in More Actions | `Ctrl+Alt+E`, icon beside More Actions | Not exposed |
| Two-pane split document view | Yes | Yes | Yes | Yes |
| Local Git document history | Installed local Git | Installed local Git | Installed local Git | Unsupported; no local process execution |
| Source / Rendered Diff | Yes | Yes | Yes | Yes for local source/conflict comparisons; Git history unavailable |
| Typography font sources | system fonts and imported `.ttf`/`.otf` | system fonts and imported `.ttf`/`.otf` | system fonts and imported `.ttf`/`.otf` | Imported `.ttf`/`.otf`/`.woff`/`.woff2` via IndexedDB & FontFace API |
| App-owned zoom | Yes | Yes | No; host/native zoom | No; host/native zoom |
| Update installation | Markdown Explorer desktop updater | Signed Tauri updater | VS Code owns installation; Markdown Explorer checks/reports only | Store/deployment owned |

VS Code imported fonts are copied to extension global storage and served to the webview with a webview-safe URI. Chromium extension and Web demo store imported font files in IndexedDB (`markdown-explorer-browser-fonts`) and activate them via blob URLs and the FontFace API. They customize Markdown Explorer only and do not mutate host editor or browser settings.

## Markdown editing, split view, and Git history

### Local Markdown editing

- Rendered Markdown remains the default document mode.
- **Inline Edit** edits source-backed Markdown sections with native React/browser editing controls; **Plain** edits the complete raw Markdown source.
- No third-party editor framework was added. Editing uses the existing parser/renderer and shared document-session state.
- Each editable document session keeps a current working `source`, last confirmed `persistedSource`, save state, host revision token, and any active external-change conflict.
- Dirty state is derived from source differences. Historical Git content is held outside document sessions and cannot mark a document dirty.
- `saveDocument` sends the expected host revision token. If disk content changed since the observed revision, the host returns a conflict instead of silently overwriting it.
- Conflict resolution offers Reload, Compare, and explicit keep-mine/force-save behavior. Compare uses the same local Diff UI and does not require a Git repository.
- Unsaved-change guards protect destructive tab/workspace/window actions and only commit the destructive operation after save/discard succeeds or the user explicitly discards.
- Chromium/Web editing is capability-based: writable File System Access handles can save; read-only or virtual sources keep editing controls unavailable.

### Split document view

- Split view is horizontal, side-by-side, and limited to two panes in the first release.
- Each pane owns its own document identity, mode, scroll state, and active-pane focus.
- Supported pane modes are **Rendered**, **Inline Edit**, **Plain**, **Revision**, and **Diff** when the associated capability/data exists.
- Editable source remains shared per document session, so viewing or editing the same document from another pane does not create competing working copies.
- Revision and Diff modes are read-only. Diff panes synchronize their comparison scrolling; ordinary document panes keep independent scroll positions.
- Split mode does not expand tab count semantics: the pane state references existing/openable document identities and can be swapped, moved, or closed independently.

### Local Git history and diff

- **More Actions → History** opens the document History workflow. Git capability/history loading is lazy; normal navigation never starts Git or enumerates commits.
- Electron, Tauri, and VS Code use the user's installed `git` executable. Chromium and Web explicitly report `unsupported-runtime` and never attempt process execution.
- All Git operations are read-only and repository-contained. Hosts use `execFile`/argument arrays or Rust `std::process::Command`; they do not construct shell command strings from paths or revisions.
- Full object IDs and requested repository paths are validated before historical content is read.
- Document history follows rename records backwards so older snapshots keep the historical path that Git reported for that revision.
- **View revision** renders a historical snapshot read-only. **Compare with current**, **Working copy**, and two-revision comparison feed complete sources to the shared diff model.
- **Source Diff** uses the dependency-free Myers line-diff implementation with explicit Added/Removed/Unchanged states. **Rendered Diff** renders both complete Markdown documents and highlights source-backed changed blocks; it does not render malformed partial Markdown hunks.
- Git failures do not affect normal Markdown reading, editing, saving, split view, or non-Git conflict comparison.

See [Local Git History and Diff](../../git-history-diff.md) and [Compare a Markdown document with its history](../../use-cases/compare-document-history.md).

## Window, shell, and focus behavior

- Restored Electron and Tauri windows enforce a **800 px** minimum width; host-managed browser/extension windows keep host constraints.
- Desktop Settings uses `width: min(800px, 100vw - 32px)` so it stays bounded on narrow windows.
- Focus mode is an application-layout state, not an OS minimize operation. Entering focus mode hides the normal application chrome while retaining a dedicated exit control; toggling it restores the previous shell state.
- Desktop Tabs and Focus views preserve workspace/document navigation, content-tab state, aliases, and scroll memory according to the desktop workspace specifications.
- More Actions uses the compact menu-item density and splits toggle rows into discrete `menuitem` and `switch` elements. Desktop fullscreen uses the dedicated fullscreen icon.
- Update attention dots across navigation and action triggers are standardized to `--update-attention-dot-size: 11px`.
- **Reset zoom** is Markdown Explorer-owned only in Electron/Tauri desktop and defaults to **`Ctrl+Alt+Z`**. VS Code, Chromium, and Web use native host zooming and expose no Markdown Explorer reset-zoom action.

## Settings and preferences

Settings is organized into **Appearance**, **Typography**, **Theme Style**, **Keyboard Shortcuts**, and **Update & Backup**, with icons in the navigation rail and a description under every section title.

### Appearance

- Appearance renders Color Mode and preference controls directly under the section header.
- There is **no secondary `View Preferences` heading**.
- Existing view controls, including maximum pinned items, keep their persisted settings and localized descriptions.

### Typography

Electron, Tauri, VS Code, and Chromium/Web expose role-based Typography for **App UI, Body, Heading, Quote, Code, and Mermaid**. Each role stores source/family/import ID, style, and explicit numeric weight.

- System and imported fonts are searchable; `.ttf`, `.otf`, `.woff`, and `.woff2` imports bind to the initiating role's draft. Applying the Mermaid role re-renders visible Mermaid diagrams in the current document.
- `FontSearchDropdown` calculates boundary-aware positioning against scroll containers and viewport edges to flip upward or downward flush against trigger buttons without gaps or clipping.
- Typography's header and Apply action remain fixed while the role list owns its scrolling region.
- The Apply action is disabled until the draft differs from persisted bindings.
- Applying opens a confirmation dialog listing only changed roles as old → new values; Cancel leaves the draft untouched.
- The action-level circle-check Apply icon is a component-owned **14 px × 14 px** box in every theme. The dialog's decorative confirmation icon is intentionally larger.
- Reset/remove/import actions share the Settings outline-button behavior and tooltip conventions.

### Theme Style and Theme Remix

- Theme lists stay attached to their trigger with collision-aware vertical placement (opening flush downward or upward without mid-air gaps), display at most seven visible rows, and scroll beyond that limit.
- Theme Style content is centered within its section.
- Custom Theme Remix supports layout/density/background/color controls, custom-theme limits, and localized status feedback.
- Theme-specific CSS may change colors/radii but must not override component-owned action-icon geometry.

### Keyboard Shortcuts

- Shortcut controls show active bindings with shared keycap rendering in tooltips and Settings.
- Shortcut enabling/disabling utilizes the shared accessible `SwitchButton` component (`app-switch`).
- The Settings close tooltip renders **Esc as the shared keycap component**, not literal `(Esc)` text.
- The legacy external **Edit** action remains runtime-specific: Electron/Tauri default to `Ctrl+E`; VS Code defaults to `Ctrl+Alt+E`; Chromium/Web expose no external-editor action. This is separate from the in-app Rendered/Inline Edit/Plain mode controls.
- Save uses the shared document-session save action/shortcut only when the current document is writable; read-only historical Revision/Diff views never expose Save.
- Reset zoom defaults to `Ctrl+Alt+Z` only on Electron/Tauri desktop.
- Runtime normalization removes unsupported imported bindings instead of exposing dead actions.

### Update & Backup

- Desktop/Tauri can check, download, defer, restart/apply, and skip notification for one normalized release version according to updater capabilities.
- VS Code can check/report a newer Markdown Explorer extension version, but Markdown Explorer does not download or install it; VS Code owns extension updates.
- The update-available dialog uses the glow icon, shows the changelog link below the version in the header, and uses shared outline actions for Later/Skip.
- Import/Export JSON remains the settings portability mechanism for supported persisted preferences.

## Documents, tables, and navigation

- Markdown/MDX is the core document surface, with local rendering, code blocks, math, Mermaid, media handling, links, heading navigation, table of contents, collapsible sections, local editing where writable, and read-only historical/diff modes where supported.
- Supported file/conversion behavior is defined by the Supported Files and Conversion catalog and is capability-gated by runtime.
- Sidebar navigation includes Files, Search, and opt-in Bookmarks with filtering, sorting, pinning, cursor-mode keyboard navigation, current-file location, and workspace scoping. Sidebar navigation ARIA text and pin/sort/search status labels come from the active locale without component-owned English fallbacks.
- The per-row pinned-item indicator uses the stroke-only `PinIcon` (Lucide thumbtack, size 12). Both unpin affordances — the per-item context-menu entry and the toolbar Clear Pins button — render the same `UnpinIcon` (Lucide thumbtack + diagonal slash overlay); `ClearPinsIcon` delegates to `UnpinIcon` so the slash stays in sync without SVG-path duplication.
- Search covers the current document/current workspace and desktop cross-tab modes where supported; status labels and accessibility text are localized.
- Desktop document tabs preserve active document and scroll state; context actions and their shortcut labels use translated copy. Recent-workspace `last opened` values use `Intl.RelativeTimeFormat`/`Intl.DateTimeFormat` with the selected application locale.
- The Media Modal viewer exposes a light/dark theme toggle in its footer toolbar that re-renders the displayed Mermaid diagram with the new theme palette while preserving the current zoom/pan transform. The toggle's keyboard shortcut (`toggleTheme`) fires through the modal's keyboard gate; all other global shortcuts remain muted while the modal is open.

### Interactive tables, filters, and charts

Interactive tables in rendered Markdown and delimited files support sorting, searching, column value filtering, text wrapping, column visibility management, and rich chart visualizations:

- **9 Chart view types**: **Table**, **Bar Chart**, **Horizontal Bar Chart**, **Line Chart**, **Area Chart**, **Scatter Chart**, **Radar Chart**, **Polar Area Chart**, **Pie Chart**, and **Doughnut Chart**.
- **Scatter Charts**: Require at least two visible numeric columns; the first numeric column is mapped to the X-axis while subsequent numeric columns become independent Y series.
- **Column Visibility**: Per-table **Columns** dropdown menu with switch toggles for each column, a **Show all** action, and a guard preventing the last visible column from being hidden.
- **Dynamic Sizing**: The table view selector intrinsically sizes to the widest localized option via an offscreen sizer element.
- **Fullscreen Chart Modal Viewer**: Click-to-enlarge chart modal with **50% to 1000% continuous zoom**, mouse drag & touch pan, **Fit to Screen**, **Reset Zoom**, modal type switcher, **Copy as Image** (raster PNG clipboard copy with font rendering), and **Save as Image (.PNG)** via native host dialog (`saveChartPng` on Tauri) or browser download.
- **CSP Event Delegation**: Chromium extension delegates table column toggle and view selection clicks in `useContentEffects` and `SearchDocumentPreview` to comply with Manifest V3 Content Security Policy restrictions.

## Export Center and Scope View

### Export Center
- Modal Export Center supports **HTML**, **Static Website (ZIP)**, and client-side hybrid **PDF** output across all runtimes.
- **Source Selection**: Current document, Selected documents (searchable multi-select with fill-height scrolling), Folder, or Whole workspace.
- **Layout Modes**: Clean Document-only layout or Full Explorer interactive viewport shell (with tree, TOC, search, and theme switcher).
- **Batch Modes**: Separate standalone files or single merged document with collision-safe anchor IDs.
- **Offline Runtime Bundles**: Bundles isolated feature runtimes for core interactions, sandboxed HTML iframe previews with automatic height sync, media viewer, and table/chart interactions.
- **Zero-Dialog PDF**: PDF generation uses `pdfmake` for semantic text and high-res vector/image capture for complex visual blocks, saving directly via `saveExportFile` without opening the system print center.

### Scope View Modal
- Deep inspection modal (`ScopeViewModal`) for exploring linked documents without disrupting main editor or content tab state.
- **History Stack**: 10-step isolated history with animated depth segment indicators, Prev/Next navigation, and max-depth guards.
- **Open File Action**: Dedicated **Open file** header button (`OpenFileIcon`) navigates the main workspace to the previewed document and closes the modal.
- **Navigation Parity**: Full support for keyboard shortcuts (`Alt+Left`/`Alt+Right`, `BrowserBack`/`BrowserForward`, `Escape`) and hardware mouse back/forward buttons (mouse buttons 3 and 4).

## Workspace Insights and Wiki Links

### Workspace Insights
- Workspace-wide analysis and reporting panel accessible via More actions or `Ctrl+Alt+I` (`toggleWorkspaceInsights`).
- **6 Core Views**:
  - **Gallery**: Visual grid of all referenced media (images, diagrams, video, audio, documents) with Mermaid diagram thumbnail rendering, category filtering, search, and external preview safety.
  - **Links**: Workspace reference auditing surfacing broken links, missing files, invalid anchors, outside-workspace targets, dynamic references, ambiguous Wiki Links, and optional host-backed external HTTP checks.
  - **Lint**: Structural Markdown diagnostics (heading hierarchy, frontmatter integrity, table column matching, list formatting) with granular suppression (finding, rule, or path-rule).
  - **Duplicates**: Exact duplicates, repeated sections, and near-duplicate passage detection with configurable percentage threshold and suppression.
  - **Graph**: Interactive document relationship graph with backlink traversal, 1st/2nd degree neighborhood filtering, search, continuous zoom, and fullscreen inspection.
  - **Related**: Deterministic related document ranking powered by direct links, shared tags, shared headings, title terms, and terminology overlap.
- **Tuning & Customization**: Granular settings (Scope & Network, Limits & Tuning, Pattern Filters) supporting global defaults and per-workspace overrides with local derived caching.

### Wiki Links and Transclusion
- First-class support for Wiki Link syntax (`[[Target]]`, `[[Target#Heading]]`, `[[Target|Alias]]`, `[[#Heading]]`, and relative paths `[[./Note]]`).
- Embed syntax (`![[Note]]`, `![[Note#Heading]]`, `![[image.png]]`) for rich transclusion with recursion cycle detection and depth guards.
- Automatic anchor scrolling with collapsible parent heading auto-expansion upon arrival.

## Platform and shell integrations

- **Universal Hardware Mouse Navigation**: Mouse buttons 3 and 4 (Logitech and standard mice) navigate back and forward in document history and Scope View modal via `attachMouseHistoryNavigation` with 40 ms burst deduplication.
- **macOS Native Edit Menu & Tray**: Restored standard AppKit Edit application menu (Undo, Redo, Cut, Copy, Paste, Select All) on macOS Electron desktop; normalized tray icon to a 16×16 template `NativeImage`.
- **Windows File Explorer Context**: Structured `externalOpenRequest` host message (`file`, `folder`, `file-with-parent-workspace`) enables "Open with Markdown Explorer" to activate parent folder workspaces directly.

## Onboarding, welcome, and localization

Markdown Explorer currently ships **nine supported locales**: English, Vietnamese, French, Spanish, Chinese, Norwegian, Japanese, Korean, and Russian.

The localization boundary covers normal visible text plus accessibility labels, placeholders, dialog copy, tooltip copy, status feedback, shortcut action names, onboarding/terms, workspace selection, Theme Remix, Welcome/Tips, initial loading/scanning states, sidebar navigation, recent-workspace time formatting, search On/Off state, Settings shell text, in-app editor controls, split-view actions, Git History states/actions, and Source/Rendered Diff labels. The audited translation domains are `ui`, `terms`, `onboarding`, `workspaceSelection`, `themeRemix`, and `rendererUi` in `auditedUiTranslations.ts`, while established feature-specific groups remain in the main translation catalog. `rendererUi` also travels through Markdown rendering so table filtering, row counts, wrapping, column visibility, chart switching, chart modal viewer actions, copy feedback, code/preview controls, and video/YouTube fallback labels stay in the selected locale after DOM updates.

The dependency-free localization contract guards audited user-facing literals across React and generated Markdown/DOM code so new component-owned English fallbacks are caught before release. Technical identifiers remain intentionally literal when translation would change their meaning: commands, key IDs, CSS variables, URLs, `chrome://flags`, `brave://flags`, `File System Access API`, file extensions, and product/project brand names.

## Persistence and safety

- Settings, recent workspaces, themes, bookmarks, tabs, and runtime-owned handles use the persistence layer documented in the Storage Catalog.
- Editable document sessions and split/history view state are runtime UI state; historical source is not persisted into writable document state.
- Browser file handles stay browser-owned; desktop filesystem access stays behind native bridges.
- External navigation and local HTML/media access follow the runtime security boundaries instead of granting arbitrary renderer filesystem access.
- Imported font files are managed within the owning desktop/VS Code runtime or browser IndexedDB rather than exposing unrestricted renderer paths.
- Git history is read-only and uses structured process arguments on capable hosts; no Git mutation operation is exposed by the shared protocol.

## Documentation synchronization rule

When an implementation change alters a capability, default shortcut, Settings behavior, runtime difference, persisted field, translation boundary, or operational limit, update the matching feature/runtime/reference specification **and this current-state snapshot in the same change**. `CHANGELOG.md` records the user-visible result under **Unreleased** until a version is cut.

## Primary source-of-truth documents

- [Local Git History and Diff](../../git-history-diff.md)
- [Compare a Markdown document with its history](../../use-cases/compare-document-history.md)
- [Runtime Parity](../04-runtimes/06-runtime-parity.md)
- [UI-to-Host Command Catalog](01-ui-to-host-command-catalog.md)
- [Host-to-UI Message Catalog](02-host-to-ui-message-catalog.md)
- [Tables, Filters, Sorting, and Charts](../03-features/08-tables-filters-charts.md)
- [Settings and Preferences](../03-features/12-settings-preferences-import-export.md)
- [Settings Catalog](03-settings-catalog.md)
- [Keyboard Shortcut Catalog](04-shortcut-catalog.md)
- [Localization Catalog](10-localization-catalog.md)
- [Localization, Welcome, and Onboarding](../03-features/15-localization-welcome-onboarding.md)
- [Source Traceability Index](12-source-traceability-index.md)

