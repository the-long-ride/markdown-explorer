---
timestamp: '2026-09-17T00:00:00+07:00'
name: Desktop Workspace Tabs
topic: Desktop workspace tabs, Focus shell, native dragging, and persistence
document_type: specification
status: active
ui_spec: true
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../../superpowers/specs/2026-09-17-pr48-as-built-sync.md
source_scope:
- ui/src/components/Desktop/DesktopTabBar.tsx
- ui/src/components/Desktop/DesktopTabItem.tsx
- ui/src/components/Desktop/DesktopTabContextMenu.tsx
- ui/src/components/Desktop/FocusViewControls.tsx
- ui/src/components/Desktop/DesktopLayout.tsx
- ui/src/desktop/desktopTabs.ts
- ui/src/hooks/useDesktopTabManagement.ts
- ui/src/styles/global/global-topbar.css
- ui/src/styles/global/global-desktop.css
test_scope:
- tests/unit/ui/components/desktop-tabbar-deep.test.tsx
- tests/unit/ui/components/desktop-tabbar-interactions.test.tsx
- tests/unit/ui/desktop-tabs.test.ts
- tests/node/focus-drag-region-contract.test.mjs
runtime_scope:
- electron/tauri
- other-runtimes
keywords:
- desktop workspace tabs
- focus mode
- drag region
- fullscreen
---

# Desktop Workspace Tabs

## Feature intent

Specify the home/new/workspace tab model, tab lifecycle, aliases, context menu, loading state, snapshot persistence, and the native desktop shell behavior retained while Focus mode hides normal chrome.

## Capability contract

| Capability | Required behavior | User result |
|---|---|---|
| Home tab | Provide a fixed non-removable landing tab. | User always has a stable return point. |
| Workspace tab | Own independent workspace, content, history, search, and operation state. | Multiple projects coexist safely. |
| Activation | Snapshot outgoing state and restore incoming state. | Switching is fast and isolated. |
| Close actions | Close current, others, or tabs to right with deterministic selection. | Tab management behaves predictably. |
| Alias | Persist a display name without changing filesystem identity. | Long/duplicate paths become recognizable. |
| Focus shell | Hide normal application chrome while retaining required native drag/exit affordances. | Distraction-free reading does not make the desktop window immovable. |

## Tab model

```typescript
interface DesktopWorkspaceTab {
  id: string;
  kind: 'home' | 'new' | 'workspace';
  workspacePath?: string;
  workspaceOperationId?: string;
  label: string;
}
```

## Tab invariants

- `home` is always present.
- Workspace messages update only the tab carrying matching `workspaceTabId` and operation ID.
- Closing a tab cancels its scan/search work before state removal.
- Persisted snapshots are normalized; unknown or duplicate IDs are discarded.
- Tab bar scrolling keeps the active tab visible.
- Alias text is display-only and never changes filesystem/search identity.

## Focus-mode native shell contract

Focus mode is an application layout state, not an OS minimize/maximize operation.

- Entering Focus hides the normal desktop header/tab chrome while preserving the document workspace and a dedicated Focus exit control.
- Electron and Tauri retain a thin application-owned native drag surface after the normal header disappears.
- Interactive controls inside the Focus shell are explicitly `no-drag` so clicks, menus, and exit actions are not consumed by window dragging.
- The Focus drag surface is placed within the application body shell and must not replace or cover native resize hit areas.
- Tauri's fullscreen guard remains authoritative: when fullscreen is active, the Focus drag surface must not make the window draggable.
- Leaving Focus restores the prior desktop shell state without rebuilding workspace/content state.
- Header breadcrumb/container sizing is intrinsic/content-sized rather than stretching across unused horizontal space.

## States and failure behavior

| State | Required presentation | Exit condition |
|---|---|---|
| Home | Landing content; cannot close | Open/activate workspace |
| New | Workspace chooser inside a tab | Open/cancel |
| Loading workspace | Spinner/progress in tab | Ready/cancel/unavailable |
| Ready workspace | Alias/path/title | Switch/close |
| Unavailable | Reason marker and recovery | Reopen/close |
| Focus | Content-first shell + exit + native drag surface on desktop | Toggle Focus |
| Fullscreen Focus (Tauri) | Content-first shell + exit, native drag disabled | Exit fullscreen/Focus |

## Runtime behavior

| Runtime | Specification |
|---|---|
| Electron | Primary multi-workspace shell; Focus retains a native drag region. |
| Tauri | Primary multi-workspace shell; Focus retains drag region except while fullscreen. |
| Other runtimes | Do not assume desktop workspace tabs or native drag regions; content tabs remain separate. |

## Non-functional requirements

- All actions remain keyboard reachable.
- A failed enhancement must not prevent the base document from rendering.
- Host-facing inputs are validated before filesystem, shell, or network access.
- Focus-mode drag CSS/attributes must not create accidental drag surfaces over interactive controls.

## Acceptance criteria

- [ ] Home cannot be removed.
- [ ] A result for a closed tab is ignored.
- [ ] Active-tab selection after close is deterministic.
- [ ] Alias changes no command path or search identity.
- [ ] Electron Focus window can still be moved by the dedicated drag surface.
- [ ] Tauri Focus window can still be moved when not fullscreen.
- [ ] Tauri fullscreen Focus cannot be dragged through the application surface.
- [ ] Focus controls remain clickable/no-drag.
- [ ] Toggling Focus preserves mounted workspace/document state.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/components/Desktop/DesktopTabBar.tsx` | Desktop tab bar |
| Implementation | `ui/src/components/Desktop/DesktopTabItem.tsx` | Workspace tab behavior |
| Implementation | `ui/src/components/Desktop/DesktopTabContextMenu.tsx` | Tab context actions |
| Implementation | `ui/src/components/Desktop/FocusViewControls.tsx` | Focus exit/control surface |
| Implementation | `ui/src/components/Desktop/DesktopLayout.tsx` | Desktop/Focus shell layout and drag regions |
| Implementation | `ui/src/desktop/desktopTabs.ts` | Persisted desktop tab model |
| Implementation | `ui/src/hooks/useDesktopTabManagement.ts` | Tab lifecycle |
| Verification | `tests/node/focus-drag-region-contract.test.mjs` | Focus/Tauri fullscreen drag contract |
| Verification | `tests/unit/ui/components/desktop-tabbar-interactions.test.tsx` | Tab interactions |

---

[← Workspace Selection and Application Shell](01-workspace-selection-shell.md) · [Documentation index](../README.md) · [Sidebar Tree, Filtering, and Scope →](03-sidebar-tree-and-scope.md)
