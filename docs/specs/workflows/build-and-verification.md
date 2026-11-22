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
last_doc_update_at: "2026-11-20T11:45:00Z"
last_verified_at: "2026-11-20T11:45:00Z"
last_verified_code_commit: "f0818d86f926ee15c5508b3bc186e1ddf18f50b8"
last_source_change_commit: "5c29d99733a2a76d04ac75dc51ff685c0a1b8724"
last_source_change_at: "2026-11-20T10:48:12+07:00"
source_fingerprint: "sha256:64d687597d199c8beb52dba8ff4919f5e05d876ac0e1fb0d14bba6609049eebb"
---

# Build, Versioning, and Verification

## Purpose and boundaries

Documents the root monorepo scripts and dependency policies, version and README synchronization across runtime manifests, local development runners and VS Code debug configurations, multi-platform GitHub Actions CI/release/Pages pipelines, and automated Vitest, Node, and Rust verification suites.

- **In scope**: `package.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, `scripts/{sync-versions,sync-readme,configure-tauri-updater,fetch-marketplace-stats}.mjs`, `ui/scripts/dev-tauri.mjs`, `.vscode/{launch,tasks}.json`, `.github/workflows/{build-all,deploy-website,release,test}.yml`, and `.github/scripts/release-notes.mjs`.
- **Out of scope**: Runtime-internal application logic (`architecture.runtime-*`) and auxiliary store-publishing/cron workflows (`.github/workflows/publish-desktop-stores.yml`, `.github/workflows/refresh-marketplace-stats.yml`).

## Observable behavior

- **Workspace & dependency policy (`package.json`, `pnpm-workspace.yaml`)**:
  - Monorepo managed by `pnpm@12.11.2` across 5 active workspace packages: `ui`, `vscode`, `electron`, `tauri`, and `website-app` (`chromium-xtension` has been removed from `pnpm-workspace.yaml`, `package.json`, `vitest.config.ts`, CI workflows, and `.github/scripts/release-notes.mjs`).
  - `pnpm-workspace.yaml` enforces security vulnerability `overrides` (`@types/vscode@1.85.0`, `brace-expansion@^5.0.12`, `dompurify@3.4.17`, `http-cache-semantics@^4.3.0`, `markdown-it@^14.3.3`, `katex@0.18.2`, `source-map-js@^1.2.2`, `js-yaml@^4.3.2`, `fast-uri@^3.1.9`, `fast-xml-parser@^5.12.0`, `undici@^7.30.1`, `nanoid@^3.3.17`, `pdfjs-dist@^6.2.108`, `@xmldom/xmldom@^0.8.15`, `vite@^8.3.8`, `@vitest/mocker@^4.1.12`, `@azure/msal-node@^7.1.0`, `qs@^6.16.1`, `glob@^14.0.2`, `minimatch@^11.0.1`), `minimumReleaseAgeExclude` (including `@the-long-ride/markdown-them@1.4.0`), `allowBuilds`, and `shamefullyHoist: true`.
  - Root `devDependencies` pin `vitest`, `@vitest/coverage-istanbul`, and `@vitest/coverage-v8` to `^4.1.12` and `electron` to `43.8.6`.
- **Build & local development (`package.json`, `ui/scripts/dev-tauri.mjs`, `.vscode/*`)**:
  - `pnpm run build` (`pnpm run compile`) runs `prebuild`/`precompile` (`pnpm run sync-versions`) and compiles the shared `ui` bundle (`build:ui`) and `vscode` extension (`build:vscode`).
  - Runtime-specific scripts target:
    - **Tauri**: `start:tauri` (`pnpm run build:ui:tauri && pnpm run dev:tauri`), `dev:tauri` (`node ui/scripts/dev-tauri.mjs`, which runs `ui/scripts/build-export-runtime.mjs`, starts a Vite HMR server in `tauri` mode on `127.0.0.1:5174`, writes a temporary `dev-tauri.conf.json` `build.devUrl` override into `getTauriCacheDir()`, and spawns `tauri/scripts/run-with-global-cache.mjs dev --config <devConfigPath>`), and `build:tauri` (with `prebuild:tauri` running `sync-versions` and `scripts/configure-tauri-updater.mjs`).
    - **Electron**: `start:electron` / `dev:electron` (`node ui/scripts/dev-electron.mjs`), `start:electron:built`, and `build:electron` (`:nsis`, `:portable`, `:win-zip`, `:mac`, `:linux`).
    - **VS Code**: `build:vscode`, `watch`, and `package`.
    - **Web App (`website-app`)**: `dev:web` / `start:web`, `preview:web`, `start:web:built`, and `build:website-app`.
  - `.vscode/launch.json` and `.vscode/tasks.json` define 4 debug launch configurations: `"Extension"` (`preLaunchTask: "compile"`), `"Electron Desktop App"` (`ui/scripts/dev-electron.mjs`), `"Tauri Desktop App"` (`pnpm run start:tauri`), and `"Website"` (Edge `msedge` launch against `http://localhost:5173/markdown-explorer/` backed by the `dev: website-app` background task running `pnpm run dev:web` and `sourceMapPathOverrides` mapping `/markdown-explorer/app/@fs/*` -> `/*`).
- **Version & README synchronization (`scripts/sync-versions.mjs`, `scripts/sync-readme.mjs`)**:
  - `scripts/sync-versions.mjs` propagates the root `package.json` `version` (`1.7.2`) across `ui/package.json`, `vscode/package.json`, `electron/package.json`, `website-app/package.json`, `tauri/package.json`, `tauri/tauri.conf.json`, `tauri/Cargo.toml`, `website/landing.html` (`"softwareVersion"` JSON-LD and all `<span data-version-text>v...</span>` badges), and `website/llm.txt` (`Current Release: v...`).
  - Invokes `syncReadme()` from `scripts/sync-readme.mjs` (also runnable via `pnpm run sync-readme`) to keep `vscode/README.md` synchronized with `README.md` while retaining `## VS Code Extension Tutorial` before `## Features` and rewriting relative `docs/`, `LICENSE`, and `CHANGELOG.md` links to `https://github.com/the-long-ride/markdown-explorer/blob/main/...` URLs.
- **Tauri updater & marketplace stats scripts**:
  - `scripts/configure-tauri-updater.mjs` (`normalizeUpdaterPublicKey`, `configureTauriUpdater`) validates the Base64-encoded minisign public key from `TAURI_UPDATER_PUBLIC_KEY` and configures `bundle.createUpdaterArtifacts = true` and `plugins.updater.pubkey` in `tauri/tauri.conf.json` (refusing to overwrite unexpected non-sentinel keys).
  - `scripts/fetch-marketplace-stats.mjs` queries live Open VSX and VS Code Marketplace download counts and writes `website/marketplace-stats.json`.
- **CI, packaging & release workflows (`.github/workflows/*`, `.github/scripts/release-notes.mjs`)**:
  - `.github/workflows/test.yml` runs 7 jobs: `contracts` (`test:contracts`, `test:node`, `test:update-contracts`), `translations` (`test:translations`), `ui` (`test:ui` across 4 shards), `electron` (`test:electron`), `host-variants` (`test:vscode`, `test:website`, `build:ui`, `build:ui:electron`, `build:vscode`, `pnpm --dir website-app typecheck`, `pnpm --dir website-app build`), `tauri` (`test:tauri` matrix on `ubuntu-latest`, `windows-latest`, `macos-latest`), and `tauri-coverage` (`cargo llvm-cov` enforcing an 85% coverage threshold on non-bootstrap Tauri modules).
  - `.github/workflows/{build-all,release}.yml` build VS Code (`.vsix`), Electron desktop (`windows-latest`, `ubuntu-latest`, `macos-latest`), and Tauri desktop (`windows-latest`, `ubuntu-22.04` pinned for glibc AppImage baseline compatibility, `macos-latest`, with `Swatinem/rust-cache@v2` keyed by `matrix.os`). `release.yml` gates on `test.yml` (`test-gate`), stages assets with `electron-` and `tauri-` prefixes, generates categorized markdown tables and SHA-256 checksums via `.github/scripts/release-notes.mjs` (`Windows`, `macOS`, `Linux`, `VS Code Extension`, `Other`), publishes the `.vsix` to Open VSX and VS Code Marketplace, creates the GitHub Release, and chains `publish-desktop-stores.yml`.
  - `.github/workflows/deploy-website.yml` fetches live marketplace stats (`node scripts/fetch-marketplace-stats.mjs`), builds `website-app` (`pnpm --filter ./website-app run build`), copies `website-app/dist/.` into `website/app/`, and deploys `website` to GitHub Pages.
- **Test runner & coverage configuration (`vitest.config.ts`)**:
  - Defines 7 Vitest projects (`pool: 'forks'`, `testTimeout: 20_000`): `electron`, `vscode`, `ui`, `contracts`, `manifest`, `build`, and `website` (`tests/unit/website/**/*.test.{ts,tsx}` with `tests/setup/website.ts`).
  - V8 coverage tracks `electron/**/*.js`, `vscode/src/**/*.ts`, `vscode/scripts/**/*.js`, `ui/src/**/*.{ts,tsx,js}`, `ui/vite.config.ts`, and `website-app/src/**/*.{ts,tsx}` with thresholds `lines: 85`, `functions: 85`, `branches: 80`, `statements: 85`.

## Workflow

1. **Prebuild synchronization**: Running `pnpm run build`, `pnpm run compile`, or `prebuild:*` executes `scripts/sync-versions.mjs` and `scripts/sync-readme.mjs` to align manifest versions, `website/landing.html`, `website/llm.txt`, and `vscode/README.md`.
2. **Local development & compilation**: Developers launch `pnpm run dev:tauri` (`ui/scripts/dev-tauri.mjs`), `pnpm run dev:electron`, `pnpm run dev:web`, or `pnpm run watch` (or use the corresponding `.vscode/launch.json` debug configurations).
3. **Verification**: Local and CI runs execute Vitest suites (`pnpm test`), Node `--test` contract suites (`pnpm run test:node`, `pnpm run test:update-contracts`), package typechecks (`pnpm --dir website-app typecheck`), and Rust Tauri tests/coverage (`pnpm run test:tauri`, `cargo llvm-cov`).
4. **Release & deployment**: Pushing a `v*.*.*` tag triggers `release.yml` (`test-gate` -> multi-OS matrix builds -> `release-notes.mjs` -> Open VSX/VS Code Marketplace/GitHub Release/Desktop Stores); `deploy-website.yml` publishes `website/` + `website-app/dist/` to GitHub Pages.

## Code map

- `package.json` — Root workspace scripts (`test*`, `build*`, `dev:*`, `start:*`, `sync-versions`, `sync-readme`) and shared `devDependencies`.
- `pnpm-workspace.yaml` — Active workspace package list (`ui`, `vscode`, `electron`, `tauri`, `website-app`), security vulnerability `overrides`, `allowBuilds`, `shamefullyHoist`, and `minimumReleaseAgeExclude`.
- `vitest.config.ts` — Multi-project Vitest configuration (`electron`, `vscode`, `ui`, `contracts`, `manifest`, `build`, `website`) and V8 coverage rules.
- `scripts/sync-versions.mjs` — Propagates root version across package manifests, `tauri/Cargo.toml`, `tauri/tauri.conf.json`, `website/landing.html`, and `website/llm.txt`, then calls `syncReadme()`.
- `scripts/sync-readme.mjs` — Generates `vscode/README.md` from root `README.md` with tutorial section preservation and GitHub blob URL rewriting.
- `scripts/configure-tauri-updater.mjs` — Validates `TAURI_UPDATER_PUBLIC_KEY` and enables signed Tauri updater artifacts in `tauri/tauri.conf.json`.
- `scripts/fetch-marketplace-stats.mjs` — Fetches Open VSX and VS Code Marketplace download counts into `website/marketplace-stats.json`.
- `ui/scripts/dev-tauri.mjs` — Builds export runtime, starts Vite HMR on `127.0.0.1:5174`, writes `dev-tauri.conf.json` in the global Tauri cache, and spawns the Tauri dev runner.
- `.vscode/launch.json`, `.vscode/tasks.json` — Debug launch configurations (`Extension`, `Electron Desktop App`, `Tauri Desktop App`, `Website`) and build/dev background tasks.
- `.github/workflows/test.yml` — CI verification workflow across contracts, translations, UI shards, Electron, host-variants (VS Code + Web), Tauri matrix, and Tauri 85% coverage gate.
- `.github/workflows/build-all.yml`, `.github/workflows/release.yml` — Manual and tag-triggered multi-OS packaging workflows for VS Code, Electron, and Tauri (`ubuntu-22.04` AppImage baseline) plus release publishing.
- `.github/workflows/deploy-website.yml` — GitHub Pages build and deployment workflow for `website/` and `website-app/`.
- `.github/scripts/release-notes.mjs` — Categorizes release assets (`Windows`, `macOS`, `Linux`, `VS Code Extension`, `Other`) and generates markdown tables and SHA-256 checksums.

## Verification

- Root commands: `pnpm test`, `pnpm run test:ui`, `pnpm run test:website`, `pnpm run test:electron`, `pnpm run test:vscode`, `pnpm run test:contracts`, `pnpm run test:node`, `pnpm run test:update-contracts`, `pnpm run test:translations`, `pnpm run lint:ui-styles`, `pnpm run test:tauri`, `pnpm run build`, `pnpm run sync-readme`, and `pnpm --dir website-app typecheck`.
- Contract and build tests in `tests/contracts/` (`package-config.test.ts`, `readme-sync.test.ts`, `release-notes.test.ts`, `workflow-config.test.ts`, `tauri-package-config.test.ts`, `website-homepage.test.ts`, `website-features-demo.test.ts`, `website-demo-insights-removal.test.ts`) and `tests/unit/build/` (`copy-ui.test.ts`, `tauri-linker-selection.test.ts`, `vscode-runtime-scripts.test.ts`) guard manifests, README sync, release notes, and workflow invariants.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [Tauri Desktop Runtime](../architecture/runtime-tauri.md)
- [Electron Desktop Runtime](../architecture/runtime-electron.md)
- [VS Code Extension Runtime](../architecture/runtime-vscode.md)
- [Web App & Website Runtime Architecture (Chromium Extension Retired)](../architecture/runtime-chromium-and-web-demo.md)

## Known limitations and open questions

- None found.
