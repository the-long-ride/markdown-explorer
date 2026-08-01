---
timestamp: '2026-08-01T22:54:00+07:00'
name: Contract, Parity, Dead-Code, and LOC Gates
topic: Static behavioral gates that keep hosts and source maintainable
document_type: quality
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-dispatcher-parity.test.ts
- tests/contracts/markdown-parity.test.ts
- tests/contracts/dead-code-removal.test.ts
- tests/contracts/source-loc.test.ts
- tests/contracts/ui-style-contract.test.ts
test_scope:
- tests/contracts/host-message-parity.test.ts
- tests/contracts/tauri-dispatcher-parity.test.ts
- tests/contracts/dead-code-removal.test.ts
- tests/contracts/source-loc.test.ts
runtime_scope:
- all
keywords:
- quality
- verification
- release
---

# Contract, Parity, Dead-Code, and LOC Gates

## Active gates

| Gate | Purpose |
|---|---|
| Host-message parity | Shared union and host implementations cannot silently drift |
| Tauri dispatcher/message parity | Rust dispatcher/events remain aligned with shared protocol |
| Markdown parity | Shared and VS Code renderer behavior remains compatible |
| Platform paths | Runtime path conventions remain valid |
| Package/workflow config | Scripts and release workflows retain required structure |
| Windows installer | Explorer integration/options remain present and intentional |
| Fullscreen/header style | Frameless/fullscreen UI remains operable |
| Dead-code removal | Removed/forbidden source patterns do not return |
| Source LOC | Large files are constrained and decomposition remains enforceable |
| UI style contract | CSS organization/behavior requirements remain valid |

## Change procedure

A gate is not bypassed by weakening its test. When a product requirement changes, update the implementation, specification, fixtures, and gate together with an explicit rationale.

## Dead-code documentation rule

This instruction set references only files that exist and active contracts. If a source path is removed, documentation validation fails until traceability is updated.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `tests/contracts/host-message-parity.test.ts` | Active behavior or contract |
| Implementation | `tests/contracts/tauri-dispatcher-parity.test.ts` | Active behavior or contract |
| Implementation | `tests/contracts/markdown-parity.test.ts` | Active behavior or contract |
| Implementation | `tests/contracts/dead-code-removal.test.ts` | Active behavior or contract |
| Implementation | `tests/contracts/source-loc.test.ts` | Active behavior or contract |
| Implementation | `tests/contracts/ui-style-contract.test.ts` | Active behavior or contract |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/tauri-dispatcher-parity.test.ts` | Automated expectation |
| Verification | `tests/contracts/dead-code-removal.test.ts` | Automated expectation |
| Verification | `tests/contracts/source-loc.test.ts` | Automated expectation |

---

[← Test Strategy](01-test-strategy.md) · [Documentation index](../README.md) · [Continuous Integration Workflows →](03-ci-workflows.md)
