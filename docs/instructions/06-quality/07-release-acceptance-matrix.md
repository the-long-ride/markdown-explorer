---
timestamp: '2026-08-01T22:54:00+07:00'
name: Release Acceptance Matrix
topic: Product-level release readiness across use cases, hosts, security, and delivery
document_type: quality
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- package.json
- .github/workflows/test.yml
- .github/workflows/release.yml
- .github/STORE_PUBLISHING.md
test_scope:
- tests/manifest/coverage-manifest.test.ts
- tests/contracts/workflow-config.test.ts
- tests/contracts/package-config.test.ts
runtime_scope:
- all
keywords:
- quality
- verification
- release
---

# Release Acceptance Matrix

## Product acceptance

| Area | Required evidence |
|---|---|
| Launch | Ready/unavailable/selection paths work in every shipped runtime |
| Workspace | Folder/file/recent/drop/external open, partial scan, cancel, watch, recovery |
| Navigation | Sidebar, TOC, links, history, workspace tabs, content tabs, scroll memory |
| Search | Find, workspace, cross-tab where supported; stale request suppression |
| Rendering | Markdown/MDX corpus, code, tables, math, Mermaid, media, HTML sandbox |
| Conversion | Enable/disable, cache, formats, warnings/failures on capable hosts |
| Settings | Every key, shortcuts, themes, import/export, localization, onboarding |
| Desktop | Window/tray/fullscreen/zoom/quit and updater capability gating |
| Security | Path containment, dangerous URL blocking, HTML network restrictions |
| Performance | Incremental reveal, bounded work/results, cleanup/cancellation |

## Host acceptance

- Electron installed, portable, and intended macOS/Linux artifacts behave according to capability.
- Tauri local protocols, conversion, window state, and configured update path pass.
- VS Code commands, webview panel, editor actions, watching, and packaging pass.
- Chromium handles, permission recovery, scanning, polling, search, and IndexedDB pass.
- Website demo and file mode remain browser-safe and deploy successfully.

## Release decision

Release is blocked by failed required tests, contract drift, incomplete artifact set for the announced channel, security regression, or undocumented active behavior. Known non-blocking limitations are written explicitly in release notes.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `package.json` | Active behavior or contract |
| Implementation | `.github/workflows/test.yml` | Active behavior or contract |
| Implementation | `.github/workflows/release.yml` | Active behavior or contract |
| Implementation | `.github/STORE_PUBLISHING.md` | Active behavior or contract |
| Verification | `tests/manifest/coverage-manifest.test.ts` | Automated expectation |
| Verification | `tests/contracts/workflow-config.test.ts` | Automated expectation |
| Verification | `tests/contracts/package-config.test.ts` | Automated expectation |

---

[← Documentation Maintenance](06-documentation-maintenance.md) · [Documentation index](../README.md)
