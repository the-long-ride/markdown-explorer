---
timestamp: '2026-08-01T22:54:00+07:00'
name: Source-of-Truth Rules
topic: How specifications map to active source
document_type: specification
status: active
ui_spec: false
parent_docs:
- ../README.md
related_docs:
- 01-documentation-governance.md
- 06-coverage-matrix.md
source_scope:
- ui/src/types/webviewMessages.ts
- ui/src/types/hostMessages.ts
- tests/contracts/host-message-parity.test.ts
- tests/contracts/dead-code-removal.test.ts
test_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/dead-code-removal.test.ts
runtime_scope:
- shared
keywords: []
---

# Source-of-Truth Rules

## Authority order

1. Active typed contracts and runtime handlers.
2. Shared React behavior and state reducers.
3. Runtime-specific implementations.
4. Automated tests and contracts.
5. Packaging and workflow configuration.
6. This documentation.

When documents conflict with active source, source wins and the documentation must be corrected in the same change.

## Active-code test

A file is source evidence when it is imported, invoked by an active entry point, or enforced by a test/build/runtime contract. Vendor code, generated output, and unreachable remnants are not product specifications.

## Traceability rule

Every use case identifies:

- UI component or shared state implementation.
- Typed command/message when crossing the host boundary.
- Runtime handler for each supported host.
- Automated test when one exists.

## Naming rule

Never translate identifiers. Examples: `renderContent`, `confirmOpenPath`, `openShellLocation`, `searchScopeFocus`, and `workspaceOperationId` remain exact.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/webviewMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/hostMessages.ts` | Active behavior or contract |
| Implementation | `tests/contracts/host-message-parity.test.ts` | Active behavior or contract |
| Implementation | `tests/contracts/dead-code-removal.test.ts` | Active behavior or contract |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/dead-code-removal.test.ts` | Automated expectation |

---

[← Actors and Terminology](03-actors-and-terminology.md) · [Documentation index](../README.md) · [Reading Map →](05-reading-map.md)
