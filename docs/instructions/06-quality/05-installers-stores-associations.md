---
timestamp: '2026-08-01T22:54:00+07:00'
name: Installers, Stores, and File Associations
topic: Windows Explorer integration, desktop stores, file associations, and publishing requirements
document_type: quality
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- electron/build/installer.nsh
- electron/package.json
- tauri/tauri.conf.json
- tauri/tauri.microsoft-store.conf.json
- tauri/windows/explorer-hooks.nsh
- tauri/linux/markdown-explorer.desktop
- .github/STORE_PUBLISHING.md
test_scope:
- tests/contracts/windows-explorer-installer.test.ts
- tests/node/windows-installer-options.test.mjs
- tests/contracts/tauri-platform-associations.test.ts
runtime_scope:
- all
keywords:
- quality
- verification
- release
---

# Installers, Stores, and File Associations

## Electron Windows installer

- NSIS assisted per-user installation.
- User can change installation directory.
- Desktop and Start menu shortcuts are not forced by default.
- Explorer integration is installed/removed through maintained hooks.
- Markdown/MDX file associations follow package metadata.
- Installed build and portable build remain distinguishable for updater capability.

## Tauri platform packaging

- Platform-specific associations and manifest/config are maintained in Tauri configuration.
- Windows Store configuration is separate from general desktop configuration.
- Linux desktop entry identifies application and supported launch behavior.
- Signing/update placeholders must be replaced before production publishing.

## Store publishing

Follow `.github/STORE_PUBLISHING.md` and store workflow requirements for credentials, identifiers, artifacts, descriptions, and validation. Store metadata must match actual runtime capability.

## Uninstall requirement

Installer-created shell hooks and associations are removed without deleting user workspaces or imported documentation.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `electron/build/installer.nsh` | Active behavior or contract |
| Implementation | `electron/package.json` | Active behavior or contract |
| Implementation | `tauri/tauri.conf.json` | Active behavior or contract |
| Implementation | `tauri/tauri.microsoft-store.conf.json` | Active behavior or contract |
| Implementation | `tauri/windows/explorer-hooks.nsh` | Active behavior or contract |
| Implementation | `tauri/linux/markdown-explorer.desktop` | Active behavior or contract |
| Implementation | `.github/STORE_PUBLISHING.md` | Active behavior or contract |
| Verification | `tests/contracts/windows-explorer-installer.test.ts` | Automated expectation |
| Verification | `tests/node/windows-installer-options.test.mjs` | Automated expectation |
| Verification | `tests/contracts/tauri-platform-associations.test.ts` | Automated expectation |

---

[← Build and Release Specification](04-build-and-release.md) · [Documentation index](../README.md) · [Documentation Maintenance →](06-documentation-maintenance.md)
