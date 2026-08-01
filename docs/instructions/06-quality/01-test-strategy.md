---
timestamp: '2026-08-01T22:54:00+07:00'
name: Test Strategy
topic: Test layers, ownership, and regression expectations
document_type: quality
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- package.json
- vitest.config.ts
- tests/manifest/coverage-manifest.ts
- tests/node/read-refactored-source.mjs
test_scope:
- tests/manifest/coverage-manifest.test.ts
- tests/contracts/package-config.test.ts
runtime_scope:
- all
keywords:
- quality
- verification
- release
---

# Test Strategy

## Test layers

| Layer | Command/project | Purpose |
|---|---|---|
| Node contracts | `pnpm test:node` | Dependency-light behavior/source contracts |
| UI | `pnpm test:ui` | React, DOM, Markdown, contexts, settings, hooks |
| Electron | `pnpm test:electron` | Host services and packaging behavior |
| VS Code | `pnpm test:vscode` | Extension/panel/parser integration |
| Chromium | `pnpm test:chromium` | Browser handles, host, scanner, search |
| Contracts/build/manifest | `pnpm test:contracts` | Parity, LOC, dead code, workflow/config, coverage manifest |
| Tauri | `pnpm test:tauri` | Rust host and native conversion |
| Full JS suite | `pnpm test` | All Vitest projects |
| Coverage | `pnpm test:coverage` | Instrumented coverage reporting |
| Desktop aggregate | `pnpm test:desktop` | Electron + Tauri |

## Requirement-to-test rule

- Every new use case has success and failure-path verification at the narrowest appropriate layer.
- Protocol changes require parity/dispatcher tests.
- Security changes require negative tests for blocked path/scheme/network behavior.
- Race/cancellation fixes require stale-result regression tests.
- UI tests assert semantics and behavior, not fragile visual snapshots alone.

## Verification order

1. Focused changed test.
2. Relevant project suite.
3. Contract tests.
4. Full suite/build for release changes.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `package.json` | Active behavior or contract |
| Implementation | `vitest.config.ts` | Active behavior or contract |
| Implementation | `tests/manifest/coverage-manifest.ts` | Active behavior or contract |
| Implementation | `tests/node/read-refactored-source.mjs` | Active behavior or contract |
| Verification | `tests/manifest/coverage-manifest.test.ts` | Automated expectation |
| Verification | `tests/contracts/package-config.test.ts` | Automated expectation |

---

[← Source Traceability Index](../05-reference/12-source-traceability-index.md) · [Documentation index](../README.md) · [Contract, Parity, Dead-Code, and LOC Gates →](02-contract-parity-dead-code-loc.md)
