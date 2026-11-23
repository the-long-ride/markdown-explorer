---
schema_version: 1
id: "feature.workspace-insights-and-export"
title: "Workspace Insights, Knowledge Graph, and Export"
kind: "feature"
status: "verified"
summary: "Workspace-wide document analytics, link/tag graph insights, and HTML/PDF/Markdown export pipelines."
tags: ["insights", "analytics", "graph", "export", "pdf", "html"]
source_paths: ["ui/src/components/Export/ExportCenterModal.tsx", "ui/src/components/Export/ExportCenterOptionsPanel.tsx", "ui/src/components/Export/ExportCenterSourcePanel.tsx", "ui/src/components/Export/ExportMultiSelect.tsx", "ui/src/components/Export/ExportSourceSelect.tsx", "ui/src/components/Export/exportSelectionModel.ts", "ui/src/components/Insights/DuplicatesView.tsx", "ui/src/components/Insights/GalleryView.tsx", "ui/src/components/Insights/GraphView.tsx", "ui/src/components/Insights/InsightsIcons.tsx", "ui/src/components/Insights/InsightsSettings.tsx", "ui/src/components/Insights/LinksView.tsx", "ui/src/components/Insights/LintView.tsx", "ui/src/components/Insights/MermaidThumbnail.tsx", "ui/src/components/Insights/RelatedView.tsx", "ui/src/components/Insights/WorkspaceInsightsEntry.tsx", "ui/src/components/Insights/WorkspaceInsightsPanel.tsx", "ui/src/export/documentSnapshot.ts", "ui/src/export/exportAssets.ts", "ui/src/export/exportExplorerNavigation.ts", "ui/src/export/exportHtml.ts", "ui/src/export/exportJobRunner.ts", "ui/src/export/exportModel.ts", "ui/src/export/exportResources.ts", "ui/src/export/exportRuntimeAssets.ts", "ui/src/export/exportSave.ts", "ui/src/export/exportSite.ts", "ui/src/export/exportSnapshot.ts", "ui/src/export/exportTheme.ts", "ui/src/export/pdf/pdfComposer.ts", "ui/src/export/pdf/pdfFonts.ts", "ui/src/export/pdf/pdfMakeLoader.ts", "ui/src/export/pdf/pdfModel.ts", "ui/src/export/pdf/pdfPrintLayout.ts", "ui/src/export/pdf/pdfSemantic.ts", "ui/src/export/pdf/pdfVisualCapture.ts", "ui/src/export/runtime/entry-charts.ts", "ui/src/export/runtime/entry-core.ts", "ui/src/export/runtime/entry-html-preview.ts", "ui/src/export/runtime/entry-media.ts", "ui/src/export/runtime/entry-table.ts", "ui/src/export/zipStore.ts", "ui/src/insights/aiPrompts.ts", "ui/src/insights/analyzeDocument.ts", "ui/src/insights/cache.ts", "ui/src/insights/concurrency.ts", "ui/src/insights/config.ts", "ui/src/insights/contracts.ts", "ui/src/insights/duplicates.ts", "ui/src/insights/graph.ts", "ui/src/insights/index.ts", "ui/src/insights/insights.worker.ts", "ui/src/insights/jumpToLocation.ts", "ui/src/insights/lint.ts", "ui/src/insights/patterns.ts", "ui/src/insights/relationships.ts", "ui/src/insights/reports.ts", "ui/src/insights/runtimeCapabilities.ts", "ui/src/insights/settingsStore.ts", "ui/src/insights/useWorkspaceInsights.ts", "ui/src/insights/workerClient.ts", "ui/src/insights/workerProtocol.ts", "ui/src/insights/workspaceIdentity.ts", "ui/src/insights/workspaceInsightsSession.ts"]
related_specs: ["architecture.ui-state-and-runtimes", "feature.markdown-rendering-and-tables", "architecture.runtime-chromium-and-web-demo"]
last_doc_update_at: "2026-11-20T11:30:45Z"
last_verified_at: "2026-11-20T11:30:45Z"
last_verified_code_commit: "f0818d86f926ee15c5508b3bc186e1ddf18f50b8"
last_source_change_commit: "f8fd06a7148e4607c9ee8adf9b244dd24b704cea"
last_source_change_at: "2026-11-18T04:36:49+07:00"
source_fingerprint: "sha256:bcf67a02011b30d53eb4d4c674b2bf7e449d2faf0ecb2d34ca828beec7f96bb7"
---

# Workspace Insights, Knowledge Graph, and Export

## Purpose and boundaries

Analyzes workspace documents to compute word counts, link graphs, tag distributions, duplicates, lint issues, and gallery/related views, and provides multi-document export flows (HTML, PDF, and Static Website). Out of scope: single-file inline editing and git diff inspection.

## Observable behavior

- **Workspace insights runtime & batched worker pipeline (`useWorkspaceInsights.ts`, `workspaceInsightsSession.ts`, `insights.worker.ts`, `workerClient.ts`, `workerProtocol.ts`, `runtimeCapabilities.ts`)**:
  - `runtimeCapabilities.ts` exposes `isWebRuntime()` (checking `window.__webBus`) and `supportsWorkspaceInsights(runtime)` (enabled on all runtimes except `'vscode'`).
  - Opening the drawer sets `panelOpen = true` immediately and yields a macrotask (`setTimeout(..., 0)`) before launching `runScan(false)`. Cache hydration (`restoreWorkspaceCacheToWorker()`) bounds IndexedDB read (1.5s) and worker restore (3s) timeouts.
  - Discovered Markdown entries are read through `createAsyncLimiter()` and dispatched to the worker in **16-file batches (`BATCH_SIZE = 16`)** via `applyBatchedSources()` (`analyzeBatch` alias). Intermediate batches pass `{ includeSnapshot: false }` (accepting both `'applySourceBatch'` and `'analyze-batch'` worker messages and returning `snapshot: null` + `analyzed` on `complete`) to avoid repeated full-index snapshot cloning; the final batch (or an explicit `worker.requestSnapshot()` fallback) materializes the complete snapshot.
  - While `status === 'indexing'`, incoming snapshots are coalesced on a **120ms timer** (`snapshotTimerRef`) before updating React state, then flushed on completion or cancelled on `closePanel()` / `dispose()`. External link checks are delegated to `executeExternalLinkChecks()`.
- **Bounded analytics, memoized views & AI prompts (`duplicates.ts`, `graph.ts`, `relationships.ts`, `aiPrompts.ts`, `DuplicatesView.tsx`, `GraphView.tsx`, `LinksView.tsx`, `LintView.tsx`, `RelatedView.tsx`, `GalleryView.tsx`, `MermaidThumbnail.tsx`)**:
  - Candidate generation caps bucket sizes and pairwise enumeration at **80 items** across near-duplicate detection (`duplicates.ts`), inferred tag pairs (`graph.ts`, computed once per `buildFocusedGraph()` call), and document relationships (`relationships.ts`).
  - `DuplicatesView` defers section token normalization until a section fingerprint collides across multiple files; `LintView` builds `Set`-based suppression lookups (`findingIds`, `ruleIds`, `pathRules`); `RelatedView` splits corpus candidate memoization from `selectedPath`/`preset`/`weights` ranking; `GraphView` uses an O(1) `nodeById` map for edges and attaches a non-passive `wheel` listener via `svgRef` for zoom; `LinksView` memoizes broken/checked counts.
  - `GalleryView` skips already-probed items (`probesRef`) and probes local resources in **chunks of 16 (`CHUNK_SIZE = 16`)** with batched state updates. `MermaidThumbnail` caps its SVG cache at **60 LRU entries (`MAX_CACHE_ENTRIES = 60`)** and limits concurrent Mermaid renders to **2 (`MAX_CONCURRENT_MERMAID_RENDERS = 2`)** via a cancellable FIFO queue.
  - `LintView`, `GraphView`, and `DuplicatesView` provide copy-to-clipboard AI remediation prompts via `aiPrompts.ts` (`buildLintAiPrompt`, `buildGraphAiPrompt`, `buildDuplicatesAiPrompt`, `copyTextToClipboard`).
- **Collapsible drawer shell & settings (`WorkspaceInsightsEntry.tsx`, `WorkspaceInsightsPanel.tsx`, `InsightsSettings.tsx`, `InsightsIcons.tsx`)**:
  - `WorkspaceInsightsEntry` resolves `.body` via a `MutationObserver` fallback and keeps `#insightsResize` and `WorkspaceInsightsPanel` mounted in the portal while toggling `.is-collapsed`, `aria-hidden`, `inert`, and `tabIndex`.
  - `WorkspaceInsightsPanel` closes on `Escape` when open, renders a drawer-collapse SVG close icon, and replaces native `title` attributes with `data-hover-tooltip` portals across status, tabs (including counts), and view rows. `InsightsSettings` pairs each setting, weight, and lint rule with an `InsightsSettingIcon` (`InsightsIcons.tsx`).
- **Export Center options UI (`ExportCenterOptionsPanel.tsx`)**:
  - Renders `ExportSegmentedGroup` segmented radiogroups (`role="radiogroup"` / `role="radio"`, `.segmented-control` / `.segmented-option`) for Format (`HTML`, `PDF`, `Static Website`), Visual Layout (`Document Only`, `Full Explorer Layout` — disabled when `format === 'pdf'`), and Batch Output (`Separate Outputs`, `Merged Output`), with active-option descriptions linked via `aria-describedby`.
- **Export scope resolution, snapshots & saving (`documentSnapshot.ts`, `exportHtml.ts`, `exportSave.ts`, `pdfSemantic.ts`, `entry-table.ts`)**:
  - `findScopeFile(link, files, currentFile?)` falls back to `resolveWorkspaceScopePath()` when `link.resolved` does not match `file.fsPath` directly, resolving URI-decoded relative or workspace-root paths against `currentFile` and matching `file.relativePath` / `file.fsPath` (exact then case-insensitive). `loadDocumentSnapshot()` captures parsed heading outlines onto `DocumentSnapshot.toc?: TocEntry[]` for export and Scope View consumers.
  - `entry-table.ts` invokes `win.Table?.restoreTableLayout?.(table.id)` during exported HTML table hydration, while `.mdn-table-align-btn` is excluded from `@media print` (`exportHtml.ts`) and semantic PDF capture (`pdfSemantic.ts`). `exportSave.ts` (`saveExportArtifact`) downloads directly in browser when `runtime === 'web'` and uses the host bridge on other runtimes.
  - `pdf/pdfFonts.ts` parses `@font-face` declarations without truncating semicolons inside `url(...)`; embedded base64 font data is written into the pdfmake virtual filesystem, mapped across normal/bold/italic/bold-italic faces, used as the default body font when available, and otherwise falls back to Roboto with a warning.

## Code map

- `ui/src/components/Insights/` & `ui/src/insights/` — `WorkspaceInsightsEntry.tsx`, `WorkspaceInsightsPanel.tsx`, `GraphView.tsx`, `LinksView.tsx`, `LintView.tsx`, `DuplicatesView.tsx`, `GalleryView.tsx`, `MermaidThumbnail.tsx`, `RelatedView.tsx`, `InsightsSettings.tsx`, `InsightsIcons.tsx`, `aiPrompts.ts`, `runtimeCapabilities.ts`, `useWorkspaceInsights.ts`, `workspaceInsightsSession.ts`, worker client/protocol (`insights.worker.ts`, `workerClient.ts`, `workerProtocol.ts`), and bounded analyzers (`duplicates.ts`, `graph.ts`, `relationships.ts`).
- `ui/src/components/Export/` & `ui/src/export/` — `ExportCenterModal.tsx`, `ExportCenterOptionsPanel.tsx`, `ExportCenterSourcePanel.tsx`, `documentSnapshot.ts`, `exportSave.ts`, `exportHtml.ts`, `exportSite.ts`, `exportJobRunner.ts`, `pdf/` (`pdfSemantic.ts`, etc.), and `runtime/` (`entry-table.ts`, etc.).

## Verification

- Verified by `tests/unit/ui/export/` (`document-snapshot.test.ts`, `export-save.test.ts`, `export-job-runner.test.ts`, `export-job-runner-pdf.test.ts`, `pdf/pdf-fonts.test.ts`), `tests/unit/ui/insights/` (`ai-prompts.test.ts`, `runtime-capabilities.test.ts`, `use-workspace-insights.test.tsx`, `worker-client.test.ts`, `settings-portability.test.ts`), `tests/unit/ui/components/` (`export-center-modal.test.tsx`, `workspace-insights-panel.test.tsx`, `mermaid-thumbnail.test.tsx`, `insights-gallery-links.test.tsx`, `insights-graph-related-reports.test.tsx`, `insights-lint-duplicates.test.tsx`, `insights-settings-integration.test.tsx`), and `tests/contracts/website-demo-insights-removal.test.ts`.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [Markdown Rendering, Media Embeds, and Interactive Data Tables](markdown-rendering-and-tables.md)
- [Web App & Website Runtime Architecture](../architecture/runtime-chromium-and-web-demo.md)

## Known limitations and open questions

- Large workspaces rely on 16-file batched analysis, 120ms snapshot throttling, IndexedDB caching, and 80-item candidate bucket caps to avoid UI stalls; buckets exceeding 80 shared-token/tag documents truncate pairwise comparisons deterministically in lexical order.
