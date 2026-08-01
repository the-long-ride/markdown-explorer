---
timestamp: '2026-08-01T22:54:00+07:00'
name: Request and Operation Correlation
topic: Protection against stale asynchronous results
document_type: specification
status: active
ui_spec: false
parent_docs:
- ../README.md
related_docs:
- 03-bridge-protocol.md
- 05-state-model.md
- ../02-use-cases/UC-006-workspace-scan-progress-cancellation.md
source_scope:
- ui/src/desktop/workspaceOperations.ts
- ui/src/contexts/appStateReducer.ts
- electron/core/runtime-workspace-handlers.js
- tauri/src/dispatcher/incremental_scan.rs
- vscode/src/core/incrementalScan.ts
test_scope:
- tests/node/workspace-operations.test.mjs
- tests/node/electron-scanner-cancellation.test.mjs
- tests/node/startup-workspace-cancellation.test.mjs
runtime_scope:
- shared
keywords: []
---

# Request and Operation Correlation

## Identifiers

| Identifier | Scope | Examples |
|---|---|---|
| `workspaceOperationId` | One open/activate/close/scan operation | Scan progress, cancellation, unavailable response |
| `workspaceTabId` | One desktop workspace tab | Activation and result routing |
| `requestId` | One search or resource request | Workspace search, cross-tab search, local CSS/JS reads |

## Required behavior

1. UI creates a fresh identifier before asynchronous work.
2. Host echoes the identifier on all correlated responses.
3. UI compares it with current active state.
4. Mismatched or cancelled results are discarded.
5. Cleanup invalidates pending work and removes timers/listeners.

```mermaid
sequenceDiagram
    UI->>Host: openFolder(operation=A)
    UI->>Host: openFolder(operation=B)
    Host-->>UI: workspaceFilesChanged(operation=A)
    UI-->>UI: discard stale A
    Host-->>UI: workspaceFilesChanged(operation=B)
    UI-->>UI: apply B
```

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/desktop/workspaceOperations.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/appStateReducer.ts` | Active behavior or contract |
| Implementation | `electron/core/runtime-workspace-handlers.js` | Active behavior or contract |
| Implementation | `tauri/src/dispatcher/incremental_scan.rs` | Active behavior or contract |
| Implementation | `vscode/src/core/incrementalScan.ts` | Active behavior or contract |
| Verification | `tests/node/workspace-operations.test.mjs` | Automated expectation |
| Verification | `tests/node/electron-scanner-cancellation.test.mjs` | Automated expectation |
| Verification | `tests/node/startup-workspace-cancellation.test.mjs` | Automated expectation |

---

[← Bridge Protocol](03-bridge-protocol.md) · [Documentation index](../README.md) · [Application State Model →](05-state-model.md)
