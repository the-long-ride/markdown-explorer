---
timestamp: '2026-09-17T00:00:00+07:00'
name: Build and Release Specification
topic: Build commands, version synchronization, release artifacts, and verification
document_type: quality
status: active
ui_spec: false
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs:
- ../../superpowers/specs/2026-09-17-pr48-as-built-sync.md
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
- version
---

# Build and Release Specification

## Current unreleased target

PR #48 / `feature/editor-git-history-split-view` targets **1.6.9**. The 1.6.9 target is intentionally above the separate 1.6.8 hot-fix line. It is still an unreleased/manual-validation target until the PR is explicitly approved and merged.

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

Root `package.json` is the authoritative application version. `prebuild`, `precompile`, and runtime prebuild scripts invoke `scripts/sync-versions.mjs`.

For 1.6.9 the synchronized targets are:

- `ui/package.json`
- `vscode/package.json`
- `electron/package.json`
- `chromium-xtension/package.json`
- `chromium-xtension/manifest.json`
- `website-app/package.json`
- `tauri/package.json`
- `tauri/tauri.conf.json`
- `tauri/Cargo.toml`
- public website/LLM version metadata managed by the sync script

A release must not publish with mixed application versions. Version metadata identifies the build target; it does not replace the manual PR/release acceptance gate.

## Signed Tauri updater artifacts

- Release jobs require `TAURI_UPDATER_PUBLIC_KEY`, `TAURI_SIGNING_PRIVATE_KEY`, and its password.
- `scripts/configure-tauri-updater.mjs` replaces the public-key sentinel before build and rejects missing/placeholder input.
- `bundle.createUpdaterArtifacts=true` creates updater signatures.
- Windows uploads NSIS `.exe` plus `.exe.sig`; Linux uploads AppImage plus `.AppImage.sig`; macOS builds `app,dmg` and uploads `.app.tar.gz` plus `.sig`.
- Artifact renaming moves a companion signature with its installer so release pairs stay addressable. Missing updater outputs fail the upload step.

## Release verification

1. Run `pnpm run sync-versions` and verify no intended target remains on an older application version.
2. Clean install from the lockfile.
3. Run required tests/contracts.
4. Build each intended artifact.
5. Inspect artifact names/version/platform/architecture.
6. Verify installed vs portable updater capability.
7. Generate release notes and checksums/signatures according to workflow.
8. Publish only after platform-specific smoke validation and the PR release-acceptance gate.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `package.json` | Authoritative version and active build scripts |
| Implementation | `scripts/sync-versions.mjs` | Cross-runtime/site version synchronization |
| Implementation | `scripts/configure-tauri-updater.mjs` | Validates and injects Tauri updater public key |
| Implementation | `.github/scripts/release-notes.mjs` | Release-note generation |
| Implementation | `.github/workflows/release.yml` | Release artifact workflow |
| Verification | `tests/contracts/package-config.test.ts` | Package-version and build configuration expectations |
| Verification | `tests/contracts/release-notes.test.ts` | Release-note expectations |
| Verification | `tests/node/build-regressions.test.mjs` | Build regression coverage |
| Verification | `tests/node/tauri-updater-contract.test.mjs` | Signed updater workflow/runtime contract |

---

[← Continuous Integration Workflows](03-ci-workflows.md) · [Documentation index](../README.md) · [Installers, Stores, and File Associations →](05-installers-stores-associations.md)
