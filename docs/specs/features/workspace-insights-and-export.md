---
schema_version: 1
id: "feature.workspace-insights-and-export"
title: "Workspace Insights, Knowledge Graph, and Export"
kind: "feature"
status: "verified"
summary: "Workspace-wide document analytics, link/tag graph insights, and HTML/PDF/Markdown export pipelines."
tags: ["insights", "analytics", "graph", "export", "pdf", "html"]
source_paths: ["ui/src/components/Export/ExportCenterModal.tsx", "ui/src/components/Export/ExportCenterOptionsPanel.tsx", "ui/src/components/Export/ExportCenterSourcePanel.tsx", "ui/src/components/Export/ExportMultiSelect.tsx", "ui/src/components/Export/ExportSourceSelect.tsx", "ui/src/components/Export/exportSelectionModel.ts", "ui/src/components/Insights/DuplicatesView.tsx", "ui/src/components/Insights/GalleryView.tsx", "ui/src/components/Insights/GraphView.tsx", "ui/src/components/Insights/InsightsIcons.tsx", "ui/src/components/Insights/InsightsSettings.tsx", "ui/src/components/Insights/LinksView.tsx", "ui/src/components/Insights/LintView.tsx", "ui/src/components/Insights/MermaidThumbnail.tsx", "ui/src/components/Insights/RelatedView.tsx", "ui/src/components/Insights/WorkspaceInsightsEntry.tsx", "ui/src/components/Insights/WorkspaceInsightsPanel.tsx", "ui/src/export/documentSnapshot.ts", "ui/src/export/exportAssets.ts", "ui/src/export/exportExplorerNavigation.ts", "ui/src/export/exportHtml.ts", "ui/src/export/exportJobRunner.ts", "ui/src/export/exportModel.ts", "ui/src/export/exportResources.ts", "ui/src/export/exportRuntimeAssets.ts", "ui/src/export/exportSave.ts", "ui/src/export/exportSite.ts", "ui/src/export/exportSnapshot.ts", "ui/src/export/exportTheme.ts", "ui/src/export/pdf/pdfComposer.ts", "ui/src/export/pdf/pdfFonts.ts", "ui/src/export/pdf/pdfMakeLoader.ts", "ui/src/export/pdf/pdfModel.ts", "ui/src/export/pdf/pdfPrintLayout.ts", "ui/src/export/pdf/pdfSemantic.ts", "ui/src/export/pdf/pdfVisualCapture.ts", "ui/src/export/runtime/entry-charts.ts", "ui/src/export/runtime/entry-core.ts", "ui/src/export/runtime/entry-html-preview.ts", "ui/src/export/runtime/entry-media.ts", "ui/src/export/runtime/entry-table.ts", "ui/src/export/zipStore.ts", "ui/src/insights/aiPrompts.ts", "ui/src/insights/analyzeDocument.ts", "ui/src/insights/cache.ts", "ui/src/insights/concurrency.ts", "ui/src/insights/config.ts", "ui/src/insights/contracts.ts", "ui/src/insights/duplicates.ts", "ui/src/insights/graph.ts", "ui/src/insights/index.ts", "ui/src/insights/insights.worker.ts", "ui/src/insights/jumpToLocation.ts", "ui/src/insights/lint.ts", "ui/src/insights/patterns.ts", "ui/src/insights/relationships.ts", "ui/src/insights/reports.ts", "ui/src/insights/runtimeCapabilities.ts", "ui/src/insights/settingsStore.ts", "ui/src/insights/useWorkspaceInsights.ts", "ui/src/insights/workerClient.ts", "ui/src/insights/workerProtocol.ts", "ui/src/insights/workspaceIdentity.ts", "ui/src/insights/workspaceInsightsSession.ts"]
related_specs: ["architecture.ui-state-and-runtimes", "feature.markdown-rendering-and-tables"]
last_doc_update_at: "2026-11-17T03:16:00Z"
last_verified_at: "2026-11-17T03:16:00Z"
last_verified_code_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_at: "2026-11-17T03:16:00Z"
source_fingerprint: "sha256:5b5ffbcf6060d043916ff14c6c7669d251dd81c0291d7bcb22aee2058f0372fb"
---

# Workspace Insights, Knowledge Graph, and Export

## Purpose and boundaries

Analyzes workspace documents to compute word counts, link graphs, tag distributions, duplicates, lint issues, and gallery/related views, and provides multi-document export flows (HTML, PDF, and Static Website). Out of scope: single-file inline editing and git diff inspection.

## Observable behavior

- **Workspace insights**: Scans workspace Markdown files (`insights.worker.ts`, `useWorkspaceInsights.ts`) to aggregate reading-time/word-count metrics, broken or backlinked references, duplicates (80-item candidate bucket cap), lint diagnostics, and interactive graph visualizations (80-item inferred tag bucket cap). `runtimeCapabilities.ts` exposes `isWebRuntime()` (checking `window.__webBus`) and `supportsWorkspaceInsights(runtime)`, and views provide AI prompt builders (`aiPrompts.ts`: `buildLintAiPrompt`, `buildGraphAiPrompt`, `buildDuplicatesAiPrompt`) with clipboard copy.
- **Export Center options UI**: `ExportCenterOptionsPanel.tsx` renders `ExportSegmentedGroup` segmented radiogroups (`role="radiogroup"` / `role="radio"`, `.segmented-control` / `.segmented-option`) for Format (`HTML`, `PDF`, `Static Website`), Visual Layout (`Document Only`, `Full Explorer Layout` — disabled when `format === 'pdf'`), and Batch Output (`Separate Outputs`, `Merged Output`), with active-option descriptions linked via `aria-describedby`.
- **Export scope resolution, snapshots & saving**: `documentSnapshot.ts` (`findScopeFile(link, files, currentFile?)`) falls back to `resolveWorkspaceScopePath()` when `link.resolved` does not match `file.fsPath` directly, resolving URI-decoded relative or workspace-root paths against `currentFile` and matching `file.relativePath` / `file.fsPath` (exact then case-insensitive); `loadDocumentSnapshot()` captures parsed heading outlines onto `DocumentSnapshot.toc?: TocEntry[]` for export and Scope View consumers. `entry-table.ts` invokes `win.Table?.restoreTableLayout?.(table.id)` during exported HTML table hydration, while `.mdn-table-align-btn` is excluded from `@media print` (`exportHtml.ts`) and semantic PDF capture (`pdfSemantic.ts`). `exportSave.ts` (`saveExportArtifact`) downloads directly in browser when `runtime === 'web'` and uses the host bridge on other runtimes.

## Code map

- `ui/src/components/Insights/` & `ui/src/insights/` — `WorkspaceInsightsPanel.tsx`, `GraphView.tsx`, `LinksView.tsx`, `LintView.tsx`, `DuplicatesView.tsx`, `GalleryView.tsx`, `RelatedView.tsx`, `aiPrompts.ts`, `runtimeCapabilities.ts`, worker client & analyzers
- `ui/src/components/Export/` & `ui/src/export/` — `ExportCenterModal.tsx`, `ExportCenterOptionsPanel.tsx`, `ExportCenterSourcePanel.tsx`, `documentSnapshot.ts`, `exportSave.ts`, `exportHtml.ts`, `exportSite.ts`, `exportJobRunner.ts`, `pdf/`, `runtime/` (`entry-table.ts`, etc.)

## Verification

- Verified by `tests/unit/ui/export/` (`document-snapshot.test.ts`, `export-save.test.ts`, etc.), `tests/unit/ui/insights/` (`ai-prompts.test.ts`, `runtime-capabilities.test.ts`, etc.), `tests/unit/ui/components/` (`export-center-modal.test.tsx`, `insights-*.test.tsx`), and `tests/contracts/website-demo-insights-removal.test.ts`.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [Markdown Rendering, Media Embeds, and Interactive Data Tables](markdown-rendering-and-tables.md)
- [Web App & Website Runtime Architecture](../architecture/runtime-chromium-and-web-demo.md)

## Known limitations and open questions

- Large workspaces perform incremental/cached scanning to avoid UI stalls during insights computation.
