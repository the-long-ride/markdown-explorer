# Export Center and Scope View Design

## Status

Approved on 2026-08-18 and refined from user testing on 2026-08-19.

## Goals

Add two related document workflows without disturbing the main Markdown Explorer navigation model:

1. **Export Center** — export the current document, multiple documents, or folders to HTML, PDF, or a static website using the current Markdown Explorer visual system.
2. **Scope View** — open an internal workspace document in a modal reading context, then follow additional internal documents inside that modal with a bounded history stack.

Both features share a non-navigating document snapshot pipeline so they render workspace documents consistently without changing the active content tab, main back/forward history, or workspace state.

## Non-goals

- DOCX and EPUB are explicitly out of scope.
- Scope View does not create content tabs or modify normal navigation history.
- Exported pages do not execute unrestricted workspace HTML or arbitrary scripts.
- The feature does not introduce cloud publishing or remote export services.
- PDF export does not use or expose the operating system print center.

## Shared document snapshot pipeline

Use the existing workspace-contained preview/read path to load a target document without navigating the application. The host validates that the requested path belongs to the active workspace and the UI renders the snapshot through Markdown Explorer's normal document renderer and current settings.

The snapshot contains the workspace file metadata, source text required by the renderer, rendered HTML, and enough context to resolve internal links and local assets safely. Requests outside the workspace, missing files, unsupported files, and unreadable resources fail closed.

## Export Center

### Entry point and modal behavior

Add **Export Center** to the existing More Actions menu. Selecting it opens one shared modal in normal-topbar and desktop-tab layouts.

The modal is compact and viewport-bounded rather than fixed to a large pixel size. It must remain usable when application/browser zoom is increased. Card and control corner radii use the active theme radius tokens rather than hard-coded radius values.

The close control follows the Settings modal pattern: borderless, tooltip-enabled, and available at all times. Escape and backdrop click also close the modal. Closing is never blocked by an in-progress export; stale asynchronous results from a closed export must not overwrite a later reopened Export Center session. The footer contains only the primary Export action; there is no redundant Cancel button.

### Source selection

The modal supports current document, selected documents, and recursive folder selection. Selection is represented from the active workspace file/tree model rather than unrestricted filesystem paths.

### Formats

Supported formats are **HTML**, **PDF**, and **Static Website**. DOCX and EPUB are intentionally excluded.

### Batch mode

Users can choose **Separate outputs** or **Merged output**. Static Website uses the same choice to decide whether sources remain separate pages or become a combined page.

### Visual layout

Visual layout is a user decision for each export job:

- **Document only** — current Markdown Explorer theme, typography, content width, headings, code blocks, tables, Mermaid, media treatment, and document styling without application chrome.
- **Full Explorer layout** — export-safe Markdown Explorer-style shell with topbar, sidebar/navigation and TOC presentation around the rendered document.

Default is **Document only**. Both layouts use the resolved current theme, accent color, radius tokens, and current typography where those resources can be safely embedded or referenced.

### HTML output

HTML export is a standalone document/package produced from rendered snapshots. Internal links between exported documents are rewritten to exported relative paths. Workspace-local assets are embedded best-effort. Unsafe or external schemes are not rewritten.

Separate page paths retain the source extension before `.html` so same-stem source formats remain unique. Merged HTML uses deterministic collision-safe section IDs so punctuation-equivalent paths cannot share an anchor.

### PDF output

PDF uses the same styled standalone export HTML, but the desktop host generates files directly without opening a print dialog. Clicking **Export** opens a directory picker once; after the user chooses a folder, Markdown Explorer renders the HTML in a hidden sandboxed desktop window, invokes the native PDF renderer, and writes the resulting PDF file(s) to that folder.

Separate batch mode emits one PDF per document. Merged mode emits one book-style PDF. **Full Explorer layout remains visible in PDF output**; print media removes interactive-only controls but does not silently strip the chosen Explorer shell.

PDF footer behavior is a user option. It is enabled by default and its only visible footer content is:

`Markdown Explorer - @the-long-ride`

Turning the option off disables PDF header/footer output completely. No default date, URL, title, page metadata, or system print footer is intentionally added.

### Static website output

Static website export preserves the selected workspace hierarchy where possible and emits HTML pages, current theme/CSS, embedded local assets where possible, rewritten internal document links, and the optional Explorer-style navigation shell. The package must work without Markdown Explorer at runtime.

### Progress and failure semantics

Export Center shows per-document results. In separate mode, one document failure does not cancel unrelated successful outputs. In merged mode, failure to render a required source fails that merged artifact. Closing the modal invalidates its active UI generation so stale asynchronous completion cannot reopen or corrupt a later session.

## Scope View

### Entry point

Right-click an internal workspace document hyperlink in rendered content and show **Open as scope** in the existing link context menu. The action is enabled only when the link resolves to a supported document inside the active workspace.

### Modal behavior

Opening as scope displays the target document in a large modal without changing the main content tab or navigation history. Internal document links inside Scope View can open another scope in the same modal. External links retain their existing external-link behavior. Fragment links navigate inside the active scoped document.

### Stack/history model

Scope View owns an isolated history model with a maximum history depth of 10 entries. Opening a scope after going back truncates forward entries before pushing the new entry. Previous and Next operate only on Scope View history. Pushing an 11th scope is blocked and surfaced to the user. Closing Scope View discards the modal history.

### Header

The Scope View header contains document context, Previous, Next, close, and exactly ten rounded depth segments. Segments through current depth use the current theme accent treatment; remaining segments are muted. The currently active segment is visually larger than the other nine. The indicator exposes an accessible label such as `Scope level N of 10` without using `N / 10` as the primary visual UI.

### Rendering inside Scope View

Scoped documents reuse Markdown Explorer reading behavior needed for typography, code highlighting, Mermaid, tables, media and current theme. Scope rendering must not write main-document reading progress or mutate normal navigation history.

## Architecture boundaries

### UI

Focused modules own snapshot loading, Scope View history/modal UI, Export Center job state, HTML/static-site composition, direct-PDF bridge requests, and export CSS. Existing More Actions and link-context components gain minimal optional actions rather than feature-specific global state.

### Host protocol

The desktop protocol includes a direct PDF export request/result pair. PDF requests contain prepared standalone HTML, desired output names, and footer preference. The host owns destination-folder selection, native PDF generation, safe output paths and completion results. Unsupported runtimes return an explicit unsupported result rather than opening a system print dialog.

### Security

Workspace reads use existing containment boundaries. Export paths reject traversal. Native PDF output sanitizes file names before joining them to the selected directory. Export link rewriting never turns an unsupported or dangerous scheme into executable content. Scope View cannot scope a document outside the active workspace.

## Testing

Coverage includes snapshot loading, Scope history and max depth, depth indicator styling, context-menu eligibility, Export Center source/format/layout/batch options, close/Escape behavior while work is active, responsive/theme-radius contracts, HTML link/path/anchor collision handling, local assets, ZIP path safety, direct PDF request/result behavior, native Electron PDF generation/cancellation/footer/file-name sanitization, More Actions integration, translations, coverage manifests, and existing runtime/build checks.

## Acceptance criteria

- Export Center is reachable from More Actions and can export current/selected/folder content to HTML, PDF and Static Website.
- Export Center can always be closed and reopened; close, backdrop and Esc remain functional during export.
- Export Center remains viewport-bounded at increased zoom and uses current theme radius tokens.
- The footer contains no Cancel action.
- Visual Layout is selectable between Document only and Full Explorer layout, defaulting to Document only.
- Batch selection supports separate and merged output behavior where applicable.
- Desktop PDF export chooses an output directory and writes PDF files directly without opening the system print center.
- PDF footer defaults to `Markdown Explorer - @the-long-ride` and can be disabled to show no footer/header content.
- Full Explorer PDF retains its selected Explorer chrome.
- Right-clicking an eligible internal document link exposes Open as scope.
- Scope View opens without changing main document/history, supports Previous/Next, and has a hard maximum depth of 10.
- Scope header shows ten rounded accent-aware segments and the current segment is larger.
- Exported page paths and merged IDs remain unique for colliding source names.
- New protocol paths fail closed/safely, and normal CI remains green.
