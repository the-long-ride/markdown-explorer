---
timestamp: '2026-08-01T22:54:00+07:00'
name: Website Demo and Browser File Mode
topic: Virtual demo host, browser file utility mode, search, persistence, and native-feature exclusions
document_type: runtime
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- website-app/src/main-web.tsx
- website-app/src/virtual-workspace.ts
- website-app/src/web-file-mode.ts
- website-app/src/web-file-utility-router.ts
- website-app/src/web-host.ts
- website-app/src/web-test-host.ts
- website-app/src/web-test-message-router.ts
- website-app/src/web-test-search.ts
test_scope:
- tests/unit/ui/website/demoDropdown.test.ts
- tests/contracts/website-homepage.test.ts
- tests/unit/chromium/web-file-mode.test.ts
- tests/node/website-image-viewer.test.mjs
runtime_scope:
- website
keywords:
- runtime
- host
- parity
---

# Website Demo and Browser File Mode

## Modes

| Mode | Data source | Purpose |
|---|---|---|
| Demo | Bundled virtual workspace | Explore the UI without file permissions |
| Browser file mode | User-selected browser files/handles | Read local documentation in a normal web page |
| Test host | Deterministic virtual messages/data | Automated website/UI verification |

## Host behavior

The website exposes `__webDemoBus`, selected by `ui/src/main.tsx`. `web-host.ts` routes common messages over virtual or file-mode services; search and message routing use focused modules.

## Persistence and limitations

- Shared state key: `markdown-explorer-web-state`.
- No native tray, window controls, file manager reveal, installer updater, or privileged editor integration.
- Browser permissions and APIs determine file mode availability.
- Demo files are virtual and cannot imply native filesystem changes.
- HTML preview remains sandboxed in-page.
- Document conversion is not a native website capability.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `website-app/src/main-web.tsx` | Active behavior or contract |
| Implementation | `website-app/src/virtual-workspace.ts` | Active behavior or contract |
| Implementation | `website-app/src/web-file-mode.ts` | Active behavior or contract |
| Implementation | `website-app/src/web-file-utility-router.ts` | Active behavior or contract |
| Implementation | `website-app/src/web-host.ts` | Active behavior or contract |
| Implementation | `website-app/src/web-test-host.ts` | Active behavior or contract |
| Implementation | `website-app/src/web-test-message-router.ts` | Active behavior or contract |
| Implementation | `website-app/src/web-test-search.ts` | Active behavior or contract |
| Verification | `tests/unit/ui/website/demoDropdown.test.ts` | Automated expectation |
| Verification | `tests/contracts/website-homepage.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/web-file-mode.test.ts` | Automated expectation |
| Verification | `tests/node/website-image-viewer.test.mjs` | Automated expectation |

---

[← Chromium Extension Runtime](04-chromium-extension.md) · [Documentation index](../README.md) · [Runtime Parity and Capability Matrix →](06-runtime-parity.md)
