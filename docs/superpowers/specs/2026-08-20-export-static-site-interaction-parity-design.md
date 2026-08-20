# Exported Static Site Interaction Parity Design

**Date:** 2026-08-20
**Branch:** `feat/export-center-scope-view`

## Problem

Exported HTML/static-site pages preserve Markdown Explorer markup and styling, but some runtime behaviors do not survive outside the host application. Reported failures include section collapse/expand, table Show More, chart dropdown/view switching, column visibility, image/Mermaid modal geometry, syntax highlight colors, and collapsed-code line-number scrolling. The Export Center modal can also overlap the application topbar at constrained viewport/zoom sizes.

## Design

### Portable interaction controller

Add one host-free delegated interaction controller to the always-loaded export `core` runtime. It reads `window.UI` and `window.Table` at event time so table/chart bundles may initialize later. It delegates Markdown Explorer-owned controls only: section headers, code/HTML/CSV toggles, copy buttons, table search/sort/filter/show-more/wrap/columns controls, and chart view dropdown/options.

Before installing delegation, remove inline event attributes only from those Markdown Explorer-owned controls. This avoids duplicate actions when exported pages run in normal browsers while preserving user-authored raw-HTML event attributes outside Markdown Explorer controls.

### Syntax highlighting portability

Export theme capture must retain both Highlight.js `.hljs-*` rules and Markdown Explorer custom `.hl-*` token rules. Highlighting still happens during export snapshot enhancement; exported pages do not load a second syntax-highlighting library.

### Export-specific layout corrections

Add a focused stylesheet loaded after existing global styles. It will:

- anchor Export Center below the app topbar with border-box sizing and fixed header/footer behavior;
- make the collapsed code body the vertical scroll container so gutter and code lines move together while `<pre>` keeps horizontal scrolling;
- position exported media viewer previous/next/close/footer controls independently of the app modal flex flow and bound the viewport to the available screen area.

### Compatibility

No host bridge, CDN, or new dependency is introduced. Existing `UI`/`Table` implementations remain the source of behavior; the new controller only routes DOM events to them. HTML, static-site ZIP, Electron, Tauri, VS Code, and Chromium export behavior remains on the same shared export pipeline.

## Testing

Add regression coverage that proves:

1. exported controls work through delegated events after their inline handlers are removed;
2. table search, show-more, wrap, columns menu, sort/filter, and chart dropdown/view selection route to `Table` APIs;
3. custom `.hl-*` syntax rules survive export theme filtering;
4. Export Center uses a topbar-safe flex layout;
5. collapsed code scrolls the shared body containing both gutter and code;
6. exported media navigation/toolbar controls are viewport-bounded.

Use RED/GREEN verification: tests are committed first on an isolated verification branch and must fail before production changes are applied.