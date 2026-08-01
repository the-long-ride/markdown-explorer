---
timestamp: '2026-08-01T22:54:00+07:00'
name: Application Coverage Matrix
topic: Complete use-case, feature, protocol, runtime, and quality coverage
document_type: specification
status: active
ui_spec: false
parent_docs:
- ../README.md
related_docs:
- 05-reading-map.md
- ../05-reference/12-source-traceability-index.md
- ../06-quality/07-release-acceptance-matrix.md
source_scope:
- ui/src/types/webviewMessages.ts
- ui/src/types/hostMessages.ts
- ui/src/types/content.ts
- package.json
test_scope:
- tests/manifest/coverage-manifest.test.ts
- tests/contracts/host-message-parity.test.ts
runtime_scope:
- all
keywords:
- coverage
- use cases
- features
---

# Application Coverage Matrix

## Coverage declaration

This matrix covers **30 end-to-end use cases**, **20 feature specifications**, **5 product runtimes plus parity**, **36 UI→host commands**, and **18 host→UI messages** from the active source tree.

Coverage means the behavior has:

- A real-world trigger and success outcome.
- Main, alternate, cancellation, and failure flows.
- State/persistence and protocol effects.
- Runtime-specific behavior.
- Acceptance criteria.
- Active source and available test traceability.

## Use-case coverage

| Use case | Governing feature | Primary protocol | Evidence |
|---|---|---|---|
| [UC-001: Launch and Ready Handshake](../02-use-cases/UC-001-launch-ready-handshake.md) | [Feature](../03-features/01-workspace-selection-shell.md) | `ready` | Source + test traced |
| [UC-002: First-Run Terms and Theme Onboarding](../02-use-cases/UC-002-first-run-terms-theme-onboarding.md) | [Feature](../03-features/15-localization-welcome-onboarding.md) | `updateAppearance` | Source + test traced |
| [UC-003: Open a Folder Workspace](../02-use-cases/UC-003-open-folder-workspace.md) | [Feature](../03-features/01-workspace-selection-shell.md) | `openFolder`, `cancelWorkspaceScan` | Source + test traced |
| [UC-004: Open a Single File](../02-use-cases/UC-004-open-single-file.md) | [Feature](../03-features/01-workspace-selection-shell.md) | `openFile`, `openFileHandle`, `openPath` | Source + test traced |
| [UC-005: Manage Recent Workspaces](../02-use-cases/UC-005-recent-workspaces.md) | [Feature](../03-features/01-workspace-selection-shell.md) | `openRecentWorkspace`, `deleteRecentWorkspace`, `replaceRecentWorkspaces` | Source + test traced |
| [UC-006: Workspace Scan Progress and Cancellation](../02-use-cases/UC-006-workspace-scan-progress-cancellation.md) | [Feature](../03-features/20-performance-enhancement-scheduling.md) | `cancelWorkspaceScan`, `cancelAllWorkspaceScans` | Source + test traced |
| [UC-007: Live Refresh and Stale Content](../02-use-cases/UC-007-live-refresh-stale-content.md) | [Feature](../03-features/19-errors-recovery-observability.md) | `refresh` | Source + test traced |
| [UC-008: Desktop Workspace Tabs, Focus Mode, and Aliases](../02-use-cases/UC-008-desktop-workspace-tabs-focus-aliases.md) | [Feature](../03-features/02-desktop-workspace-tabs.md) | `activateWorkspace`, `closeWorkspace`, `cancelWorkspaceScan` | Source + test traced |
| [UC-009: Browse, Filter, and Scope the Sidebar](../02-use-cases/UC-009-sidebar-browse-filter-scope.md) | [Feature](../03-features/03-sidebar-tree-and-scope.md) | `navigate`, `openShellLocation` | Source + test traced |
| [UC-010: Content Tabs and Scroll Memory](../02-use-cases/UC-010-content-tabs-scroll-memory.md) | [Feature](../03-features/04-content-tabs-and-document-shell.md) | `navigate`, `refresh` | Source + test traced |
| [UC-011: Navigate Links, History, TOC, and Collapsible Headings](../02-use-cases/UC-011-links-history-toc-headings.md) | [Feature](../03-features/06-toc-heading-sections-history.md) | `navigate`, `openExternal` | Source + test traced |
| [UC-012: Find in the Current Document](../02-use-cases/UC-012-find-current-document.md) | [Feature](../03-features/11-search-system.md) | Local UI | Source + test traced |
| [UC-013: Search the Current Workspace](../02-use-cases/UC-013-search-current-workspace.md) | [Feature](../03-features/11-search-system.md) | `searchWorkspace` | Source + test traced |
| [UC-014: Search Across Workspace Tabs](../02-use-cases/UC-014-search-all-workspace-tabs.md) | [Feature](../03-features/11-search-system.md) | `loadWorkspaceSearchIndexes`, `indexWorkspaceSearchItems`, `searchAcrossWorkspaces` | Source + test traced |
| [UC-015: Open Dropped and External Paths](../02-use-cases/UC-015-drag-drop-external-open.md) | [Feature](../03-features/01-workspace-selection-shell.md) | `confirmOpenPath`, `openPath`, `openFileHandle` | Source + test traced |
| [UC-016: Use Context Menus and Shell Actions](../02-use-cases/UC-016-context-menus-shell-actions.md) | [Feature](../03-features/17-context-menus-shell-links.md) | `openShellLocation`, `openExternal`, `openInEditor`, `copyCode` | Source + test traced |
| [UC-017: Configure Application Preferences](../02-use-cases/UC-017-preferences.md) | [Feature](../03-features/12-settings-preferences-import-export.md) | `setDocumentConversion`, `updateAppearance` | Source + test traced |
| [UC-018: Import and Export Settings](../02-use-cases/UC-018-settings-import-export.md) | [Feature](../03-features/12-settings-preferences-import-export.md) | `replaceRecentWorkspaces` | Source + test traced |
| [UC-019: Use and Customize Keyboard Shortcuts](../02-use-cases/UC-019-keyboard-shortcuts.md) | [Feature](../03-features/14-keyboard-accessibility-responsive.md) | `toggle-fullscreen`, `zoom-in`, `zoom-out` | Source + test traced |
| [UC-020: Select Theme Mode, Style, and Remix](../02-use-cases/UC-020-theme-mode-style-remix.md) | [Feature](../03-features/13-themes-custom-remix.md) | `updateAppearance` | Source + test traced |
| [UC-021: Render Markdown, MDX, and Text Documents](../02-use-cases/UC-021-render-markdown-mdx-text.md) | [Feature](../03-features/05-markdown-mdx-parser-renderer.md) | `navigate` | Source + test traced |
| [UC-022: Preview HTML Safely](../02-use-cases/UC-022-html-preview-browser.md) | [Feature](../03-features/10-html-preview-and-browser.md) | `readWorkspaceTextResource`, `openHtmlPreview` | Source + test traced |
| [UC-023: Convert Supported Documents to Markdown Preview](../02-use-cases/UC-023-document-conversion.md) | [Feature](../03-features/16-document-conversion.md) | `setDocumentConversion`, `navigate` | Source + test traced |
| [UC-024: Interact with Tables and Charts](../02-use-cases/UC-024-tables-charts.md) | [Feature](../03-features/08-tables-filters-charts.md) | Local UI | Source + test traced |
| [UC-025: View Images, Diagrams, Video, and YouTube Media](../02-use-cases/UC-025-media-gallery-video-youtube.md) | [Feature](../03-features/09-media-mermaid-math.md) | Local UI | Source + test traced |
| [UC-026: Control Window, Tray, Fullscreen, Zoom, and Quit](../02-use-cases/UC-026-window-tray-fullscreen-zoom-quit.md) | [Feature](../03-features/18-window-tray-update-lifecycle.md) | `window-minimize`, `window-maximize`, `window-close`, `toggle-fullscreen`, `zoom-in`, `zoom-out` | Source + test traced |
| [UC-027: Download, Schedule, and Apply Application Updates](../02-use-cases/UC-027-application-update.md) | [Feature](../03-features/18-window-tray-update-lifecycle.md) | `downloadUpdate`, `scheduleDownloadedUpdate`, `restartAndApplyUpdate` | Source + test traced |
| [UC-028: Recover from Errors and Unavailable Workspaces](../02-use-cases/UC-028-errors-recovery-unavailable.md) | [Feature](../03-features/19-errors-recovery-observability.md) | `refresh`, `deleteRecentWorkspace`, `openFolder` | Source + test traced |
| [UC-029: Use Welcome, Help, and Localization](../02-use-cases/UC-029-welcome-help-localization.md) | [Feature](../03-features/15-localization-welcome-onboarding.md) | `openExternal` | Source + test traced |
| [UC-030: Copy, Edit, Open in Browser, and Export Content](../02-use-cases/UC-030-copy-edit-browser-snapshot.md) | [Feature](../03-features/07-code-blocks-and-copy.md) | `copyCode`, `openInEditor`, `openHtmlPreview`, `openExternal` | Source + test traced |

## Cross-cutting coverage

| Concern | Governing documents |
|---|---|
| Architecture and state | `01-architecture/*` |
| Security and HTML isolation | Security Trust Boundaries; HTML Preview feature/use case |
| Exact protocol | UI-to-Host and Host-to-UI catalogs |
| Settings/themes/shortcuts/storage | `05-reference/03` through `08` |
| Host differences | `04-runtimes/*` |
| Errors and recovery | UC-028; Error and Reason Catalog |
| Tests, CI, build, installers, release | `06-quality/*` |

## Exclusion test

The documentation intentionally excludes cloud collaboration, remote synchronization, account systems, unrestricted HTML/network execution, Chromium conversion, and dead/unreachable source behavior because they are not active product functionality.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/types/webviewMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/hostMessages.ts` | Active behavior or contract |
| Implementation | `ui/src/types/content.ts` | Active behavior or contract |
| Implementation | `package.json` | Active behavior or contract |
| Verification | `tests/manifest/coverage-manifest.test.ts` | Automated expectation |
| Verification | `tests/contracts/host-message-parity.test.ts` | Automated expectation |

---

[← Reading Map](05-reading-map.md) · [Documentation index](../README.md) · [System Context →](../01-architecture/01-system-context.md)
