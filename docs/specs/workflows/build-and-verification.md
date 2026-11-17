---
schema_version: 1
id: "workflow.build-and-verification"
title: "Build, Versioning, and Verification"
kind: "workflow"
status: "verified"
summary: "Monorepo build orchestration, version synchronization, multi-platform packaging scripts, and unit/contract/typecheck verification workflows."
tags: ["build", "scripts", "testing", "versioning", "ci", "packaging"]
source_paths: [".github/scripts/release-notes.mjs", ".github/workflows/build-all.yml", ".github/workflows/deploy-website.yml", ".github/workflows/release.yml", ".github/workflows/test.yml", ".vscode/launch.json", ".vscode/tasks.json", "package.json", "pnpm-workspace.yaml", "scripts/configure-tauri-updater.mjs", "scripts/fetch-marketplace-stats.mjs", "scripts/sync-readme.mjs", "scripts/sync-versions.mjs", "ui/scripts/dev-tauri.mjs", "vitest.config.ts"]
related_specs: ["architecture.ui-state-and-runtimes", "architecture.runtime-tauri", "architecture.runtime-electron", "architecture.runtime-vscode", "architecture.runtime-chromium-and-web-demo"]
last_doc_update_at: "2026-11-17T03:16:00Z"
last_verified_at: "2026-11-17T03:16:00Z"
last_verified_code_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_at: "2026-11-17T03:16:00Z"
source_fingerprint: "sha256:8ff2365e84d25744e0f1aafbb7a91dd03cdc7c24045e85bb6ee5293e8103c3fe"
---

# Build, Versioning, and Verification

## Overview

Documents the root monorepo scripts, version synchronization across all package/manifest targets, build pipelines for every runtime, and the automated test and typecheck suites.

## Scope and entry points

## Code map

- Root configuration & scripts: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `.vscode/launch.json`, `.vscode/tasks.json`
- CI & release workflows: `.github/workflows/{build-all,release,deploy-website,test}.yml`, `.github/scripts/release-notes.mjs`
- Automation & build scripts: `scripts/` (`sync-versions.mjs`, `sync-readme.mjs`, `configure-tauri-updater.mjs`, `fetch-marketplace-stats.mjs`, `build-desktop.mjs`, `build-vscode.mjs`, `package-*.mjs`, etc.) and `ui/scripts/dev-tauri.mjs`

## Key workflows and behavior

- **Build & dev**: `pnpm run build` compiles the shared `ui` bundle and `vscode`; runtime-specific scripts target `tauri` (`dev:tauri` via `ui/scripts/dev-tauri.mjs`, launching Vite HMR on `127.0.0.1:5174` with a temporary `dev-tauri.conf.json` override in the global Tauri cache), `electron`, `vscode`, and `website-app` (`dev:web`, `start:web`, `preview:web`, `start:web:built`, `build:website-app`). `.vscode/launch.json` provides a `"Website"` Chrome launch against `http://localhost:5173/markdown-explorer/` backed by the `dev: website-app` task (`pnpm run dev:web`) in `.vscode/tasks.json`. `chromium-xtension` has been removed from `pnpm-workspace.yaml`, `package.json`, `vitest.config.ts`, CI workflows, and `.github/scripts/release-notes.mjs`.
- **Version & README synchronization**: `scripts/sync-versions.mjs` propagates the root version across workspace `package.json` manifests, `tauri/Cargo.toml`, `tauri/tauri.conf.json`, and `website/llm.txt`, then invokes `syncReadme()` from `scripts/sync-readme.mjs` (also runnable via `pnpm run sync-readme`) to keep `vscode/README.md` synchronized with `README.md` while retaining `## VS Code Extension Tutorial` and rewriting relative links to GitHub blob URLs.
- **CI & packaging**: `.github/workflows/{build-all,release}.yml` build VS Code (`.vsix`), Electron desktop, and Tauri desktop (with Linux AppImage builds pinned to `ubuntu-22.04` for glibc baseline compatibility and `rust-cache` keyed by `matrix.os`). `.github/workflows/test.yml` runs `test:vscode`, `test:website`, UI/Electron/VS Code/Web builds, and Web app typechecks.
- **Verification**:
  - `pnpm test` runs the Vitest suite across `electron`, `vscode`, `ui`, `contracts`, `manifest`, `build`, and `website` projects (`tests/unit/website/**/*.test.{ts,tsx}` with `tests/setup/website.ts`).
  - `pnpm run typecheck` and package-level `tsc --noEmit` scripts validate strict TypeScript across workspaces.
  - `cargo check` / `cargo test` validate the Rust Tauri backend.

## Architecture and design notes

- Packaging and release scripts live in `scripts/` as Node `.mjs` modules so Windows, macOS, and Linux CI/local workflows share identical orchestration logic.

## Verification

- Root commands: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm run test:website`, `pnpm run sync-readme`.
- Contract tests in `tests/contracts/` guard package manifests (`package-config.test.ts`), README sync (`readme-sync.test.ts`), release notes (`release-notes.test.ts`), workflow configuration (`workflow-config.test.ts`), website homepage invariants, and insights exclusion in the web demo.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [Tauri Desktop Runtime](../architecture/runtime-tauri.md)
- [Electron Desktop Runtime](../architecture/runtime-electron.md)
- [VS Code Extension Runtime](../architecture/runtime-vscode.md)
- [Chromium Extension and Website Demo](../architecture/runtime-chromium-and-web-demo.md)

## Known limitations and open questions

- None found.
