# Export Center and Scope View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared non-navigating document snapshot flow, Scope View modal history, and an Export Center for HTML/PDF/static-site output.

**Architecture:** Reuse the existing `loadSearchPreview`/`searchPreviewResult` workspace-contained preview protocol as the source loader, then render snapshots client-side with `renderMarkdownClientSide` and existing content enhancements. Scope View and Export Center share this loader. Export files are produced in the UI with standalone HTML composition, a small store-only ZIP writer for static-site packages, and the browser/system print pipeline for PDF so no DOCX/EPUB or HTML-to-PDF dependency is introduced.

**Tech Stack:** React 19, TypeScript 5.8, existing Markdown Explorer rendering/enhancement utilities, Vitest/Testing Library/node contract tests, browser Blob/File APIs.

**Spec:** `docs/superpowers/specs/2026-08-18-export-center-scope-view-design.md`

## Global Constraints

- Formats are HTML, PDF, and Static Website only; no DOCX or EPUB.
- Visual layout is a per-job user decision: `document` or `explorer`; default `document`.
- Scope history is isolated from main navigation and has a hard maximum of 10 entries.
- The Scope header renders exactly ten rounded segments; the active segment is larger and uses the current theme accent treatment.
- Existing workspace containment from `loadSearchPreview` remains the security boundary for document source loading.
- Existing runtime protocol parity must not regress.
- No new third-party export dependency is added.

---

### Task 1: Shared workspace document snapshot client

**Files:**
- Create: `ui/src/export/documentSnapshot.ts`
- Test: `tests/unit/ui/export/document-snapshot.test.ts`

**Interfaces:**
- Consumes: `PlatformBridge`, `MdFile`, `AppState['settings']`, existing `loadSearchPreview` / `searchPreviewResult`, `renderMarkdownClientSide`.
- Produces:
  ```ts
  export interface DocumentSnapshot {
    file: MdFile;
    markdownSource: string;
    html: string;
  }
  export function loadDocumentSnapshot(
    bridge: PlatformBridge,
    file: MdFile,
    settings: AppState['settings'],
    timeoutMs?: number,
  ): Promise<DocumentSnapshot>;
  export function findScopeFile(link: ResolvedLink, files: readonly MdFile[]): MdFile | null;
  ```

- [ ] **Step 1: Write failing snapshot tests**

Cover successful request correlation, timeout/unsubscribe, render call arguments, and matching `file://`/relative resolved links against `MdFile.fsPath`.

- [ ] **Step 2: Run focused test**

Run: `pnpm vitest run tests/unit/ui/export/document-snapshot.test.ts`
Expected: FAIL because `ui/src/export/documentSnapshot.ts` does not exist.

- [ ] **Step 3: Implement the client**

Use a unique request ID, listen for `searchPreviewResult`, post `loadSearchPreview`, reject failed/timeout responses, then call:

```ts
renderMarkdownClientSide(
  markdownSource,
  file.fsPath,
  file.fileName.toLowerCase().endsWith('.mdx'),
  settings,
).html;
```

`findScopeFile` must decode file URLs safely, normalize `/` and `\\`, strip query/hash, and return only an exact workspace file match.

- [ ] **Step 4: Run focused test**

Run: `pnpm vitest run tests/unit/ui/export/document-snapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/export/documentSnapshot.ts tests/unit/ui/export/document-snapshot.test.ts
git commit -m "feat(export): add shared document snapshot client"
```

### Task 2: Scope history model

**Files:**
- Create: `ui/src/components/Modal/scopeHistory.ts`
- Test: `tests/unit/ui/components/scope-history.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const MAX_SCOPE_DEPTH = 10;
  export interface ScopeEntry { file: MdFile; snapshot: DocumentSnapshot; }
  export interface ScopeHistoryState { entries: ScopeEntry[]; index: number; }
  export function createScopeHistory(entry: ScopeEntry): ScopeHistoryState;
  export function pushScope(state: ScopeHistoryState, entry: ScopeEntry): { state: ScopeHistoryState; blocked: boolean };
  export function previousScope(state: ScopeHistoryState): ScopeHistoryState;
  export function nextScope(state: ScopeHistoryState): ScopeHistoryState;
  ```

- [ ] **Step 1: Write failing history tests**

Test first-entry creation, pushes, previous/next bounds, forward truncation after back, and that push number 11 returns `blocked: true` without mutating history.

- [ ] **Step 2: Run focused test**

Run: `pnpm vitest run tests/unit/ui/components/scope-history.test.ts`
Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement pure history functions**

Keep all functions immutable. Compute push base as `entries.slice(0, index + 1)` before enforcing the 10-entry cap.

- [ ] **Step 4: Run focused test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Modal/scopeHistory.ts tests/unit/ui/components/scope-history.test.ts
git commit -m "feat(scope): add bounded modal history"
```

### Task 3: Scope View modal and link context integration

**Files:**
- Create: `ui/src/components/Modal/ScopeViewModal.tsx`
- Modify: `ui/src/components/shared/LinkContextMenu.tsx`
- Modify: `ui/src/components/Content/Content.tsx`
- Modify: `ui/src/components/Content/useContentEffects.ts`
- Create: `ui/src/styles/global/global-scope-view.css`
- Modify: `ui/src/styles/global.css`
- Test: `tests/unit/ui/components/scope-view-modal.test.tsx`
- Test: `tests/unit/ui/components/link-context-menu.test.tsx`

**Interfaces:**
- `LinkContextMenu` gains optional `scopeLabel` and `onOpenScope(link)`.
- `Content` owns `scopeSeed: MdFile | null`, resolves eligible context-menu links with `findScopeFile`, and renders `ScopeViewModal`.
- `ScopeViewModal` props:
  ```ts
  interface ScopeViewModalProps {
    initialFile: MdFile | null;
    files: readonly MdFile[];
    onClose: () => void;
  }
  ```

- [ ] **Step 1: Write failing UI tests**

Assert Open as scope only appears when callback/label are supplied; opening does not call normal `onOpen`; modal loads initial file, follows internal workspace links, previous/next changes isolated scope history, and the 11th push shows a depth-limit notice.

- [ ] **Step 2: Write failing depth-indicator test**

Assert exactly 10 `.scope-view__depth-segment` elements, segments through current depth have `is-filled`, exactly one has `is-current`, and current segment CSS has larger width/scale than normal segments.

- [ ] **Step 3: Implement modal**

Render snapshot HTML inside `.mdn-body`, run `scheduleContentEnhancements`, intercept internal workspace links, and use `loadDocumentSnapshot` before pushing. Fragment links scroll only inside the scope body. External links use the existing platform `openExternal` behavior.

- [ ] **Step 4: Integrate Content context menu**

On right-click, keep existing Open/Copy/Bookmark behavior. Supply `onOpenScope` only if `findScopeFile(link, state.fileList)` succeeds.

- [ ] **Step 5: Add styles**

The modal is a large centered overlay. The indicator uses CSS variables derived from `--accent`; normal segments are compact rounded pills; `.is-current` has a larger inline size and stronger filled accent background.

- [ ] **Step 6: Run focused tests**

Run: `pnpm vitest run tests/unit/ui/components/scope-view-modal.test.tsx tests/unit/ui/components/link-context-menu.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/Modal/ScopeViewModal.tsx ui/src/components/Modal/scopeHistory.ts ui/src/components/shared/LinkContextMenu.tsx ui/src/components/Content/Content.tsx ui/src/components/Content/useContentEffects.ts ui/src/styles/global/global-scope-view.css ui/src/styles/global.css tests/unit/ui/components/scope-view-modal.test.tsx tests/unit/ui/components/link-context-menu.test.tsx
git commit -m "feat(scope): add nested document scope viewer"
```

### Task 4: Export job model and source selection

**Files:**
- Create: `ui/src/export/exportModel.ts`
- Test: `tests/unit/ui/export/export-model.test.ts`

**Interfaces:**

```ts
export type ExportFormat = 'html' | 'pdf' | 'site';
export type ExportLayout = 'document' | 'explorer';
export type ExportBatchMode = 'separate' | 'merged';
export type ExportSourceMode = 'current' | 'selected' | 'folder';
export interface ExportJob {
  format: ExportFormat;
  layout: ExportLayout;
  batchMode: ExportBatchMode;
  files: MdFile[];
}
export function filesInFolder(files: readonly MdFile[], folderPath: string): MdFile[];
export function buildExportJob(args: { format: ExportFormat; layout: ExportLayout; batchMode: ExportBatchMode; files: readonly MdFile[] }): ExportJob;
```

- [ ] **Step 1: Write failing tests**

Cover deterministic workspace ordering, recursive folder expansion, duplicate elimination, empty selection rejection, and default layout `document` from modal initialization.

- [ ] **Step 2: Run focused test**

Run: `pnpm vitest run tests/unit/ui/export/export-model.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement model**

Use normalized relative paths for folder matching and sort by `relativePath.localeCompare`.

- [ ] **Step 4: Run focused test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/export/exportModel.ts tests/unit/ui/export/export-model.test.ts
git commit -m "feat(export): add export job model"
```

### Task 5: Standalone HTML composition and static-site ZIP

**Files:**
- Create: `ui/src/export/exportHtml.ts`
- Create: `ui/src/export/zipStore.ts`
- Test: `tests/unit/ui/export/export-html.test.ts`
- Test: `tests/unit/ui/export/zip-store.test.ts`

**Interfaces:**

```ts
export interface ExportPage { file: MdFile; html: string; }
export function captureExportThemeCss(root?: HTMLElement): string;
export function buildStandaloneExportHtml(args: {
  pages: readonly ExportPage[];
  layout: ExportLayout;
  title: string;
  themeCss: string;
}): string;
export function rewriteExportLinks(html: string, source: MdFile, exported: readonly MdFile[]): string;
export function createStoreZip(entries: readonly { path: string; data: Uint8Array }[]): Uint8Array;
```

- [ ] **Step 1: Write failing HTML tests**

Assert document layout excludes Explorer chrome; explorer layout includes exported topbar/sidebar/TOC shell; merged pages receive stable document section IDs; internal links become relative `.html` targets while `http:`, `https:`, `mailto:`, `data:`, and fragments are preserved.

- [ ] **Step 2: Write failing ZIP tests**

Assert local file headers, central directory, EOCD record, UTF-8 filenames, deterministic entry order, and CRC32 values for known fixtures.

- [ ] **Step 3: Implement HTML composer**

Snapshot current CSS custom properties from `document.documentElement`/computed styles into an export `:root` block, add print CSS, and use export-only shell markup without interactive application handlers.

- [ ] **Step 4: Implement dependency-free store ZIP**

Write ZIP32 uncompressed entries using `TextEncoder`, CRC32, little-endian headers and central directory. Reject files larger than ZIP32 limits instead of silently overflowing.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run tests/unit/ui/export/export-html.test.ts tests/unit/ui/export/zip-store.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/src/export/exportHtml.ts ui/src/export/zipStore.ts tests/unit/ui/export/export-html.test.ts tests/unit/ui/export/zip-store.test.ts
git commit -m "feat(export): compose standalone html and site archives"
```

### Task 6: PDF print pipeline

**Files:**
- Create: `ui/src/export/printExport.ts`
- Test: `tests/unit/ui/export/print-export.test.ts`

**Interfaces:**

```ts
export function printExportHtml(documentHtml: string, title: string): Promise<'printed' | 'cancelled'>;
export async function printExportBatch(documents: readonly { html: string; title: string }[]): Promise<number>;
```

- [ ] **Step 1: Write failing tests**

Mock an iframe window and verify `srcdoc`, `document.title`, `focus()`, `print()`, `afterprint` cleanup, and sequential separate-mode printing.

- [ ] **Step 2: Run focused test**

Run: `pnpm vitest run tests/unit/ui/export/print-export.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement print flow**

Create one off-screen iframe at a time, set `srcdoc`, wait for load, focus, call `print`, resolve on `afterprint`, and remove iframe in every completion/error path. `printExportBatch` awaits each document sequentially.

- [ ] **Step 4: Run focused test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/export/printExport.ts tests/unit/ui/export/print-export.test.ts
git commit -m "feat(export): add pdf print pipeline"
```

### Task 7: Export Center modal and More Actions integration

**Files:**
- Create: `ui/src/components/Export/ExportCenterModal.tsx`
- Modify: `ui/src/components/shared/ToolbarActionMenu.tsx`
- Modify: `ui/src/components/Topbar/Topbar.tsx`
- Modify: `ui/src/components/Desktop/DesktopTabBar.tsx`
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/AppView.tsx`
- Create: `ui/src/styles/global/global-export-center.css`
- Modify: `ui/src/styles/global.css`
- Test: `tests/unit/ui/components/export-center-modal.test.tsx`
- Test: `tests/unit/ui/components/topbar-render.test.tsx`

**Interfaces:**
- `ToolbarActionMenu` gains `exportLabel?: string` and `onExport?: () => void`; item ID is `export` and uses an export/download icon.
- `Topbar` and `DesktopTabBar` receive `onExportOpen` and pass it to the shared menu.
- `App` owns `exportCenterOpen` and passes it through `AppView`.

- [ ] **Step 1: Write failing menu/modal tests**

Assert More Actions includes Export Center before Settings, clicking opens the modal, default source is current document when available, default layout is Document only, formats are exactly HTML/PDF/Static Website, and batch mode exposes Separate/Merged.

- [ ] **Step 2: Implement modal source picker**

Use `state.fileList`/`state.tree`, checkbox selection, recursive folder selection, compact large-modal layout, and a progress/result area.

- [ ] **Step 3: Implement export execution**

For each selected file call `loadDocumentSnapshot`. Build per-file or merged HTML via `buildStandaloneExportHtml`.

- HTML: save `.html` with existing `saveBlobAsFile`; multiple separate HTML files are packaged in a `.zip` to avoid browser multi-download spam.
- Static Website: package `index.html`/per-document pages plus shared generated CSS inside `.zip` using `createStoreZip`.
- PDF: merged calls `printExportHtml` once; separate calls `printExportBatch` sequentially.

Track `queued/running/success/error` counts and retain per-file error messages. Separate failures do not invalidate successful files; merged fails the merged artifact if any required snapshot fails.

- [ ] **Step 4: Add modal styles**

Large responsive modal, source tree left, options/results right, no unnecessary scrollbars, theme-token-only colors and existing button patterns.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run tests/unit/ui/components/export-center-modal.test.tsx tests/unit/ui/components/topbar-render.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/src/components/Export/ExportCenterModal.tsx ui/src/components/shared/ToolbarActionMenu.tsx ui/src/components/Topbar/Topbar.tsx ui/src/components/Desktop/DesktopTabBar.tsx ui/src/App.tsx ui/src/AppView.tsx ui/src/styles/global/global-export-center.css ui/src/styles/global.css tests/unit/ui/components/export-center-modal.test.tsx tests/unit/ui/components/topbar-render.test.tsx
git commit -m "feat(export): add export center modal"
```

### Task 8: Localization, docs/coverage manifests, and regression verification

**Files:**
- Modify: `ui/src/contexts/translationTypes.ts`
- Modify: `ui/src/contexts/translationsData.ts`
- Modify: `ui/src/contexts/translations.ts`
- Modify: `tests/manifest/coverage-manifest.test.ts`
- Modify: `docs/instructions/00-foundation/06-coverage-matrix.md`
- Modify: `CHANGELOG.md`
- Add/modify node contract tests under `tests/node/` where source-contract coverage is required.

**Interfaces:**
- Add English keys for Export Center, formats/layout/batch/source labels, progress/failures, Open as scope, Scope level, depth-limit message, Previous/Next and export completion/error text. Other locales follow the repository fallback/coverage contract rather than introducing untranslated raw UI strings.

- [ ] **Step 1: Add translation keys and tests**

Run: `pnpm run test:translations`
Expected after implementation: PASS.

- [ ] **Step 2: Update coverage manifest/contracts**

Register every new production source exactly once and update source-text contracts for More Actions/Scope integration.

- [ ] **Step 3: Update active docs/changelog**

Document the two new use cases/features in the coverage matrix and add concise `[Unreleased]` entries.

- [ ] **Step 4: Run full verification**

Run:

```bash
pnpm run test:node
pnpm run test:ui
pnpm run test:contracts
pnpm run test:translations
pnpm run lint:ui-styles
pnpm run build:ui
pnpm run build:vscode
```

Expected: all PASS with no TypeScript/build failures.

- [ ] **Step 5: Review diff for scope/security regressions**

Verify no main navigation mutation from Scope View, no link outside `state.fileList` is eligible for scope, PDF documents contain export-only print CSS, and static-site archive paths cannot contain `..` or absolute path roots.

- [ ] **Step 6: Commit**

```bash
git add ui/src/contexts tests docs CHANGELOG.md
git commit -m "docs: cover export center and scope view"
```

### Task 9: Pull request and Greptile review loop

**Files:** none unless review comments require fixes.

- [ ] **Step 1: Compare branch with main**

Run: `git diff --stat main...HEAD` and inspect changed files.

- [ ] **Step 2: Open PR**

Title: `feat: add Export Center and Scope View`

PR body must summarize formats/layout modes, separate/merged behavior, Scope View max-10 history and accent depth indicator, tests, and known PDF print-dialog behavior.

- [ ] **Step 3: Inspect CI and Greptile comments**

Read PR checks and all issue/review comments. Filter comments authored by Greptile/`greptile-apps` and evaluate each against the code.

- [ ] **Step 4: Resolve actionable Greptile findings**

Write a regression test first, make the minimal fix, update the PR branch, and reply on the review thread with the fix and verification evidence.

- [ ] **Step 5: Re-check comments once in this session**

If no Greptile comment is present yet, report that fact; do not claim to wait or monitor asynchronously.
