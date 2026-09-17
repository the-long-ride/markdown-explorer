# History Sidebar, Feature Controls, and Split-View Isolation Design

Date: 2026-09-13
Branch baseline: `feature/editor-git-history-split-view` at `7c8ec317a33f4c199c00ab56fecb30b8d28fea8c`
Base branch after reset: `main` at `fb6205c3073d786c2ece9822302a7e53cdb3bba7`
Status: historical approved design; superseded where final behavior differs

> **As-built synchronization (2026-09-17):** [`2026-09-17-pr48-as-built-sync.md`](2026-09-17-pr48-as-built-sync.md) is authoritative where this design was refined. In particular, `markdownEditingEnabled=false` no longer hides Edit on a live capable native/editor host; Edit routes to the existing external/native editor. Final repository History is searchable and offset-paginated, More Actions → History routes to the repository History sidebar, split panes own independent tab strips, and revision Files uses document-type filtering.

## Goals

1. Fix the document-history overlay so its content never sits under the desktop header in either Focus view or Tabs view.
2. Replace the document-history row controls with compact icon-only actions, tooltips, custom SVG selection controls, and click-to-copy metadata.
3. Move feature-oriented settings into a dedicated **Features** settings section.
4. Add a feature toggle for the left-sidebar History tab.
5. Add a feature toggle for editing with Markdown Explorer, defaulting to OFF.
6. Add a History sidebar tab with repository commit graph browsing, commit snapshot navigation, and a clear return-to-current-HEAD action.
7. Prevent unrelated split panes from visibly re-rendering when only one pane changes.

## Non-goals

- Do not check out commits or mutate the user's working tree while browsing history.
- Do not allow editing while browsing a historical repository snapshot.
- Do not add Git history support to runtimes that cannot safely provide it; unsupported runtimes keep protocol parity and report unsupported capability.
- Do not replace Git itself with an in-process Git implementation.

## 1. History panel safe layout

The current history backdrop is `position: fixed; inset: 0`, while desktop headers have their own stacking and drag-region rules. The panel therefore competes with the header for the same viewport area.

Change the history panel to occupy the app's content-safe region rather than the entire viewport. The app shell should expose the correct top safe offset for each desktop layout:

- Focus view: below `.topbar`.
- Tabs view: below `.desktop-tabbar` / effective desktop header.
- Fullscreen/web/VS Code: use the active shell header geometry rather than hard-coded pixels when possible.

Implementation should prefer a shared CSS variable such as `--app-content-top` or a shell class-specific inset over duplicated magic numbers. The backdrop remains fixed and right-aligned, but uses `top: var(--app-content-top)` and `bottom: 0` instead of `inset: 0`. The panel body owns scrolling, so the header stays visible and history never scrolls beneath it.

Regression tests must cover both `.app--focus-view` and `.app--tab-view` safe-region rules.

## 2. Document history row UX

Each revision row keeps subject, path, author, timestamp, and SHA, but the action area becomes compact and visually scannable.

### Actions

Replace text buttons with square icon-only `TooltipButton` controls:

- View revision: eye/view icon.
- Compare with current: Git compare/diff icon.
- Compare with working copy: editable/file icon.
- Compare selected: compare icon in the selection toolbar.

Every icon-only control must have:

- an accessible `aria-label`,
- the existing localized action description as tooltip text,
- keyboard focus styling,
- a minimum hit target larger than the SVG itself.

### Selection control

Do not render a raw browser checkbox. Use a theme-aware custom SVG checkbox control with `role="checkbox"` / `aria-checked`, or a visually hidden native input paired with the SVG. Reuse/extract the project's existing support-modal checkbox treatment where practical so selection styling is consistent.

### Copyable metadata

The SHA and author are interactive metadata tokens:

- clicking SHA copies the full commit OID,
- clicking author copies the displayed author,
- keyboard activation is supported,
- tooltip describes the action,
- a short non-blocking copied confirmation is announced/toasted.

The abbreviated SHA remains visible, but copying SHA must copy the full OID.

### SVG Repo references

SVG Repo was searched for corresponding open SVGs. Preferred references are:

- Eye/View: `https://www.svgrepo.com/svg/421552/eye-viewed` (CC0 result).
- Git Compare: `https://www.svgrepo.com/show/535415/git-compare.svg`.
- Git Commit: `https://www.svgrepo.com/show/535416/git-commit.svg`.
- Git Branch: `https://www.svgrepo.com/show/535414/git-branch.svg`.
- Copy to Clipboard: `https://www.svgrepo.com/show/376007/copy-to-clipboard.svg`.
- Checkbox reference: `https://www.svgrepo.com/svg/308475/checkmark-yes-done-checkbox` (CC0 result).
- Editable/Pencil alternative: `https://www.svgrepo.com/svg/9318109/editable` (CC0 result).
- History: `https://www.svgrepo.com/svg/348168/history` (CC0 result).

Before embedding any non-CC0 candidate, verify its per-icon license. Normalize imported paths to `currentColor`, consistent viewBox sizing, and the project's shared icon API rather than loading remote assets at runtime.

## 3. New Settings > Features section

Add `features` to the settings navigation alongside Appearance, Typography, Theme, Shortcuts, and Update/Backup. Add a dedicated feature icon in the shared icon set.

Move the feature/product-behavior settings currently shown in Appearance into Features:

- Sidebar File Labels (`showTitle`)
- Open Files in Tabs (`fileTabs`)
- Enable Bookmark feature (`bookmarksEnabled`)
- Enable Workspace Insights feature (`insightsEnabled`)
- Read DOCX, PDF, Office, and text files (`documentConversion`)
- Default HTML Preview (`defaultHtmlPreview`)
- Default HTML Code Block Preview (`defaultHtmlCodeBlockPreview`)
- Default CSV Code Block View (`defaultCsvPreview`)
- Maximum pinned items (`maxPinnedItems`)

Appearance keeps visual presentation controls such as color mode and desktop Focus/Tabs layout.

Add two settings:

### `historySidebarEnabled`

- Default: ON.
- The History sidebar tab is shown only when this setting is enabled and Git capability for the current runtime/workspace is supported.
- If capability becomes unavailable while History is active, fall back to Files.

### `markdownEditingEnabled`

- Default: OFF.
- When OFF, direct Markdown editing entry points are hidden/disabled.
- When ON, More Actions exposes **Edit** for editable Markdown documents.
- Editing mode buttons and editing keyboard entry points must obey the same gate so the setting is a real feature boundary rather than cosmetic hiding.
- Historical snapshot browsing is always read-only regardless of this setting.

Both settings must be persisted, import/export-safe, normalized for older settings files, and localized across all supported locales.

## 4. Sidebar tab density rule

Generalize the sidebar tab model from the current hard-coded Files/Search/Bookmarks union into a visible-tab descriptor list.

Visible tabs may include:

- Files
- Search
- Bookmarks
- History

The rendering rule is deterministic:

- 3 or fewer visible tabs: current icon + text label presentation.
- More than 3 visible tabs: icon-only buttons with accessible names and tooltips.

The active indicator must calculate against the visible descriptor order instead of a fixed tab-index map. Tab transition direction should likewise derive from visible tab order.

This avoids hard-coding behavior again when future optional tabs are added.

## 5. Repository History sidebar tab

The existing `DocumentHistoryPanel` remains the document-scoped history action. The new sidebar History tab is repository/workspace-scoped and serves a different purpose.

### Commit graph list

The History tab displays a compact repository commit graph/list containing, per commit:

- graph lanes/edges,
- abbreviated SHA,
- subject,
- author,
- authored timestamp,
- refs when available,
- current HEAD marker.

The graph does not need a full Git GUI feature set. It should support normal branch/merge parent lines clearly enough to understand ancestry and select a commit.

### Required Git contracts

Extend shared history contracts and host messages with repository-level operations, for example:

- `listRepositoryHistory(limit)` -> commit summaries with parent OIDs and refs.
- `listRevisionFiles(oid)` -> workspace-relative file records available at that commit.
- `readRevisionFile(oid, path)` -> read-only file content at that commit.
- optional lightweight metadata request for current HEAD if not included in history response.

All OIDs and paths must use the same validation and workspace-boundary rules as the existing document-history backend.

Desktop implementations should use Git CLI operations such as `git log`, `git ls-tree`, and `git show` without checking out the revision. VS Code may use the same safe host-level model where available. Chromium remains unsupported for local Git history.

### Snapshot browsing mode

Selecting a commit enters **historical snapshot mode**:

- no `git checkout`, reset, stash, or file-system mutation,
- the selected revision OID becomes explicit UI state,
- the sidebar can expose the selected revision's file tree,
- opening a file reads from `oid:path`, not from disk,
- document surfaces clearly indicate the selected revision and are read-only,
- navigation among files stays inside that revision snapshot,
- current working-copy sessions are not overwritten or discarded.

A persistent **Back to current HEAD** action clears snapshot mode and restores live workspace browsing without losing unsaved live edit sessions.

The snapshot state must be separate from the existing working document state so browsing history cannot accidentally contaminate editor sessions or live content tabs.

## 6. More Actions editing gate

`ToolbarActionMenu` already models an Edit item. Make `markdownEditingEnabled` the source of truth for exposing it.

When enabled and the active document is editable:

- More Actions shows Edit.
- Edit switches the active live document to the existing editor flow.

When disabled:

- Edit is absent from More Actions.
- editing-only split modes and editing shortcuts cannot bypass the feature setting.

This keeps the existing editor implementation while changing availability, not reimplementing editing.

## 7. Split-view render isolation

The current split renderer passes global `state.renderVersion` and newly created pane projection objects to both pane views. A global render/version update can therefore cause both visual panes to refresh even when only one pane's document changed.

Refactor around pane-local render dependencies.

### State/data changes

- Track content/render revision per document or per pane instead of a single visual invalidation token for split rendering.
- Select only the data required by each pane.
- Avoid using active-pane changes, opposite-pane scroll updates, or unrelated session changes as rendering keys for the other pane.

### Component changes

- Extract a memoized pane component with a comparator based on the pane's actual document projection, history view, mode, and pane-local render token.
- Stabilize callbacks with existing app-state action methods rather than recreating pane-specific inline closures where they cause avoidable churn.
- Keep scroll updates local and do not cause the opposite pane's document renderer to remount.
- Do not key `DocumentSurface` by global render version.

### Editing/preview behavior

When one pane is being edited:

- the editor pane reflects keystrokes immediately,
- another pane showing the same document may update its rendered preview on a short debounce rather than every keystroke,
- a pane showing a different document remains visually untouched,
- save/conflict state only invalidates panes that depend on that document.

The goal is not zero React renders; the goal is no unnecessary expensive document rerender/remount or visible flicker in the unaffected pane.

## 8. Tests

Add tests at the same layers as the current feature set.

### UI / contracts

- History safe-region layout in Focus and Tabs views.
- History action buttons are icon-only and expose localized accessible labels/tooltips.
- History uses custom checkbox UI rather than visible raw checkbox controls.
- SHA copies full OID; author copies author; keyboard activation works.
- Features section appears and the moved preferences no longer render in Appearance.
- `markdownEditingEnabled` defaults false and gates More Actions/editor entry points.
- `historySidebarEnabled` persistence and visibility rules.
- Sidebar shows labels at <=3 visible tabs and icon-only at >3.
- Active-tab fallback when an optional active tab becomes unavailable.

### Git history

- repository commit parsing including parents and merge commits,
- path validation for revision tree/file reads,
- snapshot tree listing restricted to workspace scope,
- read file at selected OID without working-tree mutation,
- Back to current HEAD clears snapshot state,
- unsupported-runtime behavior remains explicit.

### Split view

Use render counters/test probes to verify:

- changing primary pane source does not rerender/remount an unrelated secondary document surface,
- secondary scroll does not invalidate primary document rendering,
- same-document preview updates are debounced or scoped as designed,
- active-pane switching alone does not rerender both document bodies.

## 9. Documentation and changelog

Update the Unreleased changelog and runtime/protocol reference docs to describe:

- feature-gated editing,
- repository History sidebar and snapshot browsing,
- new host contracts,
- history UI improvements,
- split-view isolation behavior.

## Acceptance criteria

The change is complete when:

1. History never appears under the app header in Focus or Tabs layout.
2. Revision actions are compact SVG icon buttons with tooltips and accessible labels.
3. Revision selection uses custom SVG checkbox visuals.
4. SHA and author can be clicked/keyboard-activated to copy.
5. Feature settings live in a dedicated Features section.
6. Editing is OFF by default and cannot be entered while disabled.
7. History sidebar visibility is configurable and capability-aware.
8. More than three visible sidebar tabs switch to icon-only mode.
9. History sidebar shows a commit graph/list and supports read-only browsing of all files at a selected commit.
10. Back to current HEAD returns to the live workspace without mutating or losing working-copy edits.
11. An unrelated split pane no longer visibly rerenders when the other pane changes.
12. Existing document-history, diff, save, conflict, and unsaved-change workflows continue to pass their tests.
