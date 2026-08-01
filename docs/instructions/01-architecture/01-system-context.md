---
timestamp: '2026-08-01T22:54:00+07:00'
name: System Context
topic: External actors, boundaries, and product environment
document_type: specification
status: active
ui_spec: false
parent_docs:
- ../README.md
related_docs:
- 02-runtime-architecture.md
- 03-bridge-protocol.md
- 06-security-trust-boundaries.md
source_scope:
- ui/src/main.tsx
- ui/src/platform/bridge.ts
- electron/core/main-runtime.js
- tauri/src/core/bootstrap.rs
- vscode/src/core/panel.ts
- chromium-xtension/src/chrome-host.ts
- website-app/src/web-host.ts
test_scope: []
runtime_scope:
- shared
keywords: []
---

# System Context

```mermaid
flowchart TB
    User[User] --> React[Shared React UI]
    React --> Bridge[PlatformBridge]
    Bridge --> Electron[Electron host]
    Bridge --> Tauri[Tauri host]
    Bridge --> VSCode[VS Code host]
    Bridge --> Chrome[Chromium host]
    Bridge --> Web[Website host]
    Electron & Tauri & VSCode & Chrome & Web --> Files[Local files or virtual workspace]
    Electron & Tauri & VSCode --> Shell[OS shell/editor]
    Electron & Tauri --> Update[Update service]
```

## Boundary rules

| Boundary | Contract |
|---|---|
| User → UI | Keyboard, pointer, drag/drop, dialogs, context menus |
| UI → host | `WebviewMessage` discriminated union |
| Host → UI | `HostMessage` discriminated union |
| Host → filesystem | Runtime-specific scanning, watching, reading, conversion |
| HTML preview → host | Restricted workspace-text resource bridge |
| Host → shell | Validated external URL and filesystem location operations |

## Shared responsibility

The React UI owns presentation, navigation state, content enhancements, settings UI, and request correlation. Hosts own privileged operations and translate their results into common messages.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/main.tsx` | Active behavior or contract |
| Implementation | `ui/src/platform/bridge.ts` | Active behavior or contract |
| Implementation | `electron/core/main-runtime.js` | Active behavior or contract |
| Implementation | `tauri/src/core/bootstrap.rs` | Active behavior or contract |
| Implementation | `vscode/src/core/panel.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/chrome-host.ts` | Active behavior or contract |
| Implementation | `website-app/src/web-host.ts` | Active behavior or contract |

---

[← Application Coverage Matrix](../00-foundation/06-coverage-matrix.md) · [Documentation index](../README.md) · [Runtime Architecture →](02-runtime-architecture.md)
