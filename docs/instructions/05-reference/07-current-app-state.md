---
timestamp: '2026-09-17T00:00:00+07:00'
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
- ../03-features/03-sidebar-tree-and-scope.md
- ../03-features/04-content-tabs-and-document-shell.md
- ../../git-history-diff.md
- ../../superpowers/specs/2026-09-17-pr48-as-built-sync.md
source_scope:
- ../../../ui/src
- ../../../electron
- ../../../tauri
- ../../../vscode
- ../../../chromium-xtension
- ../../../website-app
test_scope:
- ../../../tests/node/localization-settings-doc-sync-contract.test.mjs
- ../../../tests/node/repository-history-pagination-contract.test.mjs
- ../../../tests/node/split-file-drag-drop-contract.test.mjs
- ../../../tests/node/focus-drag-region-contract.test.mjs
- ../../../tests/manifest/editor-git-split-coverage-manifest.ts
- ../../../tests/unit/ui/history
- ../../../tests/unit/ui/split-view
runtime_scope:
- electron
- tauri
- vscode
- chromium
- web
keywords:
- current state
- unreleased
- version 1.6.9
- settings
- typography
- localization
- shortcuts
- editing
- repository history
- split view
---

# Current Application State

This reference is the synchronized **Unreleased** snapshot of Markdown Explorer as of 2026-09-17. The PR #48 feature branch targets application version **1.6.9** so it remains distinct from the separate 1.6.8 hot-fix line. Detailed feature/runtime documents remain normative; this page is the compact cross-product map used to detect documentation drift.

## Supported runtimes

Markdown Explorer shares the renderer across **Electron**, **Tauri**, **VS Code**, **Chromium**, and the Website/browser-file runtime. The renderer capability-gates native actions rather than pretending every host owns the same filesystem, updater, window, editor, font, zoom, or Git APIs.

| Capability | Electron | Tauri | VS Code | Chromium / Web |
|---|---|---|---|---|
| Workspace/folder browsing | Native desktop bridge | Native Tauri bridge | VS Code workspace APIs | Browser File System Access API where available |
| Local Markdown Inline Edit / Plain editing | Yes | Yes | Yes | Yes when writable file permission exists; otherwise read-only |
| Conflict-protected local save | Yes | Yes | Yes | Yes when writable file permission exists; otherwise read-only |
| Open current document in external editor | `Ctrl+E`, More Actions | `Ctrl+E`, More Actions | `Ctrl+Alt+E`, icon/More Actions | Not exposed |
| Two-pane split view with pane-owned tabs | Yes | Yes | Yes | Yes |
| Local Git document history | Installed local Git | Installed local Git | Installed local Git | Unsupported; no local process execution |
| Paged/searchable repository History | Installed local Git | Installed local Git | Installed local Git | Unsupported; no local process execution |
| Read-only repository revision workspace | Installed local Git | Installed local Git | Installed local Git | Unsupported |
| Source / Rendered Diff | Yes | Yes | Yes | Yes for non-Git/local comparisons |
| Typography font sources | system fonts and imported files | system fonts and imported files | system fonts and imported files | imported browser fonts |
| App-owned zoom | Yes | Yes | No; host/native zoom | No; host/native zoom |
| Update installation | Markdown Explorer desktop updater | Signed Tauri updater | VS Code owns installation; app checks/reports only | Store/deployment owned |

VS Code imported fonts are copied to extension global storage and served to the webview with a safe URI. Chromium/Web store imported font files in IndexedDB and activate them with the FontFace API. Typography exposes system fonts and imported fonts where the runtime supports them.

## Markdown editing

- Rendered Markdown remains the default mode.
- `markdownEditingEnabled` defaults to **false**.
- The internal full-source Markdown editor uses locally packaged **CodeMirror 6**. CodeMirror owns cursor/selection/editor keymaps and local editor history; the Markdown Explorer document session remains authoritative for working source, dirty state, revision-token save, conflicts, persistence, and split synchronization.
- The formatting toolbar covers bold, italic, headings, quote, inline/fenced code, links, bulleted/numbered/task lists, tables, undo/redo, and Preview.
- On a live capable native/editor runtime, **Edit** remains available when internal Markdown editing is disabled and routes to the existing external/native editor. When internal editing is enabled it opens the in-app editing mode.
- Save sends the last observed revision token. External disk changes produce a conflict rather than a silent overwrite. Reload, Compare, and explicit keep-mine/force-save remain user-controlled.
- Unsaved-change guards protect destructive tab/workspace/window operations.
- Historical Git Revision, repository snapshot, and Diff views are read-only and expose neither internal Edit, external Edit, nor Save.

## Split document view

- Split view is horizontal, side-by-side, and limited to two panes.
- Each pane owns its own `tabs`, `activeTabPath`, document identity, mode, scroll state, and focus state.
- Navigation opens/activates a tab only in the focused pane when tabs are enabled; when tabs are disabled it replaces only the focused pane's file.
- Closing split view preserves/promotes the **currently focused pane** and that pane's tab strip instead of always retaining the former left pane.
- File context menus expose **Open in Split View** where valid.
- File rows use `application/x-markdown-explorer-file` with a text fallback for drag/drop. Dropping onto a split pane activates and opens into exactly that pane; dropping into the unsplit content area uses normal navigation.
- Editable source remains shared per document session, so two panes showing the same live file never create competing working copies.
- Document-scoped render revisions isolate expensive pane rendering. Editing, activating, or scrolling one pane must not remount an unrelated opposite-pane document body.
- Ordinary wheel/trackpad scrolling remains local to the pane during the interaction and is persisted at lifecycle boundaries rather than dispatching global application state on every scroll event.
- Revision and Diff modes are read-only.

## Local Git history and repository snapshots

- **More Actions → History** expands/selects the repository **History** sidebar. Document-specific revision/diff workflows remain available separately.
- Git capability/history loading is lazy; ordinary navigation never starts Git or enumerates commits.
- Electron, Tauri, and VS Code use the installed local Git executable with structured argument arrays / `std::process::Command`. Chromium/Web report `unsupported-runtime` and never start a local process.
- Repository History initially requests **50 commits** and loads older pages with `offset = loaded count`. Native/editor hosts map offset to Git `--skip=<offset>` and page size to `-n <limit>`.
- Pages append in order, de-duplicate by full OID, and a short page marks exhaustion.
- Commit search is case-insensitive across full SHA, short SHA, author, and subject. If a query has no match in loaded commits, additional pages can load until a match appears or history is exhausted.
- Commit rows preserve merge parents, refs/decorations, exact `HEAD`, and continuous graph lanes.
- Selecting **View workspace at this commit** creates an isolated read-only repository view without checkout, reset, branch switch, index mutation, or working-tree mutation.
- Revision Files shows normal document-eligible paths: Markdown/MDX and TXT plus convertible document types only when document conversion is enabled. Arbitrary source files such as `.ts` are filtered out.
- Revision workspace search reads historical text sources and never sends synthetic `revision://` paths through live filesystem navigation/write routes.
- Persisted revision selection is per-workspace. A saved OID is not discarded merely because it is absent from the first 50-commit page; validation may load older pages.
- **Back to current HEAD** clears repository-view/persistence state only and reveals the already-mounted live tabs, split panes, dirty sessions, and scroll positions.
- Git adapters remain read-only: stage, commit, checkout, restore, reset, stash, branch, switch, merge, and rebase are outside the protocol.

See [Local Git History and Diff](../../git-history-diff.md).

## Window, shell, and Focus behavior

- Restored Electron and Tauri windows enforce an **800 px** minimum width; host-managed browser/extension windows keep host constraints.
- Desktop Settings uses a bounded responsive width so it remains usable on narrow windows.
- Focus mode hides normal application chrome while preserving mounted workspace/document state and a dedicated exit control.
- Electron/Tauri Focus mode retains a thin native draggable body surface. Interactive Focus controls are `no-drag`.
- Tauri's fullscreen guard remains authoritative: fullscreen Focus must not become draggable through the application surface.
- Breadcrumb/header layout is content-sized rather than stretching across unused header width.
- Reset zoom is Markdown Explorer-owned only in Electron/Tauri and defaults to **`Ctrl+Alt+Z`**. VS Code, Chromium, and Web leave zoom to the host.

## Settings and preferences

Settings is organized into **Appearance**, **Features**, **Typography** (where supported), **Theme Style**, **Keyboard Shortcuts**, and **Update & Backup**, with icons in the navigation rail and descriptions under section titles.

### Appearance

- Appearance renders Color Mode and view preferences directly under the section header, **without a secondary View Preferences heading**.
- Desktop view mode remains an Appearance control.

### Features

- Feature controls include sidebar labels, file tabs, bookmarks, Workspace Insights, History Sidebar, Markdown Editing, runtime-supported document conversion, HTML preview, CSV preview, and related capabilities.
- `historySidebarEnabled` defaults to true but the actual History tab is capability-gated by `getGitCapability`.
- `markdownEditingEnabled` defaults to false.

### Typography

Electron, Tauri, VS Code, and Chromium/Web expose role-based Typography for App UI, Body, Heading, Quote, Code, and Mermaid.

- System/imported font sources are searchable where available.
- Applying typography updates only changed role bindings and confirms before persistence.
- Action-level Apply icons keep a fixed 14 px component-owned box independent of theme.
- Imported font formats include runtime-supported `.ttf`, `.otf`, `.woff`, and `.woff2` paths.

### Keyboard shortcuts

- Active bindings use shared keycap rendering in tooltips and Settings.
- The legacy external Edit action remains runtime-specific: Electron/Tauri default to `Ctrl+E`; VS Code defaults to `Ctrl+Alt+E`; Chromium/Web expose no external-editor action.
- Save is enabled only for a writable live document session.
- Reset zoom defaults to `Ctrl+Alt+Z` only on Electron/Tauri.

### Update & Backup

- Desktop/Tauri can check, download, defer, restart/apply, and skip a normalized release version according to updater capability.
- VS Code checks/reports but delegates installation to VS Code.
- Import/Export JSON remains the settings portability mechanism for supported persisted preferences.

## Documents, navigation, data, and export

- Markdown/MDX is the core surface with local rendering, syntax-highlighted code, math, Mermaid, media, links, TOC, collapsible sections, tables/charts, local editing where writable, and read-only historical/diff modes where required.
- Sidebar navigation includes Files, Search, opt-in Bookmarks, and capability-aware History. With more than three visible sidebar tabs, labels collapse to icon-only while accessible names and Markdown Explorer tooltips remain available.
- Search supports current document/current workspace and desktop cross-tab modes where supported.
- Interactive tables support sorting, search/filtering, wrapping, column visibility, chart views, fullscreen chart inspection, copy/save image, and CSP-safe event delegation on Chromium.
- Export Center supports HTML, client-side PDF, and static Website ZIP across runtimes, with document/explorer layouts and native/browser-appropriate save paths.
- Scope View provides bounded modal document navigation without replacing the active workspace shell.

## Bookmarks, user manual, localization, and accessibility

- Source-anchored bookmarks support robust persisted references for text and rendered objects with high-confidence relocation after edits.
- The in-app searchable User Manual is available from Home and provides task-oriented guidance.
- User-facing editor/history/split/settings strings are localized across **nine supported locales**: English, Vietnamese, French, Spanish, Chinese, Norwegian, Japanese, Korean, and Russian.
- Core navigation/actions remain keyboard reachable, with translated accessible names and focus-visible behavior.

## Version synchronization

The feature branch target is **1.6.9**. Root `package.json` is authoritative and `scripts/sync-versions.mjs` synchronizes runtime package/config and public site version metadata before build/release. The 1.6.9 marker does not mean PR #48 has been merged; manual validation remains required.

## Source traceability

| Area | Primary source |
|---|---|
| Editing/session/save | `ui/src/editor`, `ui/src/components/Content/MarkdownSourceEditor.tsx` |
| Split panes/tabs/isolation | `ui/src/split-view`, `ui/src/components/Content/SplitDocumentView.tsx` |
| File drag/drop | `ui/src/components/Content/documentFileDrop.ts` |
| Repository History | `ui/src/components/History/RepositoryHistoryPanel.tsx`, `ui/src/contexts/RepositorySnapshotContext.tsx` |
| Revision projection/search | `ui/src/history/revisionWorkspace.ts` |
| History search/persistence | `ui/src/history/repositoryView.ts` |
| Runtime Git adapters | `electron/git/document-history.js`, `tauri/src/dispatcher/git_repository.rs`, `vscode/src/core/panelGitHistory.ts` |
| Version synchronization | `package.json`, `scripts/sync-versions.mjs` |
| As-built PR #48 contract | `docs/superpowers/specs/2026-09-17-pr48-as-built-sync.md` |

---

[← Supported Files and Conversion Catalog](06-supported-files-and-conversion.md) · [Documentation index](../README.md) · [Storage Catalog →](07-storage-catalog.md)
