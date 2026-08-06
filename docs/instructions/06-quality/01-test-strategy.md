---
timestamp: '2026-08-05T06:40:23+07:00'
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
- Search changes require coverage for default insensitive matching, exact-case propagation, full-file preview loading/positioning, Preview toggle behavior, workspace checkbox filtering, separator resizing contracts, tooltip arrow navigation, and translated labels.

## Verification order

1. Focused changed test.
2. Relevant project suite.
3. Contract tests.
4. Full suite/build for release changes.

## Search regression matrix

Dependency-light contracts: `tests/node/search-case-runtime.test.mjs`, `tests/node/search-ui-contracts.test.mjs`, `tests/node/search-preview-runtime.test.mjs`, and `tests/node/search-preview-host-contracts.test.mjs`.

| Boundary | Required proof |
|---|---|
| Current file | Toggle changes highlighted DOM match count and navigation. |
| Current workspace | `matchCase` reaches host search and exact metadata/content results. |
| Cross-tab | Worker receives original query casing plus checked `tabIds`, and excludes unchecked workspaces. |
| Preview runtime | Every host validates the indexed path and returns full Markdown/text source or a bounded failure. |
| Modal interaction | Row click selects; Preview defaults on and positions the rendered file; visible tooltip arrow opens. |
| Layout | Both separators expose translated labels and preserve bounded modal columns; active result has no rail. |
| Localization | Every key in the shared `search` domain exists for all nine locales. |

## Bookmark and updater regression matrix

| Boundary | Required proof |
|---|---|
| Bookmark model | v1→v2 migration, exact source anchors, mixed multiline fragments, repeated occurrence, edit relocation, object identity, ambiguity protection. |
| Persistence | Add/rename/delete/reload, verified write/read-back, silent storage failure, atomic batch delete, and corrupt/unknown version-2 fallback. |
| Renderer/capture | Block source metadata plus mixed DOM Range, LaTeX, Mermaid, image, code, and link capture. |
| UI wiring | Natural-width tabs, shared transition, equal search rows, active count, two-row controls, batch selection, supplied icons/tooltips, translated green success/red error toast feedback, and nine locales. |
| Navigation | Workspace/file validation, exact source/object lookup, transient highlight, and target-changed no-jump behavior. |
| User manual | Second welcome tab, search, task sections, action events, platform shortcut labels, and nine-locale copy. |
| Tauri updater | Official plugin initialization, verified download/install, progress, deferred restore, close apply, restart apply, signed artifact workflow. |

Dependency-light suites: `tests/node/bookmarks.test.mjs`, `tests/node/bookmark-*.test.mjs`, `tests/node/bookmark-save-feedback.test.mjs`, `tests/node/sidebar-focus-search-layout.test.mjs`, `tests/node/user-manual-home.test.mjs`, and `tests/node/tauri-updater-contract.test.mjs`. The focus-aware search suite proves that changing scope with an existing query reruns search and excludes unfocused files.

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
