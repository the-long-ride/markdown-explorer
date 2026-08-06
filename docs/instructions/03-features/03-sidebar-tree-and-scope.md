---
timestamp: '2026-08-01T22:54:00+07:00'
name: Sidebar Tree, Filtering, and Scope
topic: Sidebar Tree, Filtering, and Scope
document_type: specification
status: active
ui_spec: true
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- ui/src/components/Sidebar/Sidebar.tsx
- ui/src/components/Sidebar/SidebarSearch.tsx
- ui/src/components/Sidebar/SidebarTabsHeader.tsx
- ui/src/components/Sidebar/sidebarSearchScope.ts
- ui/src/components/Sidebar/TreeNode.tsx
- ui/src/components/Sidebar/SidebarFilesActions.tsx
- ui/src/components/Sidebar/SidebarSortMenu.tsx
- ui/src/components/Sidebar/SidebarScopeControls.tsx
- ui/src/components/Sidebar/sidebarItemMenuItems.tsx
- ui/src/components/Sidebar/sidebarTreeFiltering.ts
- ui/src/components/Sidebar/sidebarTreeOrdering.ts
- ui/src/components/Sidebar/sidebarPinIcons.tsx
- ui/src/components/Sidebar/sidebarWorkspacePreferences.ts
- ui/src/components/Sidebar/sidebarActiveFolders.ts
- ui/src/components/Sidebar/useSidebarCursorNavigation.ts
- ui/src/components/Sidebar/useSidebarPinnedSorting.ts
- ui/src/components/Sidebar/useSidebarScopeFocus.ts
- ui/src/hooks/useResize.ts
- ui/src/styles/global/global-sidebar-search-controls.css
test_scope:
- tests/node/sidebar-pinning-sorting.test.mjs
- tests/unit/ui/components/sidebar-tree-ordering.test.ts
- tests/unit/ui/components/sidebar-render.test.tsx
- tests/unit/ui/components/sidebar-search-pure.test.ts
- tests/unit/ui/hooks/useResize.test.ts
- tests/node/sidebar-focus-search-layout.test.mjs
runtime_scope:
- all
- native/editor-hosts
- browser-hosts
keywords:
- sidebar tree, filtering, and scope
---

# Sidebar Tree, Filtering, and Scope

## Feature intent

Specify hierarchical file navigation, search/filter rendering, cursor navigation, context menus, resizing, and per-workspace scope focus.

## Capability contract

| Capability | Required behavior | User result |
|---|---|---|
| Tree | Render folder/file hierarchy and active item. | Workspace structure is understandable. |
| Filter | Retain matching descendants and required ancestors. | Large trees are narrowed without losing context. |
| Cursor mode | Move, expand, collapse, and open by keyboard. | Tree is usable without pointer. |
| Scope focus | Limit navigation and workspace search to selected files/folders per workspace. | Users concentrate on relevant documentation. |
| Resize | Persist bounded sidebar width. | Layout matches reader preference. |

## Interaction and processing flow

```mermaid
flowchart LR
    A[User input or host event] --> B[Validate and normalize]
    B --> C[Update application state]
    C --> D[Render or dispatch host command]
    D --> E[Announce result or recover error]
```

### Tree-node behavior

- Folder expansion is independent from text filtering.
- The active document remains visually identifiable when its node is visible.
- File and folder context menus are built from target type and host capability.
- Filter matching is case/Unicode aware through shared utilities where applicable.
- Scope maps are reconciled when files/folders disappear.

### Tree ordering, sorting, and pin controls

- **Folders-first Ordering**: By default (`name-asc`), unpinned folders are always listed before files at each directory level, with items within each group sorted alphabetically ascending (A-Z).
- **Sort Modes**: `SidebarSortMenu` offers three sort modes: `name-asc` (A-Z, default), `name-desc` (Z-A), and `modified-desc` (recently modified first).
- **Root Level Pin Hoisting**: When a file or folder located inside a parent folder is pinned, it is hoisted and displayed at the root level of the sidebar tree instead of remaining inside its parent folder.
- **Revocable Sorting**: Clicking the currently active sort mode in `SidebarSortMenu` revokes active sorting and resets the workspace sort mode back to `DEFAULT_SIDEBAR_SORT_MODE` (`name-asc`).
- **Toolbar Actions Sequence**: Sidebar toolbar buttons are arranged in exact sequence: `Sort` (left), `Clear Pins`, `Locate`, `Collapse All`, `Expand All` (right).
- **Pin & Unpin Icons**: Unpin actions (in item context menus and toolbar Clear Pins) display the `UnpinIcon` SVG which dynamically inherits the current theme accent color (`var(--accent, #EF4136)`).
- **Scope Focus Badge**: The scope focus count badge (`.sidebar__scope-count`) and TOC count badge (`.toc-panel__count`) utilize theme-aware border radius `border-radius: var(--r-s, var(--r));`.

### Scope separation

| Setting | Effect |
|---|---|
| `scopeFocus` | Visible/browsable workspace focus |
| `searchScopeFocus` | Workspace-search candidate focus |

The two maps may differ and must not overwrite each other.


## States and failure behavior

| State | Required presentation | Exit condition |
|---|---|---|
| Expanded | Children visible | Collapse |
| Collapsed | Children hidden | Expand |
| Filtered | Matching subtree only | Clear query |
| Cursor mode | One visible node focused | Exit/move/open |
| Scoped | Selected roots applied | Edit/clear scope |

## Runtime behavior

| Runtime | Specification |
|---|---|
| All | Shared tree and filtering behavior. |
| Native/editor hosts | Reveal/open-in-editor actions enabled. |
| Browser hosts | Filesystem shell actions unavailable. |

## Non-functional requirements

- All actions remain keyboard reachable.
- A failed enhancement must not prevent the base document from rendering.
- Host-facing inputs are validated before filesystem, shell, or network access.


## Acceptance criteria

- [ ] Ancestors remain visible for matching descendants.
- [ ] Cursor navigation never focuses hidden nodes.
- [ ] Scope state is reconciled after workspace change.
- [ ] Sidebar width remains within layout bounds.
## UI reference implementation

The sample shows the interaction boundary, not a replacement for the React implementation.

```html
<section class="spec-sidebar-tree-filtering-and-scope" aria-labelledby="sidebar-tree-filtering-and-scope-title">
  <h2 id="sidebar-tree-filtering-and-scope-title">Sidebar Tree, Filtering, and Scope</h2>
  <p data-status role="status" aria-live="polite">Ready</p>
  <button type="button" data-action>Open document</button>
</section>
```

```css
.spec-sidebar-tree-filtering-and-scope {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius, 8px);
  background: var(--surface);
  color: var(--text);
}
.spec-sidebar-tree-filtering-and-scope button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

```javascript
const root = document.querySelector('.spec-sidebar-tree-filtering-and-scope');
const status = root.querySelector('[data-status]');
root.querySelector('[data-action]').addEventListener('click', () => {
  window.PlatformBridge.postMessage({ command: 'navigate', path: '/project/docs/guide.md' });
  status.textContent = 'Request sent';
});
```
## Sidebar header and focus-aware search contract

- Files, Search, and Bookmarks tabs size to their icon and translated label; no fixed minimum tab width is imposed.
- One measured indicator animates to the active tab, and all three bodies use the same reduced-motion-aware transition.
- Each tab uses the same search-field height. Files keeps the search field on row one and scope-focus controls on row two.
- Workspace search filters host results against the current focus set. Unfocused files never appear.
- Changing focus while a non-empty search query exists changes the scope revision and reruns focus-aware search, so newly focused files appear and newly unfocused files disappear without editing the query.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/components/Sidebar/Sidebar.tsx` | Active behavior or contract |
| Implementation | `ui/src/components/Sidebar/TreeNode.tsx` | Active behavior or contract |
| Implementation | `ui/src/components/Sidebar/SidebarScopeControls.tsx` | Scope focus controls |
| Implementation | `ui/src/components/Sidebar/sidebarItemMenuItems.tsx` | Right-click context menu items |
| Implementation | `ui/src/components/Sidebar/sidebarTreeFiltering.ts` | Active behavior or contract |
| Implementation | `ui/src/components/Sidebar/sidebarActiveFolders.ts` | Active folder tracking |
| Implementation | `ui/src/components/Sidebar/useSidebarCursorNavigation.ts` | Active behavior or contract |
| Implementation | `ui/src/components/Sidebar/useSidebarPinnedSorting.ts` | Pinned item sort ordering |
| Implementation | `ui/src/components/Sidebar/useSidebarScopeFocus.ts` | Per-workspace scope focus |
| Implementation | `ui/src/hooks/useResize.ts` | Active behavior or contract |
| Verification | `tests/unit/ui/components/sidebar-render.test.tsx` | Automated expectation |
| Verification | `tests/unit/ui/components/sidebar-search-pure.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/hooks/useResize.test.ts` | Automated expectation |

---

[← Desktop Workspace Tabs](02-desktop-workspace-tabs.md) · [Documentation index](../README.md) · [Content Tabs and Document Shell →](04-content-tabs-and-document-shell.md)
