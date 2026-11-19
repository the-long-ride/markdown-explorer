---
schema_version: 1
id: "architecture.ui-theming-and-styles"
title: "UI Theming, CSS Architecture, and Style Contracts"
kind: "architecture"
status: "verified"
summary: "Theme modes (auto/dark/light), built-in & pet theme styles, custom theme remixing, View Transitions, modular CSS layers, and static style/LOC contract enforcement."
tags: ["architecture", "theming", "css", "contracts", "styles"]
source_paths: ["ui/src/styles/fonts.css", "ui/src/styles/global.css", "ui/src/styles/global/global-action-notice.css", "ui/src/styles/global/global-app-shell.css", "ui/src/styles/global/global-bookmarks.css", "ui/src/styles/global/global-code-blocks.css", "ui/src/styles/global/global-code-syntax.css", "ui/src/styles/global/global-content-layout.css", "ui/src/styles/global/global-content-tabs-focus-search.css", "ui/src/styles/global/global-custom-select.css", "ui/src/styles/global/global-dialog-surfaces.css", "ui/src/styles/global/global-document-sections-tables.css", "ui/src/styles/global/global-dynamic-layout.css", "ui/src/styles/global/global-electron-window-controls.css", "ui/src/styles/global/global-electron-workspace.css", "ui/src/styles/global/global-export-center.css", "ui/src/styles/global/global-export-runtime-followup.css", "ui/src/styles/global/global-file-history-modal.css", "ui/src/styles/global/global-history-diff.css", "ui/src/styles/global/global-hover-tooltip.css", "ui/src/styles/global/global-insights-settings.css", "ui/src/styles/global/global-layout-sidebar.css", "ui/src/styles/global/global-markdown-editing.css", "ui/src/styles/global/global-markdown-foundation.css", "ui/src/styles/global/global-markdown-structures.css", "ui/src/styles/global/global-media-settings-dialogs.css", "ui/src/styles/global/global-media-viewer-settings-shell.css", "ui/src/styles/global/global-mermaid-rendering.css", "ui/src/styles/global/global-onboarding.css", "ui/src/styles/global/global-pet-theme-backgrounds.css", "ui/src/styles/global/global-recent-workspaces.css", "ui/src/styles/global/global-scope-view.css", "ui/src/styles/global/global-search-buttons.css", "ui/src/styles/global/global-search-overlay.css", "ui/src/styles/global/global-sections-table-core.css", "ui/src/styles/global/global-settings-actions-dialogs.css", "ui/src/styles/global/global-settings-features.css", "ui/src/styles/global/global-settings-layout.css", "ui/src/styles/global/global-settings-navigation.css", "ui/src/styles/global/global-settings-responsive.css", "ui/src/styles/global/global-settings-shortcut-search.css", "ui/src/styles/global/global-settings-typography.css", "ui/src/styles/global/global-settings-warning-animation.css", "ui/src/styles/global/global-shell-control-sizing.css", "ui/src/styles/global/global-sidebar-files-actions.css", "ui/src/styles/global/global-sidebar-search-controls.css", "ui/src/styles/global/global-sidebar-search-menus.css", "ui/src/styles/global/global-sidebar-tree-layout.css", "ui/src/styles/global/global-split-document-view.css", "ui/src/styles/global/global-switch-button.css", "ui/src/styles/global/global-switch-tooltip-diff.css", "ui/src/styles/global/global-switch-workspace-modal.css", "ui/src/styles/global/global-tab-actions-menus.css", "ui/src/styles/global/global-table-alignment.css", "ui/src/styles/global/global-table-chart-viewer.css", "ui/src/styles/global/global-table-view-controls.css", "ui/src/styles/global/global-terms-modal.css", "ui/src/styles/global/global-theme-cyberpunk-menus.css", "ui/src/styles/global/global-theme-cyberpunk-modals.css", "ui/src/styles/global/global-theme-cyberpunk-scope-view.css", "ui/src/styles/global/global-theme-cyberpunk-search.css", "ui/src/styles/global/global-theme-cyberpunk-surfaces.css", "ui/src/styles/global/global-theme-cyberpunk.css", "ui/src/styles/global/global-theme-glass-bento.css", "ui/src/styles/global/global-theme-neon-voltage.css", "ui/src/styles/global/global-theme-picker-custom.css", "ui/src/styles/global/global-theme-picker-pets.css", "ui/src/styles/global/global-theme-picker-remix.css", "ui/src/styles/global/global-theme-picker-settings.css", "ui/src/styles/global/global-theme-picker-styles.css", "ui/src/styles/global/global-theme-raw-grid.css", "ui/src/styles/global/global-theme-remix-controls.css", "ui/src/styles/global/global-theme-remix-dialog.css", "ui/src/styles/global/global-theme-tokyo-night.css", "ui/src/styles/global/global-theme-vercel.css", "ui/src/styles/global/global-toc-panel.css", "ui/src/styles/global/global-topbar-actions.css", "ui/src/styles/global/global-topbar-tabs.css", "ui/src/styles/global/global-view-transitions.css", "ui/src/styles/global/global-workspace-insights.css", "ui/src/styles/global/global-workspace-selection-screen.css", "ui/src/styles/global/global-workspace-selection.css", "ui/src/styles/global/global-workspace-tabs.css", "ui/src/styles/tokens.css", "ui/src/styles/tokens/tokens-app-shell.css", "ui/src/styles/tokens/tokens-base-themes.css", "ui/src/styles/tokens/tokens-pet-auto-light.css", "ui/src/styles/tokens/tokens-pet-themes.css", "ui/src/styles/tokens/tokens-style-foundation.css", "ui/src/styles/tokens/tokens-style-vivid.css"]
related_specs: ["feature.workspace-tabs-and-settings", "feature.markdown-rendering-and-tables", "workflow.build-and-verification"]
last_doc_update_at: "2026-11-19T12:42:00Z"
last_verified_at: "2026-11-19T12:42:00Z"
last_verified_code_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_at: "2026-11-17T09:50:00Z"
source_fingerprint: "sha256:a2cbbeca206e0ad58a15f3b90687e9495317f53d7cc58e8fc5a90e071ccb6cca"
---

# UI Theming, CSS Architecture, and Style Contracts

## Purpose and boundaries

Defines how visual themes, design tokens, View Transitions, modular global stylesheets, and automated CSS/LOC contracts work across the React UI.

- **In scope**: `ui/src/styles/**` (90 stylesheets total: 3 root entry files, 6 in `tokens/`, and 81 in `global/`), `ui/src/styles/fonts.css`, `ui/src/styles/tokens.css`, `ui/src/styles/global.css`.
- **Out of scope**: Theme state normalization and Remix modal logic (`feature.workspace-tabs-and-settings`) and component-local `.css` files under `ui/src/components/`.

## Observable behavior

- **Theme modes**: `data-theme` on `<html>` supports `'auto'`, `'dark'`, and `'light'`; `'auto'` defaults to dark and switches to light under `@media (prefers-color-scheme: light)`.
- **Theme-matched text selection (`tokens-base-themes.css`)**: Global `::selection` uses `background: var(--selection-bg, color-mix(in srgb, var(--accent) 28%, var(--bg)))` and `color: var(--selection-fg, var(--tx))`, with `--selection-bg` / `--selection-fg` defined across `:root`, `[data-theme="dark"]`, `[data-theme="light"]`, and `@media (prefers-color-scheme: light) { [data-theme="auto"] }`. Runtime font overrides use `body.is-desktop`, `body.is-electron`, `body.is-tauri`, and `body.is-web` (`body.is-chrome-ext` was removed).
- **Theme-adaptive scrollbars & grab targets (`tokens-app-shell.css`)**: Scrollbar thumbs and tracks bind to `border-radius: var(--r-s, var(--r))` (razor-sharp in Cyberpunk/Raw Grid, rounded in rounded themes), preserve a thin 5px track, enforce `min-height: 40px; min-width: 40px;` grab targets, and brighten on `:hover` / `:active` with Firefox fallback.
- **Theme presets (`data-theme-style`)**: `raw-grid` (Default), `default` (Explorer Classic), `bento` (Bento Grids), `vercel`, `tokyo-night`, `neon-voltage`, `cyberpunk` (zero-radius chamfered `clip-path: polygon(...)` cyberdeck geometry), and 2 pet themes (`pet-white-shiba` "Nika", `pet-k-ink` "K-Ink"; `pet-cat`, `pet-hamster`, `pet-corgi` were removed from `tokens-pet-themes.css`, `tokens-pet-auto-light.css`, and `global-theme-picker-styles.css`).
- **Custom themes**: Up to `24` custom themes override 20 CSS color variables per scheme (`light`/`dark`), layout tokens (`density`, `radius`, `strokeWidth`, `contentPadding`, `sectionGap`), and optional background image variables (`--custom-theme-bg-*`) on `html[data-custom-theme-id] body::before`.
- **View Transitions (`global-view-transitions.css`)**: Uses top-to-bottom / bottom-to-top feathered linear-gradient masks (`vt-mask-sweep-down`, `vt-mask-sweep-up`) and `.theme-magic-overlay`; `circle(...)` clip-paths are explicitly forbidden.
- **Cyberpunk modular surfaces, checkboxes, tooltips & File History (`global-theme-cyberpunk-*.css`, `global-search-overlay.css`)**:
  - `global-theme-cyberpunk-modals.css`: Orbiting neon tracer beam (`@property --cp-beam-angle` rotating a `conic-gradient` via `@keyframes cp-beam-orbit`) masked to the exact 6-sided cut-corner perimeter on `::after` with a subtle base cyber wireframe, applied across all application modals (`.modal`, `.settings-card`, `.export-center__card`, `.search-overlay-card`, `.scope-view__card`, etc.), plus Export Center HUD header/footer cyber styling.
  - `global-theme-cyberpunk-search.css`: Dual-rail 45° chamfered `.search-overlay-card`, cyan/rose accents, `mark.mdn-search-jump-mark` highlight, and chamfered inner-shape checkboxes without checkmarks (paired with `.search-overlay-workspace__checkbox` / `.scope-focus-checkbox` in `global-search-overlay.css` rendering an inner 8x8px pip on `:checked` or 2px bar on `:indeterminate`).
  - `global-theme-cyberpunk-scope-view.css`: Dual-rail chamfered `.scope-view__card`, parallelogram `.scope-view__depth-segment` HUD depth ticks, and flat `.scope-view__toc.toc-panel` container styling.
  - `global-theme-cyberpunk-menus.css`: 6-sided chamfered `.mdn-link-context-menu` content right-click menus with dual-layer cyan/rose drop shadows (including `@media (prefers-color-scheme: light)` auto-light overrides for `[data-theme="auto"][data-theme-style="cyberpunk"]`), plus File History modal header fixes suppressing separator `::before` pseudo-elements, aligning segmented (`28x28px`), compare (`28px` height, disabled opacity `0.45`), and close (`28x28px`) buttons.
  - `global-theme-cyberpunk-surfaces.css`: Portal tooltip keyframes for edge-aligned tooltips (`[data-tooltip-align="left"]` glitch animation without `-50%` horizontal shift).
- **Document scroller containment & table styles (`global-content-tabs-focus-search.css`, `global-split-document-view.css`, `global-scope-view.css`, `global-markdown-foundation.css`, `global-switch-tooltip-diff.css`, `global-sections-table-core.css`, `global-table-view-controls.css`)**:
  - `.content__scroll`, `.split-document-pane__scroll`, and `.scope-view__scroll` enforce `overflow-y: auto; overflow-x: hidden;`; `.mdn-body` and block children enforce `min-width: 0; max-width: 100%;` with `.mdn-body .mermaid svg` clamping across all document views. `.scope-view` renders at `--z-modal` (`130`), `.media-modal.mdn-modal` at `--z-modal-popover` (`140`), and `body > .mdn-link-context-menu` / `.mdn-filter-dropdown` at `calc(var(--z-modal-overlay) + 20)` (`170`).
  - Wrapped table headers (`.mdn-table-wrap.is-wrapped .mdn-th-content`) use wrapping flex-row alignment keeping actions inline when space permits and dropping to 2 rows when narrowed; `.mdn-th-content` (rather than `.mdn-table th`) owns `overflow: hidden` so `.mdn-table-col-resizer` handles remain unclipped in both Wrap and Unwrap modes alongside the 26x26px `.mdn-table-reset-widths` button.
- **Settings, Shell, TOC & Codeblock CSS updates**: `global-code-blocks.css` keeps `.mdn-codeblock-header` static (non-sticky) while pinning expanded `.mdn-codeblock[data-collapsed="false"] .mdn-codeblock-toggle-btn` (`bottom: var(--mdn-sticky-bottom-offset, 0px)`, mirrored in `global-theme-cyberpunk.css`); `global-content-tabs-focus-search.css` and `global-theme-raw-grid.css` move top breathing room from `.content__scroll` onto `.mdn-body` so `.mdn-body .toc-compact` (`padding: 0; top: 0; z-index: var(--z-toc-overlay, 70)` in `global-toc-panel.css`) pins flush at `y = 0` above `.mdn-th` / `.mdn-table-columns` / `.mdn-table-view-dropdown` without top-gap bleed-through; `global-settings-features.css` and `global-settings-navigation.css` provide a fixed-header scrollable Features panel (`.settings-features-section__scroll`, `.settings-navigation__content--features`); `global-theme-picker-settings.css` adds `:disabled` / `:not(:disabled)` states on `.segmented-option`; `global-settings-typography.css` positions `.desktop-font-size-unit` inside the `72px` `.desktop-font-size-input` stepper; `global-shell-control-sizing.css` styles `.web-demo-nav__btn--github:has(.web-demo-nav__stars-badge)` and `.web-demo-nav__stars-badge`; `global-theme-cyberpunk-modals.css` ensures the chart modal neon outline matches the modal container; `global-theme-cyberpunk*.css` dropped `.export-center__cards label` selectors.
- **Static style & LOC contracts**: `tests/contracts/ui-style-contract.test.ts` prohibits JSX inline `style` props (`useDomStyles`), native HTML `title` attributes on non-`<iframe>` elements, `circle(...)` transitions, hardcoded `12px` editor fonts, horizontal body scrollbars, clipped `.mdn-table th` overflow, z-index inversions above Scope View, and legacy insights tokens. `tests/contracts/source-loc.test.ts` enforces `.css <= 500` LOC (and `.ts/.tsx <= 400`, `.rs <= 350`, `.js <= 350`).

## Workflow

1. `ui/src/styles/fonts.css` loads bundled `Be Vietnam Pro` and `JetBrains Mono` `@font-face` rules (desktop/web).
2. `ui/src/styles/tokens.css` loads base, foundation, vivid, pet, auto-light, and app-shell CSS variables and z-index scale.
3. `ui/src/styles/global.css` imports 78 feature/theme `global-*.css` modules plus `TourGuideOverlay.css`.
4. `useAppStateEffects` syncs `data-theme`, `data-theme-style`, and custom theme CSS variables onto `document.documentElement`.

## Code map

- `ui/src/styles/fonts.css`, `tokens.css`, `global.css` — stylesheet entry layers.
- `ui/src/styles/tokens/{tokens-base-themes,tokens-style-foundation,tokens-style-vivid,tokens-pet-themes,tokens-pet-auto-light,tokens-app-shell}.css` — color, radius, shadow, chart, and shell token sets.
- `ui/src/styles/global/global-*.css` — modular styles for shell, sidebar, content, split view (`global-split-document-view.css`), scope view (`global-scope-view.css`), search overlay (`global-search-overlay.css`), tables (`global-sections-table-core.css`, `global-table-view-controls.css`, `global-table-alignment.css`), editor, history, insights, settings, and theme overrides (`global-theme-*.css`, including Cyberpunk `search`/`scope-view`/`menus` partials).

## Interfaces and data

- Root attributes: `html[data-theme]`, `html[data-theme-style]`, `html[data-custom-theme-id]`, `html[data-table-align]`, `html[data-theme-transitioning]`.
- Key CSS variables: `--bg`, `--bg-s`, `--bg-e`, `--bg-h`, `--tx`, `--tx2`, `--txm`, `--bd`, `--bd-s`, `--accent`, `--accent-dim`, `--r`, `--r-sm`, `--r-md`, `--r-lg`, `--stroke-w`, `--editor-font-size`, `--mdn-sticky-bottom-offset`.

## Verification

- `tests/contracts/ui-style-contract.test.ts` (all JSX/CSS/theme-parity invariants).
- `tests/contracts/source-loc.test.ts` (500 LOC limit on `.css` files).
- `tests/unit/ui/custom-themes.test.ts`, `tests/unit/ui/utils/themeMode.test.ts`, `tests/unit/ui/utils/themeTransition.test.ts`.

## Related documentation

- [Workspace Selection, Desktop Tabs, Settings, and Themes](../features/workspace-tabs-and-settings.md)
- [Markdown Rendering, Sandboxes, and Interactive Data Tables](../features/markdown-rendering-and-tables.md)
- [Build, Versioning, and Verification](../workflows/build-and-verification.md)

## Known limitations and open questions

- VS Code extension packaging omits `.ttf` font files and falls back to `--vscode-font-family` / `--vscode-editor-font-family` rather than bundled `Be Vietnam Pro` / `JetBrains Mono`.
