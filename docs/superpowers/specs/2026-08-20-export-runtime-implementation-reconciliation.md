# Export Runtime Implementation Reconciliation

**Date:** 2026-08-20  
**Branch:** `feat/export-center-scope-view`  
**Related design:** `2026-08-19-export-runtime-interactive-html-shell-ux-design.md`  
**Status:** Implementation complete; final exact-head verification tracked by GitHub Actions

This document reconciles the approved 2026-08-19 export/runtime design with the implementation that now exists on the feature branch. It supersedes the older design document's pre-implementation status line; the architectural decisions in that design remain authoritative.

## Implemented export architecture

The Export Center now uses a shared source/snapshot/feature/resource/composer/save pipeline across Electron, Tauri, VS Code, and Chromium. Host-specific code is restricted to workspace resource access, save/download behavior, and desktop launch integration.

Implemented source modes are Current document, Selected documents, Folder, and Whole workspace. Whole workspace recursively uses Markdown Explorer's renderable document list. Additional workspace files are opt-in and apply only to HTML and Static Website output.

Selected documents and additional files use searchable switch-based selectors with filtered Select all / Unselect all behavior. Folder selection uses a searchable custom selector. The Export activity panel is a flex-filling scroll region that owns all remaining vertical space above the modal footer.

## Web export implementation

Web export uses feature-driven local runtime chunks instead of the Markdown Explorer application bundle. Runtime chunks are emitted only when the rendered export requires their capabilities. The portable runtime does not depend on host bridges, React application code, or CDNs.

Portable interaction coverage includes code copy/collapse, Mermaid and image viewing, portable table controls, table-to-chart switching, chart modal behavior, and isolated HTML previews. HTML preview iframes report their rendered height so the outer document owns normal page scrolling rather than a short preview viewport.

Theme export captures the active root/theme identity, CSS variables, portable content rules, and font-face rules while excluding app-shell viewport constraints. A single self-contained HTML export remains `.html` where possible. Explicit extra files or multi-document package semantics produce an HTML package ZIP. Static Website always produces an offline site ZIP.

Generated package roots are reserved and deterministic:

- `_assets/` for automatically referenced workspace resources;
- `_extras/` for explicitly selected supporting files;
- `_runtime/` for shared portable web runtime chunks.

Both document output paths and packaged resource paths use injective Windows-portable segment encoding. The encoder protects forbidden Windows characters, control characters, trailing dots/spaces, reserved DOS device names, case collisions, literal escape markers, and non-safe Unicode bytes while retaining readable safe lowercase segments.

A leading-slash web reference such as `/assets/logo.svg` is workspace-root-relative. Explicit native absolute filesystem resources use `file://` semantics. Electron and Tauri follow the same containment rule.

## PDF implementation

PDF export is runtime-neutral and no longer depends on Electron `webContents.printToPDF`. The shared compositor uses `pdfmake@0.3.11` lazily and generates PDF bytes before passing them to the normal runtime save adapter.

Normal Markdown structures are represented as semantic PDF text/list/table/link content where practical. Mermaid SVG and other complex rendered regions use bounded visual capture where browser rendering fidelity is required. Separate and merged PDF jobs use the same compositor. The former Electron-only PDF protocol, hidden print window, footer toggle, footer constants, footer templates, and footer tests were removed.

Additional workspace files never apply to PDF.

## Windows Explorer integration

`.md` and `.mdx` receive two verbs under the existing file-context-menu installer option:

1. **Open in Markdown Explorer** — retain single-file behavior.
2. **Open in Markdown Explorer with this folder** — launch with `--open-with-folder <file>`, bind the file's parent directory as the workspace, then focus/open the clicked file.

Electron and Tauri normalize startup/second-instance requests into the same structured external-open request consumed by the UI. Existing folder-context behavior remains separate.

Windows installer and shell verb text remains English because the installer has no project-wide runtime localization system and cannot read the active in-app language preference.

## Localization reconciliation

All new **in-app** Export Center and Scope View UI labels are backed by the feature translation catalog for all nine supported application languages:

- English (`en`)
- Vietnamese (`vi`)
- French (`fr`)
- Spanish (`es`)
- Chinese (`zh`)
- Norwegian (`no`)
- Japanese (`ja`)
- Korean (`ko`)
- Russian (`ru`)

This covers Export Center title/description/actions, source modes, searchable selectors, switch labels, additional-file controls, format/layout/batch labels, artifact labels, progress summaries, the More Actions export entry, Scope View navigation/depth/status labels, and Open as scope link actions.

The translation contract verifies every feature key for all nine locales and asserts that non-English locale sentinels are not silently falling back to English. Rendering tests verify Vietnamese Export Center and Scope View labels through the actual components.

## Test and verification mapping

Automated coverage includes:

- source resolution and Whole workspace behavior;
- searchable selection and filtered bulk actions;
- additional resource expansion/deduplication/failure behavior;
- Windows-safe document and packaged-resource paths;
- theme snapshot and page scrolling behavior;
- HTML preview resize/isolation contracts;
- enhanced snapshot feature detection and bounded concurrency;
- portable runtime build boundaries and absence of CDN/host dependencies;
- portable code/media/table/chart interactions;
- HTML/site package composition;
- hybrid PDF semantic and visual capture behavior;
- removal of legacy Electron PDF/footer protocol;
- Electron/Tauri structured external-open parsing/routing;
- both Windows installer verbs and uninstall symmetry;
- all nine feature translation catalogs and representative localized rendering;
- VS Code and Chromium host tests/builds;
- Electron tests;
- Tauri tests on Windows/macOS/Linux plus the repository's Rust coverage threshold.

Use `manual-tests/test-export-interactions.md` for visual/offline interaction checks after producing real artifacts.
