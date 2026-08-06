---
timestamp: '2026-08-05T06:40:23+07:00'
name: Build and Release Specification
topic: Build commands, version synchronization, release artifacts, and verification
document_type: quality
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- package.json
- scripts/sync-versions.mjs
- scripts/configure-tauri-updater.mjs
- .github/scripts/release-notes.mjs
- .github/workflows/release.yml
test_scope:
- tests/contracts/package-config.test.ts
- tests/contracts/release-notes.test.ts
- tests/node/build-regressions.test.mjs
- tests/node/tauri-updater-contract.test.mjs
runtime_scope:
- all
keywords:
- quality
- verification
- release
---

# Build and Release Specification

## Main build commands

| Command | Output |
|---|---|
| `pnpm build` / `pnpm compile` | Shared UI and VS Code compilation |
| `pnpm build:electron` | Electron distribution |
| `pnpm build:electron:nsis` | Windows installed NSIS |
| `pnpm build:electron:portable` | Windows portable |
| `pnpm build:electron:win-zip` | Windows ZIP |
| `pnpm build:electron:mac` | macOS artifacts |
| `pnpm build:electron:linux` | Linux artifacts |
| `pnpm build:tauri` | Tauri desktop artifacts |
| `pnpm build:chromium` | Chromium extension |
| `pnpm build:website-app` | Website application |
| `pnpm package` | VS Code extension package path |

## Versioning

`prebuild`, `precompile`, and runtime prebuild scripts invoke `scripts/sync-versions.mjs`. A release must keep root and runtime package/config versions consistent.

## Signed Tauri updater artifacts

- Release jobs require `TAURI_UPDATER_PUBLIC_KEY`, `TAURI_SIGNING_PRIVATE_KEY`, and its password.
- `scripts/configure-tauri-updater.mjs` replaces the public-key sentinel before build and rejects missing/placeholder input.
- `bundle.createUpdaterArtifacts=true` creates updater signatures.
- Windows uploads NSIS `.exe` plus `.exe.sig`; Linux uploads AppImage plus `.AppImage.sig`; macOS builds `app,dmg` and uploads `.app.tar.gz` plus `.sig`.
- Artifact renaming moves a companion signature with its installer so release pairs stay addressable. Missing updater outputs fail the upload step.

## Release verification

1. Clean install from lockfile.
2. Required tests/contracts.
3. Build each intended artifact.
4. Inspect artifact names/version/platform/architecture.
5. Verify installed vs portable updater capability.
6. Generate release notes and checksums/signatures according to workflow.
7. Publish only after platform-specific smoke validation.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `package.json` | Active behavior or contract |
| Implementation | `scripts/sync-versions.mjs` | Active behavior or contract |
| Implementation | `scripts/configure-tauri-updater.mjs` | Validates and injects Tauri updater public key |
| Implementation | `.github/scripts/release-notes.mjs` | Active behavior or contract |
| Implementation | `.github/workflows/release.yml` | Active behavior or contract |
| Verification | `tests/contracts/package-config.test.ts` | Automated expectation |
| Verification | `tests/contracts/release-notes.test.ts` | Automated expectation |
| Verification | `tests/node/build-regressions.test.mjs` | Automated expectation |
| Verification | `tests/node/tauri-updater-contract.test.mjs` | Signed updater workflow and runtime contract |

---

[← Continuous Integration Workflows](03-ci-workflows.md) · [Documentation index](../README.md) · [Installers, Stores, and File Associations →](05-installers-stores-associations.md)
