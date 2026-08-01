---
timestamp: '2026-08-01T22:54:00+07:00'
name: Security and Trust Boundaries
topic: Filesystem, HTML, links, shell, and update safety
document_type: specification
status: active
ui_spec: false
parent_docs:
- ../README.md
related_docs:
- 03-bridge-protocol.md
- ../03-features/10-html-preview-and-browser.md
- ../05-reference/09-error-and-reason-catalog.md
source_scope:
- ui/src/markdown/htmlLocalFirstPreview.ts
- ui/src/markdown/htmlPreviewDocument.ts
- ui/src/dom/linkContextMenu.ts
- electron/core/html-preview-server.js
- tauri/src/local_file.rs
- vscode/src/core/htmlPreviewServer.ts
test_scope:
- tests/node/html-local-first-followup.test.mjs
- tests/node/html-preview-settings-security-followup.test.mjs
- tests/unit/electron/html-preview-server.test.ts
runtime_scope:
- shared
keywords: []
---

# Security and Trust Boundaries

## Threat surfaces

| Surface | Required control |
|---|---|
| Markdown links | Block dangerous schemes; confirm or route validated external URLs |
| Relative resources | Resolve inside active workspace; reject escape attempts |
| HTML preview | Sandbox; deny same-origin; block active remote networking |
| Local HTML assets | Inline only validated workspace text resources |
| OS shell actions | Accept exact `ShellLocationMode`; validate path |
| Converted documents | Treat output as preview content, not trusted executable HTML |
| Updates | Available only where packaged runtime supports trusted installation |
| Tauri local files | Enforce workspace containment and bounded reads |

## HTML sandbox baseline

- `sandbox="allow-scripts allow-forms"`; no `allow-same-origin`.
- `referrerpolicy="no-referrer"`.
- CSP defaults to deny; connections, frames, workers, objects, base URLs, and form targets are denied.
- `fetch`, XHR, WebSocket, EventSource, and `sendBeacon` are blocked in local-first preview.
- Passive media may remain remote, but active code and styles do not load remotely.

## Filesystem baseline

A document may request a relative text resource only through `readWorkspaceTextResource`. The host returns `outside-workspace`, `missing`, `unreadable`, or `unsupported`; the UI may additionally time out.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/markdown/htmlLocalFirstPreview.ts` | Active behavior or contract |
| Implementation | `ui/src/markdown/htmlPreviewDocument.ts` | Active behavior or contract |
| Implementation | `ui/src/dom/linkContextMenu.ts` | Active behavior or contract |
| Implementation | `electron/core/html-preview-server.js` | Active behavior or contract |
| Implementation | `tauri/src/local_file.rs` | Active behavior or contract |
| Implementation | `vscode/src/core/htmlPreviewServer.ts` | Active behavior or contract |
| Verification | `tests/node/html-local-first-followup.test.mjs` | Automated expectation |
| Verification | `tests/node/html-preview-settings-security-followup.test.mjs` | Automated expectation |
| Verification | `tests/unit/electron/html-preview-server.test.ts` | Automated expectation |

---

[← Application State Model](05-state-model.md) · [Documentation index](../README.md) · [Persistence Architecture →](07-persistence-and-storage.md)
