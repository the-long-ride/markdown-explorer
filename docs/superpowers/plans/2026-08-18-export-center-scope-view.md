# Export Center and Scope View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared non-navigating document snapshot flow, Scope View modal history, and an Export Center for HTML/PDF/static-site output.

**Architecture:** Reuse the existing `loadSearchPreview`/`searchPreviewResult` workspace-contained preview protocol as the source loader, then render snapshots client-side with `renderMarkdownClientSide` and existing content enhancements. Scope View and Export Center share this loader. HTML/static-site artifacts are produced from standalone themed HTML and a dependency-free store-only ZIP writer. PDF uses that same themed HTML but is generated directly by the desktop host: Export Center sends prepared documents over a typed bridge, Electron asks for one destination directory, renders in a hidden sandboxed BrowserWindow, calls `webContents.printToPDF`, and writes the PDF bytes itself. The system print center is never opened.

**Tech Stack:** React 19, TypeScript 5.8, Electron native PDF rendering, existing Markdown Explorer rendering/enhancement utilities, Vitest/Testing Library/node contract tests, browser Blob/File APIs.

**Spec:** `docs/superpowers/specs/2026-08-18-export-center-scope-view-design.md`

## Global Constraints

- Formats are HTML, PDF, and Static Website only; no DOCX or EPUB.
- Visual layout is a per-job user decision: `document` or `explorer`; default `document`.
- Batch mode supports separate and merged output.
- Export Center must remain viewport-bounded under application zoom, use active-theme radius tokens, and never block close/backdrop/Escape while work is active.
- Export Center has no redundant Cancel footer action.
- Desktop PDF export opens one output-directory chooser, never the system print center, and has an enabled-by-default footer containing only `Markdown Explorer - @the-long-ride`; disabling it emits no header/footer.
- Full Explorer layout must remain present in PDF output rather than being stripped by print media rules.
- Scope history is isolated from main navigation and has a hard maximum of 10 entries.
- The Scope header renders exactly ten rounded segments; the active segment is larger and uses the current theme accent treatment.
- Existing workspace containment from `loadSearchPreview` remains the security boundary for document source loading.
- Export paths and merged IDs must remain unique even for source names that share stems or normalize to the same punctuation slug.
- Existing runtime protocol parity must not regress.
- No new third-party export dependency is added.

---

### Task 1: Shared workspace document snapshot client

**Files:** `ui/src/export/documentSnapshot.ts`, `tests/unit/ui/export/document-snapshot.test.ts`

- [x] Add request correlation around `loadSearchPreview` / `searchPreviewResult`.
- [x] Render source with the existing Markdown Explorer renderer and current settings.
- [x] Match only exact active-workspace files for Scope View.
- [x] Test success, errors, timeout/unsubscribe, and workspace link matching.

### Task 2: Scope history model

**Files:** `ui/src/components/Modal/scopeHistory.ts`, `tests/unit/ui/components/scope-history.test.ts`

- [x] Add immutable isolated Scope history.
- [x] Support Previous/Next and forward truncation.
- [x] Block push number 11 without evicting earlier scopes.
- [x] Test all history transitions.

### Task 3: Scope View modal and link integration

**Files:** Scope modal/history, `LinkContextMenu`, content integration, Scope CSS and tests.

- [x] Add **Open as scope** for eligible internal workspace links.
- [x] Render nested workspace documents inside one modal without mutating main navigation.
- [x] Keep Previous/Next inside Scope history.
- [x] Add ten accent-aware rounded depth segments with a larger active segment.
- [x] Support opening another scope from links inside Scope View.
- [x] Add coverage for context menu, nested navigation and max depth.

### Task 4: Export job model and themed HTML/static-site output

**Files:** `ui/src/export/exportModel.ts`, `ui/src/export/exportHtml.ts`, `ui/src/export/zipStore.ts`, related tests.

- [x] Model current/selected/folder source modes.
- [x] Model HTML/PDF/Static Website, separate/merged, and Document-only/Full-Explorer layout.
- [x] Capture current theme/CSS variables and current rendered HTML.
- [x] Rewrite internal exported links.
- [x] Embed local media best-effort.
- [x] Preserve source extensions in HTML output names to prevent same-stem collisions.
- [x] Make merged section IDs collision-safe for punctuation-equivalent paths.
- [x] Create dependency-free ZIP output for multi-HTML/static sites.

### Task 5: Direct PDF export

**Files:** `ui/src/export/pdfExport.ts`, `electron/core/pdf-export.js`, Electron bootstrap/IPC, typed host/webview messages, PDF tests.

- [x] Write UI bridge tests first for `exportPdf` / `exportPdfResult` correlation and cancellation.
- [x] Write Electron tests first for destination selection, direct native PDF rendering, optional footer, cleanup and filename containment.
- [x] Add typed PDF request/result protocol.
- [x] Route Electron IPC to a native PDF exporter.
- [x] On Export, open an output-folder picker once.
- [x] Render each prepared themed HTML document in a hidden sandboxed BrowserWindow.
- [x] Generate PDF bytes with `webContents.printToPDF` and write them directly into the selected directory.
- [x] Use a blank header and footer text `Markdown Explorer - @the-long-ride` when enabled.
- [x] Disable `displayHeaderFooter` entirely when the user turns the footer option off.
- [x] Remove the old iframe/`window.print()` implementation and its tests.
- [x] Keep Full Explorer shell visible in PDF print media while removing interactive-only controls.

### Task 6: Export Center modal polish and lifecycle

**Files:** `ui/src/components/Export/ExportCenterModal.tsx`, `ui/src/styles/global/global-export-center.css`, UI/node tests.

- [x] Add Export Center under More Actions in normal and desktop-tab shells.
- [x] Keep close enabled even while export work is running.
- [x] Add borderless Settings-style close control with tooltip and Esc shortcut text.
- [x] Close on Escape and backdrop click without a running-state guard.
- [x] Invalidate stale async generations on close so an old job cannot corrupt a reopened modal.
- [x] Remove Cancel footer action.
- [x] Add enabled-by-default PDF footer toggle and exact footer preview text.
- [x] Replace fixed 1180x820 sizing/min-height with `100dvh`/viewport-bounded compact sizing.
- [x] Collapse to one column at narrow effective viewport widths caused by zoom.
- [x] Replace Export Center hard-coded radii with current theme `--r`, `--r-md`, and `--r-lg` tokens.
- [x] Add close/PDF option and responsive CSS contract tests.

### Task 7: Integration, review, and verification

- [x] Register new production modules in the coverage manifest.
- [x] Remove temporary diagnostic workflow before final verification.
- [x] Address Greptile's same-stem export collision review.
- [x] Address Greptile's punctuation-equivalent merged-ID collision review.
- [ ] Run/observe the normal PR CI on the final head and fix any failures.
- [ ] Re-check Greptile after the final head for any new unresolved actionable comments.
- [ ] Confirm PR description reflects direct PDF export rather than the removed print-center flow.

## Acceptance verification commands

```bash
pnpm run test:contracts
pnpm run test:translations
pnpm run test:ui
pnpm run test:electron
pnpm run test:node
pnpm run build:ui
pnpm run test:tauri
```

The PR is complete only after the applicable normal CI jobs on the final head are green and there are no unresolved actionable Greptile comments.
