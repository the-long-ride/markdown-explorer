---
timestamp: '2026-08-05T06:40:23+07:00'
name: Markdown Explorer Application Specification
topic: Documentation index and agent reading entry point
document_type: specification
status: active
ui_spec: false
parent_docs: []
related_docs:
- 00-foundation/06-coverage-matrix.md
source_scope:
- README.md
- package.json
test_scope: []
runtime_scope:
- all
keywords:
- index
- application specification
---

# Markdown Explorer Application Specification

This folder is a source-derived specification of the active application. It is organized for product review, implementation, testing, maintenance, and AI-agent use.

## Guarantees

- Real active behavior only; dead or speculative code is excluded.
- Full use-case specifications with alternate/failure flows and acceptance criteria.
- Feature specifications include UI reference HTML, CSS, and JavaScript where applicable.
- Exact protocol, settings, shortcut, theme, file, storage, limit, and error catalogs.
- Runtime-specific behavior for Electron, Tauri, VS Code, Chromium, and website modes.
- Source/test traceability and release-quality requirements.

## Recommended start

1. [Product Scope](00-foundation/02-product-scope.md)
2. [Application Coverage Matrix](00-foundation/06-coverage-matrix.md)
3. [System Context](01-architecture/01-system-context.md)
4. [Use Cases](02-use-cases/UC-001-launch-ready-handshake.md)
5. [Source Traceability Index](05-reference/12-source-traceability-index.md)
6. [Release Acceptance Matrix](06-quality/07-release-acceptance-matrix.md)

## Complete document index

### Foundation
- [Documentation Governance](00-foundation/01-documentation-governance.md) — Rules for maintaining application specifications
- [Product Scope](00-foundation/02-product-scope.md) — Product goals, supported surfaces, and exclusions
- [Actors and Terminology](00-foundation/03-actors-and-terminology.md) — Canonical actors and domain language
- [Source-of-Truth Rules](00-foundation/04-source-of-truth.md) — How specifications map to active source
- [Reading Map](00-foundation/05-reading-map.md) — Recommended documentation paths by role
- [Application Coverage Matrix](00-foundation/06-coverage-matrix.md) — Complete use-case, feature, protocol, runtime, and quality coverage

### Architecture
- [System Context](01-architecture/01-system-context.md) — External actors, boundaries, and product environment
- [Runtime Architecture](01-architecture/02-runtime-architecture.md) — Shared UI and runtime adapter design
- [Bridge Protocol](01-architecture/03-bridge-protocol.md) — Typed UI-host command and event protocol
- [Request and Operation Correlation](01-architecture/04-request-correlation.md) — Protection against stale asynchronous results
- [Application State Model](01-architecture/05-state-model.md) — Shared transient and persisted UI state
- [Security and Trust Boundaries](01-architecture/06-security-trust-boundaries.md) — Filesystem, HTML, links, shell, and update safety
- [Persistence Architecture](01-architecture/07-persistence-and-storage.md) — Bridge state, local storage, and browser handle persistence

### Use Cases
- [Launch and Ready Handshake](02-use-cases/UC-001-launch-ready-handshake.md) — Use case UC-001
- [First-Run Terms and Theme Onboarding](02-use-cases/UC-002-first-run-terms-theme-onboarding.md) — Use case UC-002
- [Open a Folder Workspace](02-use-cases/UC-003-open-folder-workspace.md) — Use case UC-003
- [Open a Single File](02-use-cases/UC-004-open-single-file.md) — Use case UC-004
- [Manage Recent Workspaces](02-use-cases/UC-005-recent-workspaces.md) — Use case UC-005
- [Workspace Scan Progress and Cancellation](02-use-cases/UC-006-workspace-scan-progress-cancellation.md) — Use case UC-006
- [Live Refresh and Stale Content](02-use-cases/UC-007-live-refresh-stale-content.md) — Use case UC-007
- [Desktop Workspace Tabs, Focus Mode, and Aliases](02-use-cases/UC-008-desktop-workspace-tabs-focus-aliases.md) — Use case UC-008
- [Browse, Filter, and Scope the Sidebar](02-use-cases/UC-009-sidebar-browse-filter-scope.md) — Use case UC-009
- [Content Tabs and Scroll Memory](02-use-cases/UC-010-content-tabs-scroll-memory.md) — Use case UC-010
- [Navigate Links, History, TOC, and Collapsible Headings](02-use-cases/UC-011-links-history-toc-headings.md) — Use case UC-011
- [Find in the Current Document](02-use-cases/UC-012-find-current-document.md) — Use case UC-012
- [Search the Current Workspace](02-use-cases/UC-013-search-current-workspace.md) — Use case UC-013
- [Search Across Workspace Tabs](02-use-cases/UC-014-search-all-workspace-tabs.md) — Use case UC-014
- [Open Dropped and External Paths](02-use-cases/UC-015-drag-drop-external-open.md) — Use case UC-015
- [Use Context Menus and Shell Actions](02-use-cases/UC-016-context-menus-shell-actions.md) — Use case UC-016
- [Configure Application Preferences](02-use-cases/UC-017-preferences.md) — Use case UC-017
- [Import and Export Settings](02-use-cases/UC-018-settings-import-export.md) — Use case UC-018
- [Use and Customize Keyboard Shortcuts](02-use-cases/UC-019-keyboard-shortcuts.md) — Use case UC-019
- [Select Theme Mode, Style, and Remix](02-use-cases/UC-020-theme-mode-style-remix.md) — Use case UC-020
- [Render Markdown, MDX, and Text Documents](02-use-cases/UC-021-render-markdown-mdx-text.md) — Use case UC-021
- [Preview HTML Safely](02-use-cases/UC-022-html-preview-browser.md) — Use case UC-022
- [Convert Supported Documents to Markdown Preview](02-use-cases/UC-023-document-conversion.md) — Use case UC-023
- [Interact with Tables and Charts](02-use-cases/UC-024-tables-charts.md) — Use case UC-024
- [View Images, Diagrams, Video, and YouTube Media](02-use-cases/UC-025-media-gallery-video-youtube.md) — Use case UC-025
- [Control Window, Tray, Fullscreen, Zoom, and Quit](02-use-cases/UC-026-window-tray-fullscreen-zoom-quit.md) — Use case UC-026
- [Download, Schedule, and Apply Application Updates](02-use-cases/UC-027-application-update.md) — Use case UC-027
- [Recover from Errors and Unavailable Workspaces](02-use-cases/UC-028-errors-recovery-unavailable.md) — Use case UC-028
- [Use Welcome, Help, and Localization](02-use-cases/UC-029-welcome-help-localization.md) — Use case UC-029
- [Copy, Edit, Open in Browser, and Export Content](02-use-cases/UC-030-copy-edit-browser-snapshot.md) — Use case UC-030
- [Save and Navigate Source-Anchored Bookmarks](02-use-cases/UC-031-manage-bookmarks.md) — Use case UC-031

### Features
- [Workspace Selection and Application Shell](03-features/01-workspace-selection-shell.md) — Workspace Selection and Application Shell
- [Desktop Workspace Tabs](03-features/02-desktop-workspace-tabs.md) — Desktop Workspace Tabs
- [Sidebar Tree, Filtering, and Scope](03-features/03-sidebar-tree-and-scope.md) — Sidebar Tree, Filtering, and Scope
- [Content Tabs and Document Shell](03-features/04-content-tabs-and-document-shell.md) — Content Tabs and Document Shell
- [Markdown and MDX Parser/Renderer](03-features/05-markdown-mdx-parser-renderer.md) — Markdown and MDX Parser/Renderer
- [TOC, Heading Sections, and Navigation History](03-features/06-toc-heading-sections-history.md) — TOC, Heading Sections, and Navigation History
- [Code Blocks, Syntax, Line Interaction, and Copy](03-features/07-code-blocks-and-copy.md) — Code Blocks, Syntax, Line Interaction, and Copy
- [Tables, Filters, Sorting, and Charts](03-features/08-tables-filters-charts.md) — Tables, Filters, Sorting, and Charts
- [Media, Mermaid, and Math Enhancements](03-features/09-media-mermaid-math.md) — Media, Mermaid, and Math Enhancements
- [HTML Preview and Standalone Browser Preview](03-features/10-html-preview-and-browser.md) — HTML Preview and Standalone Browser Preview
- [Find, Workspace Search, and Cross-Tab Search](03-features/11-search-system.md) — Find, Workspace Search, and Cross-Tab Search
- [Settings, Preferences, and Import/Export](03-features/12-settings-preferences-import-export.md) — Settings, Preferences, and Import/Export
- [Theme Modes, Styles, Pet Themes, and Custom Remix](03-features/13-themes-custom-remix.md) — Theme Modes, Styles, Pet Themes, and Custom Remix
- [Keyboard, Accessibility, Focus, and Responsive Behavior](03-features/14-keyboard-accessibility-responsive.md) — Keyboard, Accessibility, Focus, and Responsive Behavior
- [Localization, Welcome, Terms, and Onboarding](03-features/15-localization-welcome-onboarding.md) — Localization, Welcome, Terms, and Onboarding
- [Document Conversion and Preview Quality](03-features/16-document-conversion.md) — Document Conversion and Preview Quality
- [Context Menus, Shell Locations, Links, and Editor Actions](03-features/17-context-menus-shell-links.md) — Context Menus, Shell Locations, Links, and Editor Actions
- [Desktop Window, Tray, Startup, and Update Lifecycle](03-features/18-window-tray-update-lifecycle.md) — Desktop Window, Tray, Startup, and Update Lifecycle
- [Errors, Recovery, Status, and Observability](03-features/19-errors-recovery-observability.md) — Errors, Recovery, Status, and Observability
- [Performance, Incremental Work, and Enhancement Scheduling](03-features/20-performance-enhancement-scheduling.md) — Performance, Incremental Work, and Enhancement Scheduling
- [Source-Anchored Document Bookmarks](03-features/21-bookmarks.md) — Mixed Markdown/object capture, exact occurrences, batch management, and safe relocation

### Runtimes
- [Electron Desktop Runtime](04-runtimes/01-electron-desktop.md) — Electron host behavior, services, packaging, and Windows/macOS/Linux lifecycle
- [Tauri Desktop Runtime](04-runtimes/02-tauri-desktop.md) — Rust host, local protocols, native conversion, window lifecycle, and updater configuration
- [VS Code Extension Runtime](04-runtimes/03-vscode-extension.md) — Extension activation, commands, panel, workspace services, editor integration, and packaging
- [Chromium Extension Runtime](04-runtimes/04-chromium-extension.md) — Browser file handles, IndexedDB, scanning, polling, search, and capability limits
- [Website Demo and Browser File Mode](04-runtimes/05-website-demo-file-mode.md) — Virtual demo host, browser file utility mode, search, persistence, and native-feature exclusions
- [Runtime Parity and Capability Matrix](04-runtimes/06-runtime-parity.md) — Common contracts, supported capabilities, and intentional runtime differences

### Reference
- [UI-to-Host Command Catalog](05-reference/01-ui-to-host-command-catalog.md) — Exact active `WebviewMessage` command catalog
- [Host-to-UI Message Catalog](05-reference/02-host-to-ui-message-catalog.md) — Exact active `HostMessage` command catalog
- [Settings Catalog](05-reference/03-settings-catalog.md) — Exact active application settings, defaults, normalization, and effects
- [Keyboard Shortcut Catalog](05-reference/04-shortcut-catalog.md) — Shared and Electron desktop default shortcut catalog
- [Theme Catalog](05-reference/05-theme-catalog.md) — Valid modes, styles, custom theme model, migrations, and limits
- [Supported Files and Conversion Catalog](05-reference/06-supported-files-and-conversion.md) — Base document, media, HTML, and convertible extension support
- [Storage Catalog](05-reference/07-storage-catalog.md) — Exact bridge, local-storage, and IndexedDB keys and ownership
- [Limits and Thresholds Catalog](05-reference/08-limits-catalog.md) — Operational, validation, performance, and security limits
- [Error and Reason Catalog](05-reference/09-error-and-reason-catalog.md) — Typed failure states, reason codes, and required recovery
- [Localization Catalog](05-reference/10-localization-catalog.md) — Supported locales and translation boundaries
- [Core Data Models](05-reference/11-core-data-models.md) — Canonical workspace, document, search, preview, and update records
- [Source Traceability Index](05-reference/12-source-traceability-index.md) — Active implementation ownership by product domain

### Quality and Delivery
- [Test Strategy](06-quality/01-test-strategy.md) — Test layers, ownership, and regression expectations
- [Contract, Parity, Dead-Code, and LOC Gates](06-quality/02-contract-parity-dead-code-loc.md) — Static behavioral gates that keep hosts and source maintainable
- [Continuous Integration Workflows](06-quality/03-ci-workflows.md) — Automated test, release, deployment, store, and statistics workflows
- [Build and Release Specification](06-quality/04-build-and-release.md) — Build commands, version synchronization, release artifacts, and verification
- [Installers, Stores, and File Associations](06-quality/05-installers-stores-associations.md) — Windows Explorer integration, desktop stores, file associations, and publishing requirements
- [Documentation Maintenance](06-quality/06-documentation-maintenance.md) — How application changes keep this specification complete and accurate
- [Release Acceptance Matrix](06-quality/07-release-acceptance-matrix.md) — Product-level release readiness across use cases, hosts, security, and delivery

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `README.md` | Active behavior or contract |
| Implementation | `package.json` | Active behavior or contract |

---

[Documentation Governance →](00-foundation/01-documentation-governance.md)
