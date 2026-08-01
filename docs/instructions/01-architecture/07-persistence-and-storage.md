---
timestamp: '2026-08-01T22:54:00+07:00'
name: Persistence Architecture
topic: Bridge state, local storage, and browser handle persistence
document_type: specification
status: active
ui_spec: false
parent_docs:
- ../README.md
related_docs:
- 05-state-model.md
- ../05-reference/07-storage-catalog.md
- ../02-use-cases/UC-018-settings-import-export.md
source_scope:
- ui/src/platform/bridge.ts
- ui/src/settings/settingsImportExport.ts
- ui/src/desktop/desktopTabSnapshot.ts
- chromium-xtension/src/file-access.ts
- chromium-xtension/src/recent-workspaces.ts
test_scope:
- tests/unit/ui/settings-import-export.test.ts
- tests/unit/chromium/file-access.test.ts
- tests/unit/chromium/recent-workspaces.test.ts
runtime_scope:
- shared
keywords: []
---

# Persistence Architecture

## Storage classes

| Class | Examples | Owner |
|---|---|---|
| Bridge state | settings, theme, scope focus | Runtime adapter |
| Local storage | onboarding, pane widths, desktop tabs, aliases, collapsed TOC | Shared UI |
| IndexedDB | Chromium workspace directory handles | Chromium host |
| Host-native recents | Paths and metadata | Electron/Tauri/VS Code host |

## Rules

- Persist only serializable UI state through `setState`.
- Browser file handles remain in IndexedDB, not local storage.
- Invalid persisted values are normalized to current defaults.
- Theme migrations map retired styles to active styles.
- Imported settings are schema-versioned and size-limited.
- Workspace aliases and desktop-tab snapshots are best-effort; corrupt values fall back safely.

See Storage Catalog for exact keys.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/platform/bridge.ts` | Active behavior or contract |
| Implementation | `ui/src/settings/settingsImportExport.ts` | Active behavior or contract |
| Implementation | `ui/src/desktop/desktopTabSnapshot.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/file-access.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/recent-workspaces.ts` | Active behavior or contract |
| Verification | `tests/unit/ui/settings-import-export.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/file-access.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/recent-workspaces.test.ts` | Automated expectation |

---

[← Security and Trust Boundaries](06-security-trust-boundaries.md) · [Documentation index](../README.md) · [Launch and Ready Handshake →](../02-use-cases/UC-001-launch-ready-handshake.md)
