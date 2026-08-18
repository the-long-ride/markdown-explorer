# Export Center and Scope View Design

## Status

Approved on 2026-08-18.

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

## Shared document snapshot pipeline

Introduce a workspace-local request that loads a target document without navigating the application. The host validates that the requested path is inside the active workspace, reads the source, and returns a renderable snapshot payload. The UI uses the existing Markdown Explorer rendering path and current settings to produce the same document HTML used by Scope View and Export Center.

The snapshot includes:

- canonical workspace file path;
- relative path and title;
- source/markdown text needed by the existing renderer;
- rendered HTML after normal Markdown Explorer rendering and enhancements;
- enough metadata to resolve internal links and local assets safely.

Requests outside the workspace, missing files, unsupported files, and unreadable resources fail closed with an explicit reason.

## Export Center

### Entry point

Add **Export Center** to the existing More Actions menu. Selecting it opens a large modal.

### Source selection

The modal supports:

- current document;
- selected documents;
- folder selection.

Folder selection recursively includes supported documents under that folder. Selection is represented from the active workspace file/tree model rather than by unrestricted filesystem paths.

### Formats

Supported formats are:

- HTML;
- PDF;
- Static Website.

DOCX and EPUB are intentionally excluded.

### Batch mode

For applicable formats, users can choose:

- **Separate outputs** — one exported output per source document;
- **Merged output** — combine the selected documents in deterministic workspace order into one export.

For a static website, the natural output is a site tree; separate-vs-merged controls whether each source remains its own page or the chosen sources become one combined page within the site package.

### Visual layout

Visual layout is a user decision for each export job:

- **Document only** — current Markdown Explorer theme, typography, content width, headings, code blocks, tables, Mermaid, media treatment, and document styling without application chrome.
- **Full Explorer layout** — export-safe Markdown Explorer-style shell with topbar, sidebar/navigation and TOC presentation around the rendered document.

Default is **Document only**.

Both layouts use the resolved current theme, including current accent color and current custom font bindings where those resources can be safely embedded or referenced by the target runtime.

### HTML output

HTML export is a standalone document/package produced from rendered snapshots. Internal links between exported documents are rewritten to exported relative paths. Workspace-local assets referenced by exported documents are copied or embedded through host-mediated reads. Unsafe or external schemes are not rewritten.

Merged HTML places source documents in order with stable section boundaries and IDs so internal anchors remain usable.

### PDF output

PDF is generated from the same styled export HTML rather than a separate renderer. This keeps visual parity with HTML/static-site output. The desktop host owns PDF file generation/saving. Print-specific CSS removes interactive controls that do not make sense on paper and keeps code/tables/media bounded to the page.

Separate batch mode emits one PDF per document. Merged mode emits one book-style PDF containing all selected documents.

### Static website output

Static website export preserves the selected workspace hierarchy where possible and emits:

- HTML pages;
- shared export CSS/theme variables;
- copied local assets;
- rewritten internal document links;
- optional Explorer-style navigation shell when Full Explorer layout is selected.

The site must work from a local static server and should not require Markdown Explorer at runtime.

### Progress and failure semantics

Export Center shows job progress and per-document results.

- In separate mode, one document failure does not cancel unrelated successful outputs.
- In merged mode, failure to render a required source fails that merged artifact.
- Cancellation stops pending work and does not report unfinished artifacts as successful.
- Completion and errors use the existing application action-notice/toast language where appropriate.

## Scope View

### Entry point

Right-click an internal workspace document hyperlink in rendered content and show **Open as scope** in the existing link context menu. The action is enabled only when the link resolves to a supported document inside the active workspace.

### Modal behavior

Opening as scope displays the target document in a large modal without changing the main content tab or navigation history.

Internal document links inside Scope View can open another scope in the same modal. External links retain their existing external-link behavior. Fragment links navigate inside the active scoped document.

### Stack/history model

Scope View owns an isolated history model:

```ts
interface ScopeHistoryState {
  entries: ScopeEntry[];
  index: number;
}
```

Rules:

- maximum history depth is 10 entries;
- opening a scope after going back truncates forward entries before pushing the new entry;
- Previous and Next operate only on Scope View history;
- pushing an 11th scope is blocked and surfaced to the user rather than silently dropping an older entry;
- closing Scope View discards the modal history.

### Header

The Scope View header contains:

- document title/path context;
- Previous button;
- Next button;
- close control;
- a ten-segment depth indicator.

The depth indicator is exactly 10 rounded `div` segments. Segments up to the current depth use the current theme accent color. Remaining segments use a muted/translucent accent-derived treatment with a subtle border. The **currently active segment is visually larger than the other nine**. The indicator exposes an accessible label/tooltip such as `Scope level N of 10` while avoiding `N / 10` as the primary visual UI.

### Rendering inside Scope View

Scoped documents reuse Markdown Explorer document rendering/enhancement behavior needed for reading: typography, code highlighting, Mermaid, tables, media and current theme. Scope rendering must not write reading progress for the main active document or mutate its heading-collapse state.

## Architecture boundaries

### UI

New focused modules should own:

- snapshot request/client logic;
- Scope View history and modal UI;
- Export Center job model and modal UI;
- export HTML/static-site composition and link rewriting;
- export-specific CSS.

Existing `ToolbarActionMenu` and `LinkContextMenu` gain minimal optional actions rather than feature-specific state.

### Host protocol

Add minimal typed messages for:

- loading a non-navigating workspace document snapshot/source;
- saving an export artifact/package;
- generating/saving PDF where the runtime supports native PDF generation.

Every runtime must either implement the operation or return an explicit unsupported result. Host-message parity tests must remain exhaustive.

### Security

All workspace reads use canonical containment checks already used by workspace-resource operations. Export link rewriting never turns an unsupported/dangerous scheme into executable content. Scope View does not permit a link to escape the workspace and become a scoped document.

## Testing

Add coverage for:

- workspace snapshot path containment and failure reasons;
- Scope View push/back/forward behavior;
- forward-history truncation;
- hard 10-entry limit;
- ten-segment indicator and enlarged active segment;
- Open as scope context-menu eligibility;
- Export Center source selection and folder expansion;
- format, layout and separate/merged job options;
- merged/separate failure semantics;
- HTML link rewriting and asset handling;
- PDF/static-site host protocol contracts;
- More Actions integration;
- translation coverage and coverage manifest updates;
- existing UI, node, contract, desktop and build checks.

## Acceptance criteria

- Export Center is reachable from More Actions and can export current/selected/folder content to HTML, PDF and Static Website.
- Visual Layout is user-selectable between Document only and Full Explorer layout, defaulting to Document only.
- Batch selection supports separate and merged output behavior where applicable.
- Export visuals derive from the current Markdown Explorer theme/layout system.
- Right-clicking an eligible internal document link exposes Open as scope.
- Scope View opens without changing the active main document/history.
- Nested scope navigation works with Previous/Next and a hard maximum depth of 10.
- Header shows ten rounded accent-aware segments and the current segment is larger.
- All new protocol paths fail closed for outside-workspace/unsupported cases.
- Tests, type checks and runtime parity checks remain green.
