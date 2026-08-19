# Export Center and Scope View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a shared non-navigating document snapshot flow, Scope View modal history, and an Export Center for HTML/PDF/static-site output.

**Architecture:** Reuse the existing workspace-contained preview protocol as the source loader and existing Markdown Explorer rendering for snapshots. HTML/static-site artifacts use standalone themed HTML and a dependency-free ZIP writer. PDF uses that same themed HTML but is generated directly by the Electron desktop host: Export Center sends prepared documents over a typed bridge, Electron asks for one destination directory, renders in a hidden sandboxed BrowserWindow, calls `webContents.printToPDF`, and writes the PDF bytes itself. The system print center is never opened.

**Tech Stack:** React 19, TypeScript 5.8, Electron native PDF rendering, Markdown Explorer rendering/enhancement utilities, Vitest/Testing Library/node contract tests, browser Blob/File APIs.

**Spec:** `docs/superpowers/specs/2026-08-18-export-center-scope-view-design.md`

## Global Constraints

- Formats are HTML, PDF, and Static Website only; no DOCX or EPUB.
- Visual layout is a per-job user decision: `document` or `explorer`; default `document`.
- Batch mode supports separate and merged output.
- Export Center stays viewport-bounded under zoom, uses theme radius tokens, and never blocks close/backdrop/Escape while work is active.
- No redundant Cancel footer action.
- Desktop PDF export opens one output-directory chooser, never the system print center, and has an enabled-by-default footer containing only `Markdown Explorer - @the-long-ride`; disabling it emits no header/footer.
- Full Explorer layout remains present in PDF output rather than being stripped by print media rules.
- Scope history is isolated from main navigation and has a hard maximum of 10 entries.
- The Scope header renders exactly ten rounded segments; the active segment is larger and uses the current theme accent treatment.
- Workspace containment remains the security boundary for source loading.
- Export paths and merged IDs stay unique for colliding names/slugs.
- No new third-party export dependency is added.

## Implemented tasks

- [x] Shared non-navigating workspace document snapshot loader and tests.
- [x] Pure bounded Scope history with back/forward/truncation/max-10 tests.
- [x] Scope View modal, nested internal links, right-click Open as scope, ten accent segments and larger active segment.
- [x] Export job model for current/selected/folder, HTML/PDF/Static Website, separate/merged and Document/Explorer layouts.
- [x] Themed standalone HTML generation, internal-link rewriting, local asset embedding, static-site ZIP packaging.
- [x] Extension-preserving separate export paths and collision-safe merged document IDs.
- [x] Typed `exportPdf` / `exportPdfResult` bridge.
- [x] Electron native destination-directory picker + hidden renderer + `printToPDF` direct file generation.
- [x] Optional PDF footer, exact visible text `Markdown Explorer - @the-long-ride`, no header/footer when disabled.
- [x] Removed iframe/`window.print()` system-print flow.
- [x] Preserved Full Explorer shell for PDF while hiding interactive-only controls.
- [x] Export Center close always available, Esc/backdrop close, stale-job generation invalidation, no Cancel button.
- [x] Compact viewport-bounded modal; responsive stacking under zoom; theme radius tokens.
- [x] Tests for close lifecycle, PDF bridge/native generation, footer, path sanitization, responsive CSS and collisions.
- [x] Coverage manifest registration.
- [x] Removed temporary diagnostic workflow.
- [x] Resolved Greptile same-stem and merged-slug collision findings.
- [ ] Final normal PR CI green.
- [ ] Final Greptile re-check with no unresolved actionable findings.

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
