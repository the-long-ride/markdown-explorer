---
timestamp: '2026-08-01T22:54:00+07:00'
name: Chromium Extension Runtime
topic: Browser file handles, IndexedDB, scanning, polling, search, and capability limits
document_type: runtime
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- ui/src/platform/chrome.ts
- chromium-xtension/src/chrome-host.ts
- chromium-xtension/src/file-access.ts
- chromium-xtension/src/scanner.ts
- chromium-xtension/src/incremental-workspace-scan.ts
- chromium-xtension/src/current-file-watcher.ts
- chromium-xtension/src/search-index.ts
- chromium-xtension/src/media-resolver.ts
- chromium-xtension/src/recent-workspaces.ts
test_scope:
- tests/unit/chromium/chrome-bridge.test.ts
- tests/unit/chromium/chrome-host.test.ts
- tests/unit/chromium/file-access.test.ts
- tests/unit/chromium/incremental-workspace-scan.test.ts
- tests/unit/chromium/search-index.test.ts
runtime_scope:
- chromium
keywords:
- runtime
- host
- parity
---

# Chromium Extension Runtime

## Access model

Chromium uses the File System Access API. Directory/file handles are user-granted capabilities and are persisted in IndexedDB database `markdown-explorer-db`, store `workspaces`. Reopen requires valid permission; permission loss is recoverable.

## Host responsibilities

| Module area | Behavior |
|---|---|
| Chrome bridge/host | Adapt bus messages and common command protocol |
| File access | Pick, validate, read, and persist handles |
| Scanner | Traverse Markdown/MDX handles incrementally |
| Current-file watcher | Poll around 3000 ms for active source changes |
| Search index | Index browser-readable workspace metadata/content |
| Media resolver | Create safe browser URLs for workspace media |
| Browser font host | Store imported `.ttf`/`.otf`/`.woff`/`.woff2` fonts in IndexedDB `markdown-explorer-browser-fonts` and activate via Blob URLs |
| Recents | Store/reopen handles without exposing native paths |

## Capability differences

- Document conversion is disabled.
- Native shell reveal, tray, installer updater, and OS window controls are unavailable.
- Custom fonts are managed in-browser using IndexedDB storage and the standard `FontFace` API.
- Interactive table controls (column toggles and chart switchers) utilize delegated event listeners in `useContentEffects` and `SearchDocumentPreview` to comply with Manifest V3 Content Security Policy rules.
- Scanner is limited to browser-readable supported types, principally Markdown/MDX.
- Handle permission can expire and must be requested again rather than treated as permanent missing data.
- Bridge state key is `markdown-explorer-chrome-state`.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/platform/chrome.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/chrome-host.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/chrome-host-export.ts` | Export resource reading and browser download save bridge |
| Implementation | `chromium-xtension/src/browser-font-host.ts` | Font host command router |
| Implementation | `chromium-xtension/src/browser-font-service.ts` | IndexedDB font persistence and FontFace loading |
| Implementation | `chromium-xtension/src/file-access.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/scanner.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/incremental-workspace-scan.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/current-file-watcher.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/search-index.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/media-resolver.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/recent-workspaces.ts` | Active behavior or contract |
| Verification | `tests/unit/chromium/chrome-bridge.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/chrome-host.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/chrome-host-export.test.ts` | Export resource and save bridge tests |
| Verification | `tests/node/browser-font-service-behavior.test.mjs` | Browser font service tests |
| Verification | `tests/node/browser-typography-contract.test.mjs` | Browser typography contract |
| Verification | `tests/unit/chromium/file-access.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/incremental-workspace-scan.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/search-index.test.ts` | Automated expectation |

---

[← VS Code Extension Runtime](03-vscode-extension.md) · [Documentation index](../README.md) · [Website Demo and Browser File Mode →](05-website-demo-file-mode.md)
