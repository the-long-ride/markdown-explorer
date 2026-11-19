---
schema_version: 1
id: "feature.git-history-and-diff"
title: "Git History and Diff Viewer"
kind: "feature"
status: "verified"
summary: "Per-file and workspace Git commit history inspection and side-by-side/unified diff rendering."
tags: ["git", "history", "diff", "timeline"]
source_paths: ["ui/src/components/History/CopyableHistoryMeta.tsx", "ui/src/components/History/DocumentDiffView.tsx", "ui/src/components/History/FileHistoryCommitList.tsx", "ui/src/components/History/FileHistoryDiffPane.tsx", "ui/src/components/History/FileHistoryModal.tsx", "ui/src/components/History/FileHistoryResizeHandle.tsx", "ui/src/components/History/GitCommitGraph.tsx", "ui/src/components/History/GitRevisionView.tsx", "ui/src/components/History/HistoryActionIcons.tsx", "ui/src/components/History/HistorySelectionCheckbox.tsx", "ui/src/components/History/RenderedDiffView.tsx", "ui/src/components/History/RepositoryCommitMenu.tsx", "ui/src/components/History/RepositoryHistoryPanel.tsx", "ui/src/components/History/RepositorySnapshotContent.tsx", "ui/src/components/History/RepositorySnapshotPortal.tsx", "ui/src/components/History/SourceDiffView.tsx", "ui/src/components/History/SplitSourceDiffView.tsx", "ui/src/components/History/diffVirtualRows.ts", "ui/src/components/History/repositoryHistoryLabels.ts", "ui/src/components/History/useFileHistoryLayout.ts", "ui/src/components/History/useSyncedScroll.ts", "ui/src/components/History/useVisibleRowRange.ts", "ui/src/history/contracts.ts", "ui/src/history/diffRanges.ts", "ui/src/history/gitGraphLayout.ts", "ui/src/history/historyAvailability.ts", "ui/src/history/historyClient.ts", "ui/src/history/lineDiff.ts", "ui/src/history/repositoryView.ts", "ui/src/history/revisionWorkspace.ts", "ui/src/history/splitDiffRows.ts", "ui/src/history/useFileHistory.ts"]
related_specs: ["architecture.ui-state-and-runtimes"]
last_doc_update_at: "2026-11-19T11:53:00Z"
last_verified_at: "2026-11-19T11:53:00Z"
last_verified_code_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_commit: "6ad4907b3df006942c3e8ebcf2ba6ae5195355a0"
last_source_change_at: "2026-11-17T07:16:00Z"
source_fingerprint: "sha256:01e3d05ba7107573baecdc9d2563e24cbe96b862fee0aee0f6ba63ffc107819f"
---

# Git History and Diff Viewer

## Overview

Surfaces Git commit logs, file revision timelines, and line-level diffs inside the UI by querying Git capabilities exposed through desktop and IDE runtime bridges.

## Scope and entry points

## Code map

- History components: `ui/src/components/History/`
- History & diff parsing/state: `ui/src/history/`

## Key workflows and behavior

- **Commit timeline**: Lists recent commits affecting the active file or workspace with author, timestamp, and commit message metadata. In `FileHistoryModal` (`FileHistoryCommitList` + `HistorySelectionCheckbox`), Compare mode renders transparent theme-matched SVG checkboxes (`CheckboxCheckedIcon` / `CheckboxUncheckedIcon`) with left-aligned body-portaled tooltips (`portalTooltip`, `tooltipAlign="left"`) and Option 3 boundary movement (`nextComparePicks`: outside picks move the adjacent outer boundary, while in-between picks alternate moving older then newer endpoints).
- **Diff inspection**: Fetches commit diffs from the host bridge and renders formatted additions/deletions for selected revisions. `DocumentDiffView` supports three modes (`'source'` inline unified table via `SourceDiffView`, `'split'` side-by-side source diff via `SplitSourceDiffView`, and `'rendered'` side-by-side HTML diff via `RenderedDiffView`), localized across all 9 languages (`splitDiff` in `historyTranslations.ts`).

## Architecture and design notes

- Git CLI/API execution stays on the host side (`tauri`, `electron`, `vscode`), while `ui/src/history/` normalizes commit entries and diff hunks into a runtime-agnostic model.

## Verification

- Covered by `tests/unit/ui/` tests for diff parsing and history state formatting, plus runtime bridge tests in host suites.

## Related documentation

- [UI State, Contexts, and Platform Runtimes](../architecture/ui-state-and-runtimes.md)
- [Tauri Desktop Runtime](../architecture/runtime-tauri.md)
- [Electron Desktop Runtime](../architecture/runtime-electron.md)
- [VS Code Extension Runtime](../architecture/runtime-vscode.md)

## Known limitations and open questions

- Requires a Git repository in the opened workspace and a runtime bridge that supports Git queries (unavailable in web demo / Chromium extension).
