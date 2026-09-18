# PR #48 as-built specification: editing, split view, repository history, and Focus UX

**Date:** 2026-09-17  
**Status:** As-built / authoritative for PR #48  
**Branch:** `feature/editor-git-history-split-view`  
**Target application version:** `1.6.9`

This document records the implemented state of PR #48 after the 2026-09-16 UX follow-up. Where an earlier design document conflicts with this specification, this specification and the implementation are authoritative.

## 1. Release/version boundary

- The feature branch targets Markdown Explorer **1.6.9** so it does not collide with the separate 1.6.8 hot-fix line.
- Root `package.json` is the authoritative version source.
- `scripts/sync-versions.mjs` keeps UI, VS Code, Electron, Chromium, Website, and Tauri package/config metadata aligned with the root version.
- PR #48 remains a manual-validation PR. Version metadata does not imply that the PR has been merged or released.

## 2. Markdown editing

- Rendered Markdown remains the default document experience.
- `markdownEditingEnabled` defaults to **false**.
- On a live writable document, **More Actions → Edit** remains available on capable native/editor runtimes:
  - feature ON → open Markdown Explorer's internal editor;
  - feature OFF → use the existing external/native editor route.
- Historical repository views, Git revision views, and Diff views are always read-only and expose no save/edit route.
- The full-source internal editor uses **CodeMirror 6** from local packaged dependencies. CodeMirror owns cursor/selection, editor keymaps, syntax highlighting, and local undo/redo only. Markdown Explorer's document session remains authoritative for working source, dirty state, save revision tokens, conflict handling, persistence, and split synchronization.
- The Markdown formatting toolbar supports bold, italic, headings, quote, inline/fenced code, links, bulleted/numbered/task lists, tables, undo/redo, and Preview/Rendered switching.
- Save continues through the revision-token protected `saveDocument` protocol. External changes produce a conflict rather than a silent overwrite.

## 3. Split document view

### 3.1 Pane-owned tabs

Each `DocumentPaneState` owns:

```ts
interface DocumentPaneState {
  id: 'primary' | 'secondary';
  filePath: string | null;
  tabs: readonly string[];
  activeTabPath: string | null;
  mode: DocumentViewMode;
  scrollTop: number;
  revision?: string;
  diffKey?: string;
}
```

- With file tabs enabled, navigation updates only the focused pane and adds/activates that pane's tab.
- With file tabs disabled, navigation replaces only the focused pane's document.
- Activating or closing a tab is pane-scoped.
- Closing split view preserves the **currently focused pane**, including its tab strip, active document, mode-compatible state, and ratio; the other pane is discarded.
- Swapping panes swaps pane state and focused-pane identity.

### 3.2 Render and scroll isolation

- Expensive document rendering is invalidated by document/pane-local dependencies rather than a global application render counter.
- An unrelated opposite pane must not visibly rerender/remount when the other pane edits, scrolls, or becomes active.
- Same-document Rendered mirrors may update on the existing short debounce while editing.
- Normal wheel/trackpad scrolling stays local to the pane DOM during the scroll interaction. Scroll position is persisted at lifecycle boundaries such as tab/file/mode change, pane deactivation, split close, or unmount rather than dispatching application state on every scroll event.

### 3.3 Opening documents into panes

- File context menus expose **Open in Split View** for file targets.
- Files are draggable using the MIME payload:

```text
application/x-markdown-explorer-file
```

with a `text/plain` fallback.
- Dropping onto an unsplit document area opens the file normally.
- Dropping onto a split pane highlights and targets only that pane, activates it, then opens the dropped file there.
- Dirty-session safety rules continue to apply when an operation would replace the only view of unsaved work.

## 4. Focus-mode shell behavior

- Focus mode hides normal application chrome but retains a dedicated native draggable body surface on Electron/Tauri.
- Interactive Focus controls are explicitly `no-drag`.
- The drag surface does not replace native resize hit areas.
- Tauri's existing fullscreen drag lock remains authoritative: Focus drag affordances must not re-enable window dragging while fullscreen.
- The top breadcrumb/container sizes to content rather than occupying unused header width.

## 5. Sidebar tabs and revision file projection

- Files, Search, Bookmarks, and capability-aware History share one visible-tab descriptor model.
- Three or fewer visible tabs use icon + text. More than three use icon-only controls.
- All tab controls retain accessible names and Markdown Explorer `TooltipButton` behavior in both layouts; browser-only `title` text is not the tooltip contract.
- Active indicator geometry follows the visible tab order, not a fixed hard-coded index.
- Historical Files projection matches normal document eligibility:
  - Markdown/MDX and TXT are included;
  - convertible document formats are included only when document conversion is enabled;
  - arbitrary source files such as `.ts` do not appear merely because Git contains them.

## 6. Repository History sidebar

### 6.1 Opening History

- **More Actions → History** calls the centralized repository-history action.
- That action expands the sidebar if needed and selects the **History** tab.
- The visible History panel then triggers lazy repository-history loading.
- Document-specific revision/diff operations remain available in their History workflows, but the More Actions entry no longer means “open a per-document overlay first.”

### 6.2 Search

Loaded commits can be filtered case-insensitively by:

- full commit OID;
- short OID;
- author;
- subject/message.

When a non-empty query has no match in the loaded page and older history remains, the History panel progressively loads additional pages until a match is found or history is exhausted.

### 6.3 Pagination

Repository history is paginated end-to-end:

```ts
listRepositoryHistory(limit?: number, offset?: number)
```

- Initial page size: **50 commits**.
- Additional pages use `offset = currently loaded count`.
- Electron, VS Code, and Tauri map the offset to Git's read-only `--skip=<offset>` behavior and the limit to `-n <limit>`.
- The UI appends pages in order and de-duplicates by full OID.
- A page shorter than the requested size marks history exhausted.
- Older history loads through an `IntersectionObserver` sentinel with a scroll-near-bottom fallback used for deterministic tests/environments without the observer.

### 6.4 Persisted historical workspaces

- Selecting **View workspace at this commit** activates a read-only repository view without checkout or working-tree mutation.
- Selected revisions persist per workspace, preferring workspace path and falling back to workspace name only when a path is unavailable.
- A persisted revision must **not** be cleared merely because it is absent from the first 50-commit page. Validation may load additional history pages.
- If the object is genuinely unavailable after validation (for example after rebase/prune), the stale selection is cleared and the workspace returns to live HEAD.
- **Return to current HEAD** clears only repository-view/persistence state and reveals the already-mounted live tabs, split panes, scroll positions, and dirty editor sessions.

## 7. Read-only Git boundary

Git support remains read-only. Electron, Tauri, and VS Code may use the installed local `git` executable to:

- detect capability;
- list document history;
- list paged repository history;
- list revision files under the active workspace boundary;
- read exact revision files;
- compare revision sources.

The protocol does not expose stage, commit, checkout, restore, reset, stash, branch, switch, merge, rebase, or equivalent mutation. Git arguments are passed as structured argument arrays / `std::process::Command`, never interpolated shell strings. Chromium and Website hosts return explicit unsupported results and never attempt local process execution.

## 8. Bridge changes

### UI → host

```text
getGitCapability { requestId }
listDocumentHistory { requestId, filePath, limit? }
readGitRevision { requestId, oid, path }
compareGitRevisions { requestId, left, right }
listRepositoryHistory { requestId, limit?, offset? }
listRevisionFiles { requestId, oid }
readRevisionFile { requestId, oid, path }
```

### Host → UI

```text
gitCapabilityResult
 documentHistoryResult
 gitRevisionResult
 gitComparisonResult
 repositoryHistoryResult
 revisionFilesResult
 revisionFileResult
```

All correlated operations preserve `requestId`. Pagination does not add a new response type; each `repositoryHistoryResult` is one requested page and the renderer owns append/de-duplication state.

## 9. Required runtime parity

| Capability | Electron | Tauri | VS Code | Chromium | Website |
|---|:---:|:---:|:---:|:---:|:---:|
| Internal Markdown editor | Yes | Yes | Yes | Writable-handle capability | Writable-handle capability |
| Pane-owned split tabs | Yes | Yes | Yes | Yes | Yes |
| File drag/drop into pane | Yes | Yes | Yes | Yes where workspace file rows exist | Yes where workspace file rows exist |
| Local Git document history | Installed Git | Installed Git | Installed Git | Unsupported | Unsupported |
| Paged/searchable repository history | Installed Git | Installed Git | Installed Git | Unsupported | Unsupported |
| Read-only revision workspace | Installed Git | Installed Git | Installed Git | Unsupported | Unsupported |
| Focus native drag surface | Yes | Yes | N/A | N/A | N/A |

## 10. Verification and acceptance

Automated coverage must continue to prove:

- pane-owned tab open/activate/close behavior;
- focused-pane preservation on split close;
- unrelated pane render isolation;
- ordinary scroll does not dispatch global state every event;
- Open in Split View and custom drag payload/drop targeting;
- revision Files type filtering;
- sidebar TooltipButton accessibility;
- repository history search by OID/author/subject;
- 50-item initial page and offset loading;
- Electron/VS Code/Tauri offset parity;
- append/de-duplication and exhaustion handling;
- More Actions → History sidebar routing;
- persisted revision validation beyond the first history page;
- Focus drag surface and Tauri fullscreen drag lock;
- existing save/conflict/history/diff security contracts.

Before merge, run the existing PR quality gates and complete manual validation on at least one real local Git repository. PR #48 must remain open until the user explicitly approves merge.

## 11. Superseded design decisions

The following earlier decisions are explicitly superseded:

- 2026-09-06: “no CodeMirror / native textarea only” → replaced by local CodeMirror 6 source editing.
- 2026-09-13: hiding/removing Edit when `markdownEditingEnabled=false` → replaced by live Edit routing to the external/native editor while internal editing is disabled.
- Earlier split model with one file identity per pane and no pane-local tab strip → replaced by pane-owned tabs.
- Earlier bounded one-shot repository History → replaced by 50-item offset pagination plus search/progressive loading.
- Earlier More Actions → History document-overlay routing → replaced by repository History sidebar routing.

Historical design documents remain useful as implementation history, but this as-built specification defines the final PR #48 behavior.
