---
timestamp: '2026-08-01T22:54:00+07:00'
name: Source Traceability Index
topic: Active implementation ownership by product domain
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../06-quality/07-release-acceptance-matrix.md
source_scope:
- ui/src/main.tsx
- electron/core/main-runtime.js
- tauri/src/lib.rs
- vscode/src/extension.ts
- chromium-xtension/src/chrome-host.ts
- website-app/src/web-host.ts
- package.json
test_scope:
- tests/contracts/dead-code-removal.test.ts
- tests/contracts/host-message-parity.test.ts
- tests/manifest/coverage-manifest.test.ts
runtime_scope:
- shared
keywords:
- traceability
- source
---

# Source Traceability Index

| Domain | Shared UI | Electron | Tauri | VS Code | Chromium/Website |
|---|---|---|---|---|---|
| Entry/bridge | `ui/src/main.tsx`, `ui/src/platform/*` | preload/main runtime | preload/core bootstrap | panel/extension | chrome/web host |
| Workspace | components/desktop contexts | workspace scanner/watch/recents | workspace modules | scanner/incremental/watch | file access/scanner/file mode |
| Rendering | `ui/src/markdown/*`, Content | source/converter handlers | render/converter | `vscode/src/markdown/*` | host renderer paths |
| Search | Search components/effects | search index/worker | search modules | panel search | search index/test search |
| HTML/resources | HTML preview modules | preview server/resource handler | local file/HTML preview | preview server/resources | in-page sandbox |
| Settings/themes | Settings, contexts, theme | bridge persistence | preload/dispatcher settings | webview state/config | chrome/web state |
| Desktop lifecycle | Desktop components | window/tray/update/startup | window/update/bootstrap | host-owned | not applicable |
| Delivery | root scripts/docs | package/installer | Cargo/Tauri configs | extension package | extension/website builds |

## Agent lookup procedure

1. Start with use-case ID.
2. Read its source/test scope.
3. Follow to matching feature specification.
4. Check exact command/message/settings references.
5. Inspect runtime spec before changing host behavior.
6. Update acceptance matrix and documentation when behavior changes.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/main.tsx` | Active behavior or contract |
| Implementation | `electron/core/main-runtime.js` | Active behavior or contract |
| Implementation | `tauri/src/lib.rs` | Active behavior or contract |
| Implementation | `vscode/src/extension.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/chrome-host.ts` | Active behavior or contract |
| Implementation | `website-app/src/web-host.ts` | Active behavior or contract |
| Implementation | `package.json` | Active behavior or contract |
| Verification | `tests/contracts/dead-code-removal.test.ts` | Automated expectation |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |
| Verification | `tests/manifest/coverage-manifest.test.ts` | Automated expectation |

---

[← Core Data Models](11-core-data-models.md) · [Documentation index](../README.md) · [Test Strategy →](../06-quality/01-test-strategy.md)
