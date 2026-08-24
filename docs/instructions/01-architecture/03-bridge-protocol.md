---
timestamp: '2026-08-01T22:54:00+07:00'
name: Bridge Protocol
topic: Typed UI-host command and event protocol
document_type: specification
status: active
ui_spec: false
parent_docs:
- ../README.md
related_docs:
- ../05-reference/01-ui-to-host-command-catalog.md
- ../05-reference/02-host-to-ui-message-catalog.md
- 04-request-correlation.md
source_scope:
- ui/src/platform/bridge.ts
- ui/src/types/webviewMessages.ts
- ui/src/types/hostMessages.ts
- ui/src/types/content.ts
test_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-host-message-parity.test.ts
runtime_scope:
- shared
keywords: []
---

# Bridge Protocol

## Interface

```typescript
export interface PlatformBridge {
  postMessage(message: WebviewMessage): void;
  onMessage(handler: (message: HostMessage) => void): () => void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
  copyToClipboard(text: string): Promise<void>;
}
```

## Protocol rules

- Every cross-boundary message has a literal `command` discriminant.
- Workspace messages may carry `workspaceOperationId` and `workspaceTabId`.
- Search/resource/export operations carry `requestId` and ignore mismatched responses.
- Structured external open launches arrive via `externalOpenRequest` carrying target file/folder details.
- UI state persistence is adapter-owned through `getState` and `setState`.
- Clipboard behavior prefers host APIs and must report failure where relevant.
- Unknown commands are ignored or rejected safely; they never execute arbitrary host operations.

## Lifecycle

```mermaid
sequenceDiagram
    UI->>Host: ready(documentConversionEnabled?)
    Host-->>UI: readyAck or workspaceUnavailable
    Host-->>UI: renderContent when a document opens
    UI->>Host: user command
    Host-->>UI: correlated result or state change
```

See the command and host-message catalogs for all payloads.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/platform/bridge.ts` | Active behavior or contract |
| Implementation | `ui/src/types/webviewMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/hostMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/content.ts` | Active behavior or contract |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-host-message-parity.test.ts` | Automated expectation |

---

[← Runtime Architecture](02-runtime-architecture.md) · [Documentation index](../README.md) · [Request and Operation Correlation →](04-request-correlation.md)
