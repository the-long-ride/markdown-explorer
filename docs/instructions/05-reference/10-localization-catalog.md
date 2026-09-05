---
timestamp: '2026-08-05T06:40:23+07:00'
name: Localization Catalog
topic: Supported locales and translation boundaries
document_type: reference
status: active
ui_spec: false
parent_docs:
- ../03-features/15-localization-welcome-onboarding.md
related_docs:
- 03-settings-catalog.md
source_scope:
- ui/src/contexts/translations.ts
- ui/src/contexts/translationsData.ts
- ui/src/contexts/auditedUiTranslations.ts
- ui/src/contexts/welcomeTranslations.ts
- ui/src/contexts/userManualTranslations.ts
- ui/src/contexts/translationTypes.ts
- ui/src/contexts/exportScopeTranslations.ts
- ui/src/components/Modal/ScopeViewModal.tsx
- ui/src/components/Export/ExportCenterModal.tsx
test_scope:
- tests/unit/ui/contexts/translations.test.ts
- tests/unit/ui/contexts/search-translations.test.ts
- tests/unit/ui/contexts/welcome-translations.test.ts
- tests/unit/ui/welcomeTranslations.test.ts
- tests/node/bookmarks.test.mjs
- tests/node/user-manual-home.test.mjs
- tests/node/localization-settings-doc-sync-contract.test.mjs
- tests/unit/ui/components/scope-view-modal.test.tsx
- tests/contracts/translations-coverage.test.ts
runtime_scope:
- shared
keywords:
- localization
- i18n
---

# Localization Catalog

| Code | Locale label |
|---|---|
| `en` | English |
| `vi` | Vietnamese |
| `fr` | French |
| `es` | Spanish |
| `zh` | Chinese |
| `no` | Norwegian |
| `ja` | Japanese |
| `ko` | Korean |
| `ru` | Russian |

## Translation domains

- Shared navigation, search, settings, workspace, content, errors, dialogs, welcome, and theme labels.
- `auditedUiTranslations.ts` and `auditedUiTranslationTypes.ts` provide the `ui`, `themeRemix`, `terms`, `onboarding`, `workspaceSelection`, and `rendererUi` domains for all nine locales. These cover renderer/ARIA copy, initial loading/scanning and sidebar navigation, Theme Remix controls/statuses, Terms/onboarding, workspace-selection instructions, welcome cursor-mode guidance, interactive Markdown table/code controls, column visibility controls (`columns`, `showAllColumns`), expanded chart types (`horizontalBarChart`, `areaChart`, `scatterChart`, `radarChart`, `polarAreaChart`, `doughnutChart`), fullscreen chart modal viewer actions (`chartViewTitle`, `chartFit`, `chartZoom`, `copyChartImage`, `saveChartPng`, `closeChartView`), video/YouTube fallback labels, copy feedback, and cross-cutting presentation labels.
- Shortcut presentation must resolve through localized labels. The shared shortcut-label resolver maps sidebar cursor mode and desktop-only zoom/tab actions to localized domains instead of exposing the English metadata in `settingsActions.ts`.
- Search `statusOn`/`statusOff` values are localized per locale; renderer controls do not contain English On/Off fallbacks.
- Recent-workspace relative timestamps use `Intl.RelativeTimeFormat` and older absolute timestamps use `Intl.DateTimeFormat`, both with the selected application locale; the renderer does not hard-code English `ago` phrases.
- User-visible component code should resolve typed translation keys directly rather than adding local `|| 'English fallback'` literals. Canonical English fallback belongs at locale resolution boundaries, not presentation call sites.
- The `search` translation domain covers modal columns, Preview state/loading/failure, workspace inclusion checkboxes, resizer labels, match-case controls, tooltip arrow-open actions, current-file find controls, and sidebar workspace search.
- The `bookmarks` domain covers **Enable Bookmark feature**, tab/count, search/sort/group controls, icon tooltips, selection/batch-delete actions, add/edit dialogs, object/link capture, empty states, target-changed notices, and verified-operation feedback across all nine locales. Required feedback keys are `savedSuccess`, `saveFailed`, `renamedSuccess`, `renameFailed`, and `storageUnavailable`.
- `userManualTranslations.ts` supplies the searchable User Manual sections, task cards, direct actions, no-results state, and bookmark guidance for all nine locales.
- Sidebar pinning, sorting, and maximum pinned items preference keys (`maxPinnedItems`, `maxPinnedItemsDesc`, `clearPinnedItems`, `sortFiles`, `sortNameAsc`, `sortNameDesc`, `sortModifiedDesc`, `sortModifiedAsc`, `pinThisFile`, `pinThisFolder`, `unpinItem`, `pinned`) are strictly typed as non-optional in `translationTypes.ts` and fully translated across all 9 supported locales.
- `exportScopeTranslations.ts` provides the `exportCenter` (`title`, `description`, `close`, `export`, `exporting`, `source` with `region/title/mode/current/selected/folder/workspace/noCurrent/documentsToExport/searchDocuments/folderToExport/searchFolders/documentCount/renderableCount/selectAll/unselectAll/noMatches/includeFile`, `options` with `format/htmlDescription/pdfDescription/staticWebsite/.../batchOutput/separateOutputs/mergedOutput/documentsSelected/activity/...`, `status` with `unableCreate/selectAtLeastOne/cancelled/partial/failedCount/complete/failed`) and `scopeView` (`dialogLabel`, `previous`, `next`, `level`, `close`, `loading`, `maximumDepth`, `unableOpen`, `outsideWorkspace`, `linkMenu`, `openInBrowser`, `copyLink`, `openAsScope`, `openFile`) domains for all nine locales. `openFile` ("Open file") is the Scope View header action that navigates the main workspace to the currently viewed scope file and closes the modal. The Export Center no longer exposes an "Additional workspace files" selector; the `extras` domain and its `listWorkspaceExportResources` enumeration were removed.
- `insightsTranslations.ts` and `insightsUiTranslations.ts` provide the `insights` and `insightsUi` domains across all nine locales. This includes panel navigation (`gallery`, `links`, `lint`, `duplicates`, `graph`, `related`), indexing progress/provisional states, link checker actions/results, lint rule suppression, duplicate grouping, graph search/zoom/fullscreen/degree controls, related document evidence ranking, settings tuning sections (`scopeAndNetwork`, `limitsAndTuning`, `patternFilters`), unit notes, and presentation categories (media types, HTTP/local link statuses, relationship presets, and lint rules).
- Welcome tips use a dedicated translation model/fallback.
- OS-native picker/file manager wording may be supplied by host/OS.

## Never translate

- UI→host/host→UI command names.
- Setting/action IDs.
- Paths, URLs, source code, Markdown, user document content, frontmatter keys, and file names unless a separate display title exists.

## Fallback

Unknown locale or missing key uses the canonical fallback, normally English. A language change updates labels without recreating workspace or resetting unrelated state.

## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/contexts/translations.ts` | Active behavior or contract |
| Implementation | `ui/src/contexts/translationsData.ts` | Composes full records for all nine locales |
| Implementation | `ui/src/contexts/auditedUiTranslations.ts` | Audited cross-cutting UI, renderer/media, Theme Remix, Terms/onboarding, and workspace strings |
| Implementation | `ui/src/markdown/inline.ts` | Localized video and YouTube fallback labels in generated Markdown |
| Implementation | `ui/src/components/Workspace/workspaceSelectionUtils.ts` | Locale-aware recent-workspace relative/absolute time formatting |
| Implementation | `ui/src/contexts/welcomeTranslations.ts` | Welcome tips and existing welcome tabs |
| Implementation | `ui/src/contexts/userManualTranslations.ts` | Searchable User Manual copy for nine locales |
| Implementation | `ui/src/contexts/translationTypes.ts` | Active behavior or contract |
| Verification | `tests/unit/ui/contexts/translations.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/contexts/search-translations.test.ts` | All search keys exist in all nine locales |
| Verification | `tests/unit/ui/contexts/welcome-translations.test.ts` | Automated expectation |
| Verification | `tests/unit/ui/welcomeTranslations.test.ts` | Automated expectation |
| Verification | `tests/node/bookmarks.test.mjs` | All nine bookmark translation records and visible wiring |
| Verification | `tests/node/bookmark-save-feedback.test.mjs` | All nine save/rename success, failure, and storage messages |
| Verification | `tests/node/user-manual-home.test.mjs` | All nine User Manual records and action wiring |
| Verification | `tests/node/table-renderer-translations-contract.test.mjs` | Table and chart nine-locale translation verification |
| Verification | `tests/node/localization-settings-doc-sync-contract.test.mjs` | Renderer hard-coded-copy guard and nine-locale audited-domain coverage |

---

[← Error and Reason Catalog](09-error-and-reason-catalog.md) · [Documentation index](../README.md) · [Core Data Models →](11-core-data-models.md)
