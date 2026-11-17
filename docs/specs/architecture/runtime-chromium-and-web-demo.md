---
schema_version: 1
id: "architecture.runtime-chromium-and-web-demo"
title: "Web App & Website Runtime Architecture (Chromium Extension Retired)"
kind: "architecture"
status: "verified"
summary: "Browser-hosted Web App runtime (appRuntime: 'web', window.__webBus, virtual/local/test workspaces), Interactive Feature Demo Studio (/features/), and localized static marketing/landing website; Manifest V3 Chromium extension retired in v1.7.2."
tags: ["architecture", "web-app", "browser", "website", "feature-demo", "chromium-retired"]
source_paths: ["ui/src/platform/web.ts", "ui/src/utils/webDemoDownload.ts", "website-app/features/index.html", "website-app/src/browser-font-host.ts", "website-app/src/browser-font-service.ts", "website-app/src/browser-git-history-host.ts", "website-app/src/browser-host-utils.ts", "website-app/src/browser-insights-host.ts", "website-app/src/demo-entry-store.ts", "website-app/src/features-main.tsx", "website-app/src/features/AuthoringStage.tsx", "website-app/src/features/FeatureStageRouter.tsx", "website-app/src/features/FeaturesStudioApp.tsx", "website-app/src/features/InsightsAndDiffStage.tsx", "website-app/src/features/SearchExportStage.tsx", "website-app/src/features/ThemesAndSettingsStage.tsx", "website-app/src/features/WorkspaceAndNavStage.tsx", "website-app/src/features/demoBusHost.ts", "website-app/src/features/demoCatalog.ts", "website-app/src/features/demoGitFixtures.ts", "website-app/src/features/demoInsightsFixture.ts", "website-app/src/features/demoMarkdownFixtures.ts", "website-app/src/features/features-demo.css", "website-app/src/features/features-stages.css", "website-app/src/file-access.ts", "website-app/src/incremental-publish.ts", "website-app/src/insights-host-router.ts", "website-app/src/main-web.tsx", "website-app/src/markdown-renderer.ts", "website-app/src/media-resolver.ts", "website-app/src/recent-workspaces.ts", "website-app/src/scanner.ts", "website-app/src/search-index.ts", "website-app/src/user-virtual-workspaces.ts", "website-app/src/virtual-workspace.ts", "website-app/src/web-demo-entry-router.ts", "website-app/src/web-document-converter.ts", "website-app/src/web-file-content.ts", "website-app/src/web-file-mode.ts", "website-app/src/web-file-utility-router.ts", "website-app/src/web-host.ts", "website-app/src/web-insights-host.ts", "website-app/src/web-navigation.ts", "website-app/src/web-test-host.ts", "website-app/src/web-test-message-router.ts", "website-app/src/web-test-search.ts", "website-app/src/workspace-entries.ts", "website-app/src/workspace-operation-state.ts", "website-app/src/workspace-search-items.ts", "website-app/vite.config.ts", "website/features/index.html", "website/i18n.js", "website/i18n/en.js", "website/i18n/es.js", "website/i18n/fr.js", "website/i18n/ja.js", "website/i18n/ko.js", "website/i18n/no.js", "website/i18n/ru.js", "website/i18n/vi.js", "website/i18n/zh.js", "website/index.html", "website/landing.html", "website/privacy.html", "website/script.js", "website/site-download-helpers.js", "website/site-download-rendering.js", "website/site-effects.js", "website/site-image-viewer.js", "website/site-release-api.js", "website/sitemap.xml", "website/styles.css", "website/styles/base.css", "website/styles/homepage-hero.css", "website/styles/homepage-sections.css", "website/styles/image-viewer.css", "website/styles/landing-hero-window.css", "website/styles/landing-raw-grid.css", "website/styles/landing-spotlight.css", "website/styles/legal-pages.css", "website/styles/responsive-tablet.css", "website/styles/responsive.css", "website/styles/site-components.css", "website/styles/site-foundation.css", "website/styles/site-typography.css", "website/terms.html"]
related_specs: ["architecture.ui-state-and-runtimes", "feature.workspace-tabs-and-settings", "workflow.build-and-verification"]
last_doc_update_at: "2026-11-18T04:17:00Z"
last_verified_at: "2026-11-18T04:17:00Z"
last_verified_code_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_commit: "4f38b2dbe45fbc969157f60247d6fbd1d1b32734"
last_source_change_at: "2026-11-12T17:46:34+07:00"
source_fingerprint: "sha256:f3bca7bdb0a9df8b68dcce24009340ec692fa039745e0f4751a7048a04391449"
---

# Web App & Website Runtime Architecture (Chromium Extension Retired)

## Purpose and boundaries

Defines the browser-hosted Web App runtime (`appRuntime: 'web'`) and Interactive Feature Demo Studio (`app/features/`) in `website-app/`, along with the static marketing/landing website and `/features/` studio wrapper in `website/`. As of v1.7.2, the Manifest V3 Chromium extension (`chromium-xtension/` and `ui/src/platform/chrome.ts`) has been retired and removed from the repository; all shared browser-host modules (File System Access scanner, IndexedDB workspace/font stores, search index, media resolver, insights, and Git history stub) were extracted directly into `website-app/src/`.

- **In scope**: `website-app/**` (`vite.config.ts`, `features/index.html`, `src/` including `src/features/*`), `ui/src/platform/web.ts`, `ui/src/utils/webDemoDownload.ts`, `website/**` (HTML/JS/CSS/sitemap assets including `website/features/index.html`).
- **Out of scope**: Shared React UI (`architecture.ui-state-and-runtimes`), desktop/VS Code hosts, and Pages deployment CI (`workflow.build-and-verification`).

## Observable behavior

- **Retired Chromium Extension**: `chromium-xtension/` and `ui/src/platform/chrome.ts` are removed. Release download matching in `website/site-download-helpers.js` no longer includes a `chromium` platform target.
- **Web App (`website-app/`)**:
  - Attaches `window.__webBus` (`EventTarget`) and reports `appRuntime: 'web'` with `appVersion` from `website-app/package.json` (without a `(demo)` suffix).
  - Supports two modes via `?mode=` (`detectMode()`): default `'web'` mode and `'test'` mode (`?mode=test`, loading `manual-tests/*.{md,mdx}`).
  - In `'web'` mode, auto-loads the most recent `localStorage` User Virtual Workspace (or creates one seeded with `Welcome.md`) on `ready` unless `explicitlyClosedWorkspace` is true; also supports local File System Access API folders/single files, drag-and-drop virtual workspaces, permanent entry CRUD, client-side conversion (`web-document-converter.ts`), browser font loading (`browser-font-host.ts` / `browser-font-service.ts`), `blob:` media resolution, and polling/virtual Insights (`web-insights-host.ts` + `browser-insights-host.ts`, with `checkExternalLinks` returning `unsupported`).
  - `web-navigation.ts` (`resolveWebNavigationTarget`, `executeWebNavigation`) resolves relative/root-relative document links against `flatList` (exact then case-insensitive), returning to the Welcome page on empty paths or emitting `navNotFound` for missing/external targets.
  - `webDemoDownload.ts` resolves file contents across active sessions, tabs, `localStorage`, and `window.__webBus` (`loadSearchPreview`) to trigger single-file or ZIP downloads (`createZipBlob`).
  - **Git History disabled**: `browser-git-history-host.ts` intercepts all 6 Git history commands and returns `ok: false, reason: 'unsupported-runtime'`.
- **Interactive Feature Demo Studio (`website-app/features/` & `website/features/`)**:
  - `website-app/vite.config.ts` builds both `main` (`index.html`) and `features` (`features/index.html`) entries under `/markdown-explorer/app/`.
  - `website/features/index.html` serves `/markdown-explorer/features/` in a Raw Grid shell and mounts a full-viewport `<iframe id="features-studio-iframe" src="../app/features/">` forwarding `?feature=` / `#hash` and `hashchange` `mde-demo-select` `postMessage` events.
  - `FeaturesStudioApp.tsx` wraps stages in `PlatformProvider` (in-memory isolated state over `createWebBridge()`), `AppStateProvider`, `HistoryProvider`, `RepositorySnapshotFromHistoryProvider`, and `WorkspaceNavigationProvider` backed by `installDemoBusHost` (`demoBusHost.ts`) without mutating real IndexedDB or `localStorage` workspaces.
  - Supports standalone mode (studio header with all 9 theme styles, dark/light toggle, video placeholder link, and `[data-testid="feature-demo-sidebar"]` grouping all 11 `FEATURE_DEMO_CATALOG` stages across 6 `FEATURE_DEMO_CATEGORIES`: Workspace, Reader & Data, Authoring, Audit & Git, Productivity, Personalization) and `?embed=1` compact iframe mode.
  - `FeatureStageRouter.tsx` delegates across specialized stage modules (`WorkspaceAndNavStage.tsx`, `AuthoringStage.tsx`, `InsightsAndDiffStage.tsx`, `SearchExportStage.tsx`, `ThemesAndSettingsStage.tsx`) mounting real `ui/src/` components: `WorkspaceSelection`, `WelcomePage`, `Sidebar`, `TableOfContents`, `ScopeViewModal`, `Content`, `MediaModal`, `HtmlDocumentView`, `HtmlPreviewModal`, `MarkdownEditingHeaderActions`, `SplitContent`, `WorkspaceInsightsPanel` (all 6 views via `createDemoInsightsSession`), `DocumentDiffView`, `FileHistoryModal`, `RepositoryHistoryPanel`, `SearchOverlay`, `BookmarksPanel`, `ExportCenterModal`, `DesktopTabBar`, `SettingsModal`, `ThemeRemixModal`, and `TourGuideOverlay`, backed by `demoGitFixtures.ts` and `DEMO_RECENT_WORKSPACES` / `DEMO_HTML_PREVIEW`.
- **Local Vite Dev/Preview Mirror (`website-app/vite.config.ts`)**: `serveWebsiteLandingPlugin()` mounts `createWebsiteLandingMiddleware()` to serve `website/` at `/markdown-explorer/` alongside the Vite app at `/markdown-explorer/app/`, redirecting `/` and `/markdown-explorer` to `/markdown-explorer/` and logging local URLs for Entry, `landing.html`, `?mode=web`, and `?mode=test`.
- **Marketing & Landing Website (`website/`)**:
  - `website/index.html` redirects default root visits to `app/?mode=web` (mapping legacy `?mode=file` to `web`) unless `?landing=1` or `#features`/`#gallery`/`#video-demo`/`#download`/`#faq` is present, and includes a `features/` link and `#video-demo` placeholder section.
  - `website/landing.html` (and `index.html`, `privacy.html`, `terms.html`, `features/index.html`) defaults to the Raw Grid theme (`data-theme="dark" data-theme-style="raw-grid"`, styled via `landing-raw-grid.css`).
  - `landing.html` replaces the static hero and 4 spotlight `<img>` previews with live interactive `<iframe src="app/features/?embed=1&feature=...">` embeds (`#hero-demo-iframe` switched by `[data-hero-mode]` and 4 `[data-spotlight-iframe]` panels synced with `[data-spotlight-tab]` via `site-effects.js` `mde-demo-select` `postMessage`), links to `features/`, and includes the `#video-demo` YouTube walkthrough embed placeholder (`[data-youtube-placeholder]`, `[data-youtube-placeholder-trigger]`, and chapter links).
  - Retains prioritized Rust Tauri download buttons including `#dl-win-light-portable-btn` (`tauri-windows-portable` matcher in `site-download-helpers.js`), icon-only GitHub star nav link (`.nav-github-link` + `[data-github-stars]`), `--accent` author link (`@the-long-ride`), View Transition / `is-theme-switching` dark-light toggle animations (`script.js` + `site-foundation.css`), retro-styled footer/legal panels (`privacy.html`, `terms.html`) with 9-language localization (`i18n.js`, `i18n/*.js`, plus `data-i18n-html` support in `script.js`), and `/markdown-explorer/features/` in `website/sitemap.xml`.

## Workflow

1. `website-app/src/main-web.tsx` detects mode (`'web'` or `'test'`) and calls `initWebHost()`, which initializes `window.__webBus` before dynamically importing `ui/src/main.tsx`.
2. `ui/src/platform/web.ts` (`createWebBridge()`) binds `webview-message` / `host-message` events on `window.__webBus` and persists UI state in `localStorage` (`WEB_APP_STATE_STORAGE_KEY`).
3. UI posts `ready` -> `web-host.ts` initializes the virtual, persisted, or test workspace (or sends empty `readyAck` if `explicitlyClosedWorkspace` is set) and streams `workspaceFilesChanged`.
4. `workspace-operation-state.ts` tags host messages with operation metadata so stale async scans do not overwrite newer workspace/tab transitions.
5. In the Feature Demo Studio (`website-app/features/index.html` -> `src/features-main.tsx`), `FeaturesStudioApp` installs `demoBusHost` over an isolated memory `PlatformBridge`, resolves `?feature=` / `#hash` aliases via `resolveFeatureSlug()`, and updates the active stage on sidebar clicks or parent `mde-demo-select` messages.

## Code map

- `ui/src/platform/web.ts` — `createWebBridge()` over `window.__webBus` and `localStorage` state persistence.
- `ui/src/utils/webDemoDownload.ts` — browser file, folder ZIP, and workspace ZIP downloads via active state, `localStorage`, and `__webBus` fallback.
- `website-app/vite.config.ts` — Vite build config (`/markdown-explorer/app/`, `main` + `features` inputs), `serveWebsiteLandingPlugin()` local `website/` mirror, font copy plugin, and lazy chunk preload stripping.
- `website-app/features/index.html`, `website-app/src/features-main.tsx`, `website-app/src/features/{demoCatalog.ts,demoMarkdownFixtures.ts,demoGitFixtures.ts,demoInsightsFixture.ts,demoBusHost.ts,FeaturesStudioApp.tsx,FeatureStageRouter.tsx,WorkspaceAndNavStage.tsx,AuthoringStage.tsx,InsightsAndDiffStage.tsx,SearchExportStage.tsx,ThemesAndSettingsStage.tsx,features-demo.css,features-stages.css}` — Feature Demo Studio 11-stage catalog, Git/HTML/recent-workspace fixtures, analyzer-backed Insights fixture, in-memory `__webBus` host, and real `@ui/*` component stages.
- `website-app/src/main-web.tsx`, `web-host.ts`, `web-navigation.ts` — entrypoint, `__webBus` host loop, and shared document navigation resolver.
- `website-app/src/{web-file-mode.ts,web-file-content.ts,web-file-utility-router.ts,user-virtual-workspaces.ts,virtual-workspace.ts,demo-entry-store.ts,web-demo-entry-router.ts,web-document-converter.ts,web-insights-host.ts,web-test-host.ts,web-test-message-router.ts,web-test-search.ts}` — web mode handlers, virtual workspaces, document conversion, insights wrapper, and `?mode=test` handlers.
- `website-app/src/{browser-font-host.ts,browser-font-service.ts,browser-git-history-host.ts,browser-host-utils.ts,browser-insights-host.ts,file-access.ts,incremental-publish.ts,insights-host-router.ts,markdown-renderer.ts,media-resolver.ts,recent-workspaces.ts,scanner.ts,search-index.ts,workspace-entries.ts,workspace-operation-state.ts,workspace-search-items.ts}` — browser runtime modules extracted from the retired Chromium extension.
- `website/{index.html,landing.html,privacy.html,terms.html,features/index.html,sitemap.xml}` — root redirect/landing entry, Raw Grid live-iframe landing page + YouTube walkthrough placeholder, legal pages, `/features/` studio iframe wrapper, and sitemap.
- `website/{i18n.js,script.js,site-release-api.js,site-download-helpers.js,site-download-rendering.js,site-effects.js,site-image-viewer.js}`, `website/i18n/*.js`, `website/styles.css`, and `website/styles/*.css` — localization, GitHub release/Tauri portable download matching, live demo iframe `postMessage` sync, YouTube placeholder interaction, image viewer, and Raw Grid/spotlight styles.

## Interfaces and data

- Event bus: `window.__webBus` (`EventTarget`) carrying `webview-message` and `host-message` `CustomEvent`s (and `window.postMessage` `{ type: 'mde-demo-select', feature }` for iframe embeds).
- IndexedDB stores: `markdown-explorer-db` (`workspaces`), `markdown-explorer-browser-fonts` (`fonts`).
- `localStorage` keys: `markdown-explorer.user-virtual-workspaces.v1`, `markdown-explorer.virtual-ws-entries.v1.<id>`, `markdown-explorer.virtual-ws-content.v1.<id>`, `markdown-explorer.demo-workspace.v1`, `documentConversion`, and `WEB_APP_STATE_STORAGE_KEY` (via `ui/src/platform/web.ts`).

## Verification

- `pnpm --dir website-app typecheck` — passed (`tsc --noEmit`, exit 0).
- `pnpm --dir website-app build` — passed (`dist/index.html` + `dist/features/index.html`).
- `pnpm exec vitest run tests/unit/website/features-demo-catalog.test.ts tests/contracts/website-features-demo.test.ts tests/contracts/website-homepage.test.ts tests/contracts/source-loc.test.ts tests/contracts/ui-style-contract.test.ts` — passed (5 files, 62 tests).
- `node --test tests/node/website-image-viewer.test.mjs tests/node/website-readme-contract.test.mjs` — passed (2 suites, 12 tests).
- `python C:\Users\long.trinh\.agents\skills\sync-docs-specs\scripts\validate_specs.py --repo .` — passed.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](ui-state-and-runtimes.md)
- [Workspace Selection, Desktop Tabs, Settings, and Themes](../features/workspace-tabs-and-settings.md)
- [Build, Versioning, and Verification](../workflows/build-and-verification.md)

## Known limitations and open questions

- `website/landing.html` and `website/index.html` both carry JSON-LD `"softwareVersion": "1.7.1"` rather than `"1.7.2"` at the time of inspection.
- `browser-git-history-host.ts` disables all Git history commands in browser runtimes (`unsupported-runtime`), and `browser-insights-host.ts` returns `unsupported` for `checkExternalLinks`.
- `#video-demo` currently renders a styled YouTube walkthrough placeholder (`data-youtube-video-id="coming-soon"`) until the recorded walkthrough video ID is published.
