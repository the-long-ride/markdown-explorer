# Workspace Insights and Wiki Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class Wiki Links/transclusion and a scalable, offline-first Workspace Insights subsystem with Gallery, Links, Lint, Duplicates, Graph, and Related views across Markdown Explorer runtimes.

**Architecture:** Shared TypeScript Markdown modules own syntax, resolution, extraction, linting, indexing, duplicates, backlinks/graph, and relationship scoring. Runtime hosts own recursive workspace enumeration, bounded source reads, metadata-only probes, filesystem change signals, document-preview reuse, and secure external HTTP checking; a dedicated Web Worker maintains the live index, while React coordinates lazy lifecycle, persistence, settings, progress, and presentation.

**Tech Stack:** React 19, TypeScript 5.8, Vite 8, Vitest 4, existing Markdown Explorer parser/renderer/bridge infrastructure, Web Worker APIs, IndexedDB/localStorage, Node host APIs for Electron/VS Code, Chromium File System Access APIs, Rust/Tauri, Mermaid, typed translation catalogs.

**Spec:** `docs/workspace-insights-design.md`

## Global Constraints

- External HTTP(S) checking defaults **OFF** and requires an enabled setting plus explicit user action.
- Opening a workspace, opening Insights, local Refresh, local transclusion, duplicate analysis, graph generation, and relationship scoring perform **zero external HTTP requests**.
- Use the existing parser/source-mapping semantics for Markdown structure; do not create a regex-only competing structural parser.
- Heading anchors must use the renderer's existing `slugify()` behavior plus duplicate suffixes `base`, `base-1`, `base-2`, ...
- Dedicated Insights scans must not inherit the legacy workspace/search file-count cap; any safety ceiling must report `truncated: true`.
- Default Markdown/MDX soft analysis limit is **10 MiB**; per-file/pattern overrides may exceed it; absolute non-overridable source ceiling is **64 MiB**.
- `probeWorkspaceResource` is metadata/stat only and must never read/base64 binary contents or delegate to `readWorkspaceExportResource`.
- Symlinks are followed only when the canonical target remains inside the active workspace.
- Wiki Link matching is Unicode-normalized and case-insensitive; ambiguity is explicit and never silently guessed.
- Wiki transclusion recursion depth is **5** with independent cycle detection.
- Remote media/content is never auto-loaded.
- Near-duplicate default threshold is **90%** and candidate generation must avoid a full O(n²) workspace pass.
- Focused graph default visible-node cap is **100**, with deterministic radial layout and synchronized accessible list.
- Persistent derived cache default global cap is **500 MiB**, contains no full Markdown/MDX bodies, and uses hybrid LRU eviction.
- External checker concurrency is **4 global / 2 per origin**, timeout defaults to **10 s** configurable **3–30 s**, redirect cap is **5**, and transient failures get at most **one retry**.
- External checker sends no application cookies, Authorization headers, or session credentials and must validate/pin destination IPs against private-network policy on every redirect hop.
- Diagnostics are read-only in v1; no source rewrite, auto-fix, or rename rewrite.
- All user-visible Insights/Wiki-Link strings must be added to every supported typed locale.

---

## File Structure

The implementation should converge on these responsibility boundaries. If an existing file already owns the named responsibility, extend it instead of duplicating it.

### Shared Markdown / Wiki semantics

- `ui/src/markdown/frontmatter.ts` — YAML frontmatter parsing, typed title/aliases/tags extraction, duplicate-key/malformed diagnostics.
- `ui/src/markdown/sourceMapping.ts` — frontmatter/body source offset mapping; delegate parsing to `frontmatter.ts`.
- `ui/src/markdown/anchors.ts` — renderer-consistent anchor index generation and static HTML anchor extraction.
- `ui/src/markdown/wikiLinks.ts` — Wiki Link token parsing/escaping and pure resolution against a document catalog.
- `ui/src/markdown/references.ts` — Markdown/HTML/MDX link/media/tag extraction using parser ranges.
- `ui/src/markdown/inline.ts` — Wiki Link/link/embed HTML emission.
- `ui/src/markdown/renderer.ts` — shared anchor allocator and transclusion render context.
- `ui/src/markdown/types.ts` — transclusion/render-source identity types as needed.

### Insights domain / worker

- `ui/src/insights/contracts.ts` — shared host, worker, finding, status, and report types.
- `ui/src/insights/config.ts` — built-in defaults and normalization.
- `ui/src/insights/patterns.ts` — gitignore-style rule compilation/precedence.
- `ui/src/insights/analyzeDocument.ts` — one-document parser/extractor/lint pipeline.
- `ui/src/insights/lint.ts` — configurable lint rules and suppression matching.
- `ui/src/insights/duplicates.ts` — exact, section/window, and near-duplicate candidate logic.
- `ui/src/insights/relationships.ts` — inverted candidate generation and deterministic scoring.
- `ui/src/insights/graph.ts` — focused graph projection and deterministic radial coordinates.
- `ui/src/insights/index.ts` — incremental `WorkspaceInsightsIndex`.
- `ui/src/insights/workerProtocol.ts` — batched worker messages.
- `ui/src/insights/insights.worker.ts` — dedicated worker entrypoint.
- `ui/src/insights/workerClient.ts` — worker lifecycle plus cooperative degraded fallback.
- `ui/src/insights/cache.ts` — IndexedDB derived-cache schema/versioning/eviction.
- `ui/src/insights/workspaceIdentity.ts` — app-local workspace ID/path-history recognition.
- `ui/src/insights/useWorkspaceInsights.ts` — active-workspace session orchestration.
- `ui/src/insights/reports.ts` — Markdown/JSON snapshots.

### UI

- `ui/src/components/Insights/WorkspaceInsightsPanel.tsx` — resizable shell, view switching, progress/completeness.
- `ui/src/components/Insights/GalleryView.tsx`
- `ui/src/components/Insights/LinksView.tsx`
- `ui/src/components/Insights/LintView.tsx`
- `ui/src/components/Insights/DuplicatesView.tsx`
- `ui/src/components/Insights/GraphView.tsx`
- `ui/src/components/Insights/RelatedView.tsx`
- `ui/src/components/Insights/InsightsSettings.tsx`
- `ui/src/components/Sidebar/SidebarTabsHeader.tsx` / `Sidebar.tsx` — discovery entry only.
- `ui/src/App.tsx` / `ui/src/AppView.tsx` — panel state and main-area composition.
- `ui/src/hooks/useResize.ts` — reuse existing resize mechanics; do not invent a second pointer-resize system.
- `ui/src/styles/global/global-workspace-insights.css` — panel/views/graph styling through existing theme tokens.

### Shared bridge / settings

- `ui/src/types/webviewMessages.ts`
- `ui/src/types/hostMessages.ts`
- `ui/src/platform/bridge.ts`
- `ui/src/settings/settingsImportExport.ts`
- `ui/src/types/settings.ts`
- `ui/src/constants/storage.ts`
- `ui/src/contexts/translations.ts`, `translationsData.ts`, `translationTypes.ts`, `auditedUiTranslations.ts`, `auditedUiTranslationTypes.ts`.

### Runtime hosts

- Electron: extend `electron/core/runtime-workspace-resources.js`, `runtime-workspace-handlers.js`, `runtime-command-handlers.js`, `ipc-handlers.js`; add focused `electron/core/runtime-insights.js` and `electron/core/runtime-insights-external.js`.
- VS Code: extend `vscode/src/types.ts`, `vscode/src/core/panel.ts`; add focused `vscode/src/core/panelInsights.ts`.
- Chromium: add `chromium-xtension/src/chrome-host-insights.ts`; modify `chromium-xtension/src/chrome-host.ts` and reuse `chrome-host-utils.ts`/`file-access.ts`/`incremental-workspace-scan.ts` where applicable.
- Website app: add `website-app/src/web-insights-host.ts`; modify `website-app/src/web-file-utility-router.ts`.
- Tauri: extend dispatcher routing; add `tauri/src/insights/mod.rs`, `scan.rs`, `external.rs`.

---

### Task 1: Define Insights contracts and configuration normalization

**Files:**
- Create: `ui/src/insights/contracts.ts`
- Create: `ui/src/insights/config.ts`
- Create: `ui/src/insights/patterns.ts`
- Modify: `ui/src/types/webviewMessages.ts`
- Modify: `ui/src/types/hostMessages.ts`
- Test: `tests/unit/ui/insights/contracts.test.ts`
- Test: `tests/unit/ui/insights/patterns.test.ts`

**Interfaces:**
- Produces: `InsightsWorkspaceEntry`, `InsightsScanRequest`, `InsightsScanBatch`, `InsightsScanComplete`, `InsightsSourceResult`, `WorkspaceResourceProbeResult`, `InsightsFsDelta`, `InsightsRuntimeCapabilities`, `ExternalLinkCheckRequest`, `ExternalLinkCheckResult`, `InsightsSettings`, `InsightsWorkspaceOverrides`, `normalizeInsightsSettings()`, `createInsightsPathMatcher()`.

- [ ] **Step 1: Write failing contract/default tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INSIGHTS_SETTINGS,
  normalizeInsightsSettings,
} from '../../../../ui/src/insights/config';

it('uses approved safety and UX defaults', () => {
  expect(DEFAULT_INSIGHTS_SETTINGS.externalLinks.enabled).toBe(false);
  expect(DEFAULT_INSIGHTS_SETTINGS.externalLinks.timeoutMs).toBe(10_000);
  expect(DEFAULT_INSIGHTS_SETTINGS.sourceSoftLimitBytes).toBe(10 * 1024 * 1024);
  expect(DEFAULT_INSIGHTS_SETTINGS.sourceHardLimitBytes).toBe(64 * 1024 * 1024);
  expect(DEFAULT_INSIGHTS_SETTINGS.nearDuplicateThreshold).toBe(0.90);
  expect(DEFAULT_INSIGHTS_SETTINGS.graphNodeCap).toBe(100);
  expect(DEFAULT_INSIGHTS_SETTINGS.cacheCapBytes).toBe(500 * 1024 * 1024);
});

it('clamps external timeout to 3-30 seconds', () => {
  expect(normalizeInsightsSettings({ externalLinks: { timeoutMs: 100 } }).externalLinks.timeoutMs).toBe(3_000);
  expect(normalizeInsightsSettings({ externalLinks: { timeoutMs: 90_000 } }).externalLinks.timeoutMs).toBe(30_000);
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/contracts.test.ts tests/unit/ui/insights/patterns.test.ts
```

Expected: FAIL because the Insights modules/types do not exist.

- [ ] **Step 3: Implement contracts/defaults and gitignore-style precedence**

```ts
export interface InsightsWorkspaceEntry {
  readonly relativePath: string;
  readonly canonicalRelativePath: string;
  readonly kind: 'file' | 'directory';
  readonly sizeBytes: number;
  readonly mtimeMs: number;
  readonly extension?: string;
  readonly isSymlink?: boolean;
}

export type WorkspaceResourceProbeStatus =
  | 'exists' | 'missing' | 'outside-workspace' | 'unreadable' | 'unsupported';

export interface WorkspaceResourceProbeResult {
  readonly status: WorkspaceResourceProbeStatus;
  readonly relativePath?: string;
  readonly kind?: 'file' | 'directory';
  readonly sizeBytes?: number;
  readonly mimeType?: string;
}

export const DEFAULT_INSIGHTS_SETTINGS = {
  externalLinks: { enabled: false, timeoutMs: 10_000 },
  sourceSoftLimitBytes: 10 * 1024 * 1024,
  sourceHardLimitBytes: 64 * 1024 * 1024,
  nearDuplicateThreshold: 0.90,
  graphNodeCap: 100,
  cacheCapBytes: 500 * 1024 * 1024,
} as const;
```

Use one path matcher for scan/watch/poll/refresh/oversized decisions. Hard exclusions win permanently; built-in defaults and `.gitignore` are then overridden by user rules in user-defined last-match-wins order.

- [ ] **Step 4: Run focused tests and typecheck**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/contracts.test.ts tests/unit/ui/insights/patterns.test.ts
pnpm --filter ./ui exec tsc -b --pretty false
```

Expected: PASS and TypeScript exit 0.

- [ ] **Step 5: Commit**

```bash
git add ui/src/insights ui/src/types/webviewMessages.ts ui/src/types/hostMessages.ts tests/unit/ui/insights
git commit -m "feat: define workspace insights contracts"
```

---

### Task 2: Replace simplistic frontmatter parsing with YAML metadata parsing

**Files:**
- Create: `ui/src/markdown/frontmatter.ts`
- Modify: `ui/src/markdown/sourceMapping.ts`
- Modify: `ui/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `ui/src/types/content.ts`
- Test: `tests/unit/ui/markdown/frontmatter.test.ts`
- Test: existing parser/source-mapping tests under `tests/unit/ui/markdown/`

**Interfaces:**
- Produces: `parseFrontmatterDocument(source): ParsedFrontmatterDocument`.
- `ParsedFrontmatterDocument` contains `body`, `sourceSegments`, `flatFrontmatter`, `metadata: { title?: string; aliases: string[]; tags: string[] }`, and diagnostics for malformed YAML, duplicate keys, invalid Insights metadata.
- Existing renderer consumers continue receiving a compatible flat frontmatter representation.

- [ ] **Step 1: Add failing YAML behavior tests**

```ts
it('parses title, aliases and tags without losing source mapping', () => {
  const parsed = parseFrontmatterDocument(`---
title: Setup
aliases:
  - Install
  - Setup Guide
tags: [api, docs]
---
# Body
`);
  expect(parsed.metadata).toEqual({
    title: 'Setup',
    aliases: ['Install', 'Setup Guide'],
    tags: ['api', 'docs'],
  });
  expect(parsed.body).toBe('# Body\n');
});

it('ignores only a duplicated key and preserves unrelated metadata', () => {
  const parsed = parseFrontmatterDocument(`---
title: One
title: Two
tags: [docs]
---
Body
`);
  expect(parsed.metadata.title).toBeUndefined();
  expect(parsed.metadata.tags).toEqual(['docs']);
  expect(parsed.diagnostics.map(d => d.ruleId)).toContain('frontmatter/duplicate-key');
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/markdown/frontmatter.test.ts
```

Expected: FAIL because `parseFrontmatterDocument` does not exist and current parsing only supports scalar `key: value`.

- [ ] **Step 3: Add the YAML dependency and implement AST-based duplicate handling**

```bash
pnpm --filter ./ui add yaml
```

Implement with `yaml` document parsing configured so duplicate map items can be inspected rather than silently applying first/last-wins. Build a duplicate-key set, omit duplicated keys from typed metadata, and keep unrelated valid fields. Preserve `scanFrontmatterPreamble()` behavior and source segments so parser ranges stay correct.

- [ ] **Step 4: Run frontmatter/parser regression tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/markdown/frontmatter.test.ts tests/unit/ui/markdown
pnpm --filter ./ui exec tsc -b --pretty false
```

Expected: PASS; malformed YAML yields diagnostics while body parsing remains available.

- [ ] **Step 5: Commit**

```bash
git add ui/src/markdown/frontmatter.ts ui/src/markdown/sourceMapping.ts ui/src/types/content.ts ui/package.json pnpm-lock.yaml tests/unit/ui/markdown
git commit -m "feat: parse yaml frontmatter metadata"
```

---

### Task 3: Centralize anchor generation and static-anchor extraction

**Files:**
- Create: `ui/src/markdown/anchors.ts`
- Modify: `ui/src/markdown/renderer.ts`
- Modify: `ui/src/markdown/utils.ts` only if a shared normalization helper is required
- Test: `tests/unit/ui/markdown/anchors.test.ts`
- Test: existing renderer tests

**Interfaces:**
- Produces: `createHeadingIdAllocator()`, `buildDocumentAnchorIndex(tokens, staticHtmlSource?)`.
- Renderer and Insights both consume the same allocator.

- [ ] **Step 1: Write failing duplicate/Setext/static-anchor tests**

```ts
it('matches renderer duplicate suffixes', () => {
  const next = createHeadingIdAllocator();
  expect(next('API Usage')).toBe('api-usage');
  expect(next('API Usage')).toBe('api-usage-1');
  expect(next('API Usage')).toBe('api-usage-2');
});

it('includes literal HTML id and legacy anchor name', () => {
  const anchors = extractStaticAnchors('<div id="details"></div><a name="legacy"></a>');
  expect(anchors).toEqual(new Set(['details', 'legacy']));
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/markdown/anchors.test.ts
```

- [ ] **Step 3: Implement allocator and refactor renderer**

```ts
export function createHeadingIdAllocator() {
  const counts = new Map<string, number>();
  return (text: string): string => {
    const base = slugify(text);
    const index = counts.get(base) ?? 0;
    counts.set(base, index + 1);
    return index === 0 ? base : `${base}-${index}`;
  };
}
```

Replace `HtmlRenderer.headingIdCounts`/`nextHeadingId()` internals with this shared allocator. Extract only literal `id="..."`, `id='...'`, and `<a name="...">`; dynamic MDX attributes are not anchors.

- [ ] **Step 4: Run renderer/anchor tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/markdown/anchors.test.ts tests/unit/ui/markdown
```

Expected: PASS with unchanged renderer IDs.

- [ ] **Step 5: Commit**

```bash
git add ui/src/markdown/anchors.ts ui/src/markdown/renderer.ts ui/src/markdown/utils.ts tests/unit/ui/markdown
git commit -m "refactor: share markdown anchor generation"
```

---

### Task 4: Implement Wiki Link syntax, reference extraction, and pure resolution

**Files:**
- Create: `ui/src/markdown/wikiLinks.ts`
- Create: `ui/src/markdown/references.ts`
- Test: `tests/unit/ui/markdown/wiki-links.test.ts`
- Test: `tests/unit/ui/markdown/references.test.ts`

**Interfaces:**
- Produces:

```ts
export interface WikiLinkToken {
  readonly kind: 'link' | 'embed';
  readonly raw: string;
  readonly target: string;
  readonly fragment?: string;
  readonly label?: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

export type WikiResolution =
  | { status: 'resolved'; documentPath: string; canonicalPath: string; fragment?: string; caseMismatch: boolean }
  | { status: 'ambiguous'; candidates: readonly string[] }
  | { status: 'missing' | 'outside-workspace' | 'invalid-anchor' };

export function parseWikiLink(raw: string, offset?: number): WikiLinkToken | WikiParseFailure;
export function resolveWikiLink(token: WikiLinkToken, context: WikiResolverContext): WikiResolution;
```

- `extractDocumentReferences()` emits standard links, Wiki links/embeds, static HTML/MDX refs, dynamic refs, media categories, tags, and source ranges.

- [ ] **Step 1: Write failing syntax/resolution tests**

Cover exact approved forms:

```ts
expect(parseWikiLink('[[Guide#Install|Setup]]')).toMatchObject({
  kind: 'link', target: 'Guide', fragment: 'Install', label: 'Setup',
});
expect(parseWikiLink('[[a\\#b\\|c]]')).toMatchObject({ target: 'a#b|c' });
expect(parseWikiLink('![[../media\\image.png]]')).toMatchObject({
  kind: 'embed', target: '../media/image.png',
});
```

Add cases for `.md/.mdx` ambiguity, title/alias candidates, `[[#Heading]]`, directory targets (`README.md/.mdx`, `index.md/.mdx`), case mismatch, malformed syntax, standard Markdown literal-extension semantics, percent-decoded fragments, query stripping, static HTML refs, dynamic MDX refs, and Markdown-aware tags.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/markdown/wiki-links.test.ts tests/unit/ui/markdown/references.test.ts
```

- [ ] **Step 3: Implement parser/extractor/resolver**

Use parser/source ranges to exclude fenced code, inline code, link destinations, HTML attributes, and other non-prose tag contexts. Normalize resolver keys with Unicode normalization and locale-independent case folding while preserving canonical display casing. Resolution precedence is explicit/relative path, filename/stem, canonical title, aliases; ambiguous candidates remain ambiguous.

Normal Markdown `[Guide](Guide)` stays literal. Wiki `[[Guide]]` may try `.md`/`.mdx`. Directory links resolve only when exactly one recognized index document is viable.

- [ ] **Step 4: Run focused and parser tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/markdown/wiki-links.test.ts tests/unit/ui/markdown/references.test.ts tests/unit/ui/markdown
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/markdown/wikiLinks.ts ui/src/markdown/references.ts tests/unit/ui/markdown
git commit -m "feat: add wiki link resolution semantics"
```

---

### Task 5: Add renderer/navigation support for Wiki Links and transclusion

**Files:**
- Modify: `ui/src/markdown/inline.ts`
- Modify: `ui/src/markdown/renderer.ts`
- Modify: `ui/src/markdown/types.ts`
- Modify: `ui/src/contexts/NavigationContext.tsx`
- Modify: `ui/src/dom/globalHandlers.ts`
- Create: `ui/src/markdown/transclusion.ts`
- Test: `tests/unit/ui/markdown/wiki-renderer.test.ts`
- Test: `tests/unit/ui/markdown/transclusion.test.ts`
- Test: `tests/unit/ui/navigation-wiki-links.test.tsx`

**Interfaces:**
- Consumes: `parseWikiLink()`, `resolveWikiLink()`, shared anchor allocator.
- Produces: `TransclusionRenderContext` with `sourceDocumentPath`, `depth`, `ancestorDocumentPaths`, and async `resolve/read/render` callbacks.
- UI navigation exposes one `navigateWikiLink(rawTarget, sourceDocumentPath)` path shared by renderer and Insights.

- [ ] **Step 1: Write failing render/navigation/transclusion tests**

```ts
it('renders a wiki link as an internal resolvable action', () => {
  const html = renderInline('See [[Setup|Install guide]]');
  expect(html).toContain('data-mdn-wiki-target="Setup"');
  expect(html).toContain('Install guide');
});

it('stops a transclusion cycle', async () => {
  const result = await renderTransclusion('A.md', 'B.md', {
    depth: 2,
    ancestorDocumentPaths: ['A.md', 'B.md'],
  });
  expect(result.status).toBe('cycle');
});
```

Also test depth 5, nested source-relative resolution, interactive links inside embedded Markdown, missing/ambiguous placeholders, and supported non-Markdown preview delegation.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/markdown/wiki-renderer.test.ts tests/unit/ui/markdown/transclusion.test.ts tests/unit/ui/navigation-wiki-links.test.tsx
```

- [ ] **Step 3: Implement renderer hooks without starting Insights eagerly**

Render Wiki syntax into data attributes/actions, not hard-coded guessed paths. `navigateWikiLink()` and `renderTransclusion()` accept an injected `WikiResolverContext`/catalog reader, so this task is independently testable with an in-memory catalog and does not start Insights. Task 15 wires that interface to the lazy active-workspace host/index session.

Keep embedded source identity in data/source-mapping attributes so bookmarks/navigation refer to the embedded source document. Use an injected existing-preview callback for supported PDF/DOCX/XLSX/PPTX/HTML/RTF embeds. Remote embeds render an explicit unloaded placeholder.

- [ ] **Step 4: Run markdown/navigation regression suite**

```bash
pnpm exec vitest run --project ui tests/unit/ui/markdown tests/unit/ui/navigation-wiki-links.test.tsx
pnpm --filter ./ui exec tsc -b --pretty false
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/markdown ui/src/contexts/NavigationContext.tsx ui/src/dom/globalHandlers.ts tests/unit/ui/markdown tests/unit/ui/navigation-wiki-links.test.tsx
git commit -m "feat: render wiki links and transclusions"
```

---

### Task 6: Add UI-to-host Insights protocol and bridge helpers

**Files:**
- Modify: `ui/src/types/webviewMessages.ts`
- Modify: `ui/src/types/hostMessages.ts`
- Modify: `ui/src/platform/bridge.ts`
- Test: `tests/unit/ui/platform-bridges.test.ts`
- Test: `tests/unit/ui/insights/host-protocol.test.ts`

**Interfaces:**
- Produces bridge request helpers:
  - `scanInsightsWorkspace(request)`
  - `cancelInsightsScan(requestId)`
  - `readInsightsDocumentSource(request)`
  - `probeWorkspaceResource(request)`
  - `setInsightsWatchState(request)`
  - `checkExternalLinks(request)`
  - `cancelExternalLinkChecks(requestId)`
- Host messages stream batches/results keyed by request ID and workspace operation ID.

- [ ] **Step 1: Write failing bridge correlation tests**

```ts
it('correlates streamed scan batches and completion by request id', async () => {
  const scan = bridge.scanInsightsWorkspace({ requestId: 'scan-1', workspaceOperationId: 'ws-1', patterns: [] });
  host.emit({ command: 'insightsScanBatch', requestId: 'scan-1', entries: [entry] });
  host.emit({ command: 'insightsScanComplete', requestId: 'scan-1', truncated: false, excludedCount: 0 });
  await expect(scan.done).resolves.toMatchObject({ truncated: false });
});
```

In the test fixture, define `entry` as an `InsightsWorkspaceEntry` and use the existing bridge fake host/event helper from `platform-bridges.test.ts`. Verify probe results carry metadata only and external results preserve per-URL status.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/platform-bridges.test.ts tests/unit/ui/insights/host-protocol.test.ts
```

- [ ] **Step 3: Implement typed message unions and request helpers**

Keep legacy `readWorkspaceExportResource` unchanged for explicit binary preview/export. Do not reuse it from the probe helper. Ensure cancellation rejects/finishes outstanding iterators without leaking listeners.

- [ ] **Step 4: Run bridge tests/typecheck**

```bash
pnpm exec vitest run --project ui tests/unit/ui/platform-bridges.test.ts tests/unit/ui/insights/host-protocol.test.ts
pnpm --filter ./ui exec tsc -b --pretty false
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/types ui/src/platform/bridge.ts tests/unit/ui/platform-bridges.test.ts tests/unit/ui/insights/host-protocol.test.ts
git commit -m "feat: add insights host protocol"
```

---

### Task 7: Implement workspace scan/source/probe/watch capabilities in all runtimes

**Files:**
- Electron: create `electron/core/runtime-insights.js`; modify `electron/core/runtime-workspace-resources.js`, `electron/core/runtime-workspace-handlers.js`, `electron/core/runtime-command-handlers.js`, `electron/core/ipc-handlers.js`.
- VS Code: create `vscode/src/core/panelInsights.ts`; modify `vscode/src/core/panel.ts`, `vscode/src/types.ts`.
- Chromium: create `chromium-xtension/src/chrome-host-insights.ts`; modify `chromium-xtension/src/chrome-host.ts` and reuse `chromium-xtension/src/file-access.ts`/`incremental-workspace-scan.ts`.
- Website: create `website-app/src/web-insights-host.ts`; modify `website-app/src/web-file-utility-router.ts`.
- Tauri: create `tauri/src/insights/mod.rs`, `tauri/src/insights/scan.rs`; modify `tauri/src/dispatcher.rs` and `tauri/src/dispatcher/handlers.rs`.
- Test: `tests/unit/electron/runtime-insights.test.ts`
- Test: `tests/unit/vscode/panel-insights.test.ts`
- Test: `tests/unit/chromium/chrome-host-insights.test.ts`
- Test: `tests/node/insights-host-contracts.test.mjs`
- Test: Tauri Rust unit tests in `tauri/src/insights/scan.rs`

**Interfaces:**
- Consumes host protocol from Task 6.
- Produces recursive metadata scan, bounded Markdown source read, metadata-only probe, watcher capability or visible-only polling capability.

- [ ] **Step 1: Write host contract tests before implementations**

Required assertions per runtime:

```ts
expect(await probe('docs/image.png')).toMatchObject({
  status: 'exists',
  kind: 'file',
});
expect(binaryReadSpy).not.toHaveBeenCalled();

const MiB = 1024 * 1024;
expect(await readSource('large.md', { softLimitBytes: 10 * MiB }))
  .toMatchObject({ status: 'too-large' });
expect(await readSource('allowed-large.md', { softLimitBytes: 20 * MiB }))
  .toMatchObject({ status: 'ok' });
expect(await readSource('over-hard-limit.md', { softLimitBytes: 100 * MiB }))
  .toMatchObject({ status: 'too-large', hardLimit: true });
```

Create >1000-file fixture metadata for hosts that previously cap normal scanning and assert Insights reports all eligible entries or an explicit truncation status, never silent completion.

- [ ] **Step 2: Run RED across runtimes**

```bash
pnpm exec vitest run --project electron tests/unit/electron/runtime-insights.test.ts
pnpm exec vitest run --project vscode tests/unit/vscode/panel-insights.test.ts
pnpm exec vitest run --project chromium tests/unit/chromium/chrome-host-insights.test.ts
node --experimental-strip-types --test tests/node/insights-host-contracts.test.mjs
cargo test --manifest-path tauri/Cargo.toml insights_scan -- --test-threads=1
```

- [ ] **Step 3: Implement canonical scan/read/probe behavior**

For every host:
1. canonicalize/realpath candidate;
2. reject symlink escapes;
3. apply hard/default/gitignore/user rules consistently;
4. stream metadata batches;
5. enforce 10 MiB soft / 64 MiB hard source policy;
6. stat probes only;
7. expose watcher when reliable.

Chromium/website runtimes without reliable change observers use metadata polling only while Insights is visible and stop when hidden. Manual Refresh remains available everywhere.

- [ ] **Step 4: Run runtime contract tests**

Run all commands from Step 2 plus:

```bash
pnpm run build:vscode
pnpm run build:chromium
pnpm run build:website-app
cargo test --manifest-path tauri/Cargo.toml -- --test-threads=1
```

Expected: all contract tests/builds pass.

- [ ] **Step 5: Commit**

```bash
git add electron vscode chromium-xtension website-app tauri tests/unit/electron tests/unit/vscode tests/unit/chromium tests/node/insights-host-contracts.test.mjs
git commit -m "feat: add cross-runtime insights filesystem hosts"
```

---

### Task 8: Implement secure host-backed external HTTP checking

**Files:**
- Create: `electron/core/runtime-insights-external.js`
- Extend: `vscode/src/core/panelInsights.ts`
- Create: `tauri/src/insights/external.rs`
- Modify: `tauri/Cargo.toml` only if the existing HTTP stack cannot pin resolved IPs safely
- Extend: `chromium-xtension/src/chrome-host-insights.ts` and `website-app/src/web-insights-host.ts` to report `unsupported` unless they can satisfy the full status/DNS/IP contract.
- Test: `tests/unit/electron/insights-external.test.ts`
- Test: `tests/unit/vscode/insights-external.test.ts`
- Test: `tests/unit/chromium/chrome-host-insights.test.ts`
- Test: Tauri tests in `tauri/src/insights/external.rs`

**Interfaces:**
- Produces real `ExternalLinkCheckResult` statuses: `reachable`, `auth-required`, `broken`, `rate-limited`, `server-error`, `unreachable`, `unknown`, `private-confirmation-required`, `unsupported`.

- [ ] **Step 1: Write failing security/behavior tests**

Use injected DNS and HTTP transports so tests never depend on public internet:

```ts
it('does not connect when DNS resolves to private space without approval', async () => {
  dns.resolve.mockResolvedValue(['127.0.0.1']);
  const result = await checker.check('http://example.test/', session);
  expect(result.status).toBe('private-confirmation-required');
  expect(http.request).not.toHaveBeenCalled();
});

it('pins the validated address and revalidates redirects', async () => {
  dns.resolve
    .mockResolvedValueOnce(['203.0.113.10'])
    .mockResolvedValueOnce(['10.0.0.8']);
  http.head.mockResolvedValue({ status: 302, location: 'http://private.test/' });
  expect((await checker.check('https://public.test/', session)).status)
    .toBe('private-confirmation-required');
});
```

Add HEAD→GET fallback, no Cookie/Authorization, 404/410, 401/403, 429, 5xx one-retry, Retry-After, timeout, TLS failure, redirect limit 5, HTTPS downgrade flag, 4-global/2-origin concurrency, and abort tests.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project electron tests/unit/electron/insights-external.test.ts
pnpm exec vitest run --project vscode tests/unit/vscode/insights-external.test.ts
cargo test --manifest-path tauri/Cargo.toml insights_external -- --test-threads=1
```

- [ ] **Step 3: Implement request state machine**

```text
parse URL
→ resolve all addresses
→ classify addresses
→ require origin-scoped private approval when needed
→ select/pin validated IP
→ HEAD
→ if 405/501/known inconclusive HEAD behavior: bounded GET and abort body
→ validate every redirect from scratch
→ classify status
→ optional single transient retry
```

Never use browser `no-cors` responses for status. Chromium/website report `unsupported` unless their host context can satisfy real status + DNS/IP policy.

- [ ] **Step 4: Run checker suites and runtime builds**

```bash
pnpm exec vitest run --project electron tests/unit/electron/insights-external.test.ts
pnpm exec vitest run --project vscode tests/unit/vscode/insights-external.test.ts
pnpm exec vitest run --project chromium tests/unit/chromium/chrome-host-insights.test.ts
cargo test --manifest-path tauri/Cargo.toml insights_external -- --test-threads=1
pnpm run build:vscode
```

- [ ] **Step 5: Commit**

```bash
git add electron/core/runtime-insights-external.js vscode/src/core/panelInsights.ts chromium-xtension/src/chrome-host-insights.ts website-app/src/web-insights-host.ts tauri/src/insights/external.rs tauri/Cargo.toml tests
git commit -m "feat: add secure external link checker"
```

---

### Task 9: Build one-document analysis and configurable linting

**Files:**
- Create: `ui/src/insights/analyzeDocument.ts`
- Create: `ui/src/insights/lint.ts`
- Test: `tests/unit/ui/insights/analyze-document.test.ts`
- Test: `tests/unit/ui/insights/lint.test.ts`

**Interfaces:**
- Consumes parser/frontmatter/anchors/references from Tasks 2–4.
- Produces `AnalyzedDocument` with title/aliases/tags, anchors, links/media, sections, terminology/signatures, and lint findings.
- Produces `applyLintSuppressions(findings, suppressions)`.

- [ ] **Step 1: Write failing analysis/lint tests**

```ts
it('keeps body findings when frontmatter is malformed', () => {
  const result = analyzeDocument({
    path: 'guide.md',
    source: '---\ntitle: [bad\n---\n# A\n### C\n',
    revision: 'r1',
  });
  expect(result.lint.map(f => f.ruleId)).toContain('frontmatter/malformed');
  expect(result.lint.map(f => f.ruleId)).toContain('heading/skipped-level');
});
```

Cover duplicate heading, malformed table delimiter, table column count, list marker/indentation, trailing whitespace, malformed Wiki syntax, case mismatch, malformed URI, Mermaid failure input, and suppression scopes.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/analyze-document.test.ts tests/unit/ui/insights/lint.test.ts
```

- [ ] **Step 3: Implement single-parse analysis**

Call the existing parser once per revision, then derive source-range-aware references/lint data from tokens plus focused extractors. Do not render transcluded content into duplicate/signature source. Keep readable significant terms live-only and emit hashed/signature forms for persistence.

- [ ] **Step 4: Run analysis/lint tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/analyze-document.test.ts tests/unit/ui/insights/lint.test.ts tests/unit/ui/markdown
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/insights/analyzeDocument.ts ui/src/insights/lint.ts tests/unit/ui/insights
git commit -m "feat: analyze and lint workspace documents"
```

---

### Task 10: Implement incremental workspace index, backlinks, and graph projection

**Files:**
- Create: `ui/src/insights/index.ts`
- Create: `ui/src/insights/graph.ts`
- Test: `tests/unit/ui/insights/index.test.ts`
- Test: `tests/unit/ui/insights/graph.test.ts`

**Interfaces:**
- Produces `WorkspaceInsightsIndex`:

```ts
class WorkspaceInsightsIndex {
  applyDocument(document: AnalyzedDocument): IndexDeltaResult;
  removeDocument(canonicalPath: string): IndexDeltaResult;
  renameDocument(change: HighConfidenceRename): IndexDeltaResult;
  applyActiveOverlay(document: AnalyzedDocument): IndexDeltaResult;
  clearActiveOverlay(canonicalPath: string): IndexDeltaResult;
  snapshot(): WorkspaceInsightsSnapshot;
}
```

- Produces `buildFocusedGraph(snapshot, { centerPath, nodeCap, includeInferred, showTags, showHeadings })`.

- [ ] **Step 1: Write failing incremental tests**

```ts
it('removes deleted documents and turns surviving references into broken links', () => {
  const index = new WorkspaceInsightsIndex();
  index.applyDocument(analyzeDocument({ path: 'a.md', source: '[[B]]', revision: '1' }));
  index.applyDocument(analyzeDocument({ path: 'b.md', source: '# B', revision: '1' }));
  index.removeDocument('b.md');
  expect(index.snapshot().documents.has('b.md')).toBe(false);
  expect(index.snapshot().brokenLinks[0].status).toBe('missing');
});
```

Add active-overlay replacement/removal, link/embed edge distinction, same-document fragment exclusion, high-confidence rename migration, ambiguity, and deterministic radial coordinates for the same graph state.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/index.test.ts tests/unit/ui/insights/graph.test.ts
```

- [ ] **Step 3: Implement inverted maps and deterministic graph**

Maintain document/path/title/alias/tag/heading/link indexes incrementally. Graph projection ranks explicit edges before inferred edges, caps at configurable node count, reports hidden count, and generates stable radial coordinates from sorted node identity rather than force simulation.

- [ ] **Step 4: Run index/graph tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/index.test.ts tests/unit/ui/insights/graph.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/insights/index.ts ui/src/insights/graph.ts tests/unit/ui/insights
git commit -m "feat: maintain insights backlinks and graph"
```

---

### Task 11: Implement duplicate candidate engines

**Files:**
- Create: `ui/src/insights/duplicates.ts`
- Test: `tests/unit/ui/insights/duplicates.test.ts`

**Interfaces:**
- Produces `normalizeExactDuplicateSource()`, `buildSectionFingerprints()`, `buildPassageFingerprints()`, `buildNearDuplicateCandidates()`, `scoreNearDuplicate()`, `findDuplicateGroups()`.

- [ ] **Step 1: Write failing exact/repeated/near tests**

```ts
it('treats BOM, CRLF and trailing whitespace as exact-normalized duplicates', () => {
  expect(normalizeExactDuplicateSource('\uFEFF# A  \r\n'))
    .toBe(normalizeExactDuplicateSource('# A\n'));
});

it('does not compare every document pair', () => {
  const corpus = Array.from({ length: 2_000 }, (_, index) => ({
    path: `doc-${index}.md`,
    normalizedTokens: [`topic-${index % 200}`, `unique-${index}`],
  }));
  const scorer = vi.fn(scoreNearDuplicate);
  findDuplicateGroups(corpus, { scorePair: scorer, threshold: 0.90 });
  expect(scorer.mock.calls.length).toBeLessThan(20_000);
});
```

Test >=100 normalized characters / >=20 meaningful-token section threshold, ~120-token sliding windows with ~50% stride, boilerplate suppression, threshold override, and duplicate suppression presentation.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/duplicates.test.ts
```

- [ ] **Step 3: Implement hashed buckets/candidate generation**

Exact: normalized hash groups. Repeated passages: section hash plus bounded rolling/window signatures. Near duplicates: use shingle/signature buckets or inverted significant-term evidence to generate a sparse candidate set; only candidate pairs receive exact similarity scoring.

- [ ] **Step 4: Run duplicate tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/duplicates.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/insights/duplicates.ts tests/unit/ui/insights/duplicates.test.ts
git commit -m "feat: detect duplicate workspace content"
```

---

### Task 12: Implement relationship candidate generation and explainable scoring

**Files:**
- Create: `ui/src/insights/relationships.ts`
- Test: `tests/unit/ui/insights/relationships.test.ts`

**Interfaces:**
- Produces `RELATIONSHIP_PRESETS`, `normalizeRelationshipWeights()`, `buildRelationshipCandidates()`, `scoreRelatedDocument()`, `getRelationshipEvidence()`.

- [ ] **Step 1: Write failing scoring/preset tests**

```ts
it('uses approved default weights', () => {
  expect(RELATIONSHIP_PRESETS.default).toEqual({
    links: 35, tags: 20, headings: 15, title: 10, terminology: 20,
  });
});

it('returns actual evidence without persisting readable terminology', () => {
  const result = scoreRelatedDocument(
    fixtureDocument({ tags: ['api'], terms: ['refresh token'] }),
    fixtureDocument({ tags: ['api'], terms: ['refresh token'] }),
    RELATIONSHIP_PRESETS.default,
  );
  expect(result.score).toBeGreaterThan(0);
  expect(result.evidence.sharedTags).toContain('api');
  expect(result.evidence.sharedTerms).toContain('refresh token');
  expect(result.persisted.terminologySignatures.every(
    (value: string) => /^[a-f0-9]{16,}$/i.test(value),
  )).toBe(true);
});
```

Define `fixtureDocument()` in the test file as a small factory returning the concrete relationship-input type. Test Link-focused, Tag-focused, Terminology-focused, custom normalization, omission of no-signal candidates, and candidate-count bounds for large sparse corpora.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/relationships.test.ts
```

- [ ] **Step 3: Implement inverted candidate indexes and 0–100 scoring**

Candidates come from links/tags/headings/title/significant-term indexes. Normalize custom weights before scoring. Persist only hashed/signature terminology; readable terms remain live or are reconstructed on demand.

- [ ] **Step 4: Run relationship tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/relationships.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/insights/relationships.ts tests/unit/ui/insights/relationships.test.ts
git commit -m "feat: rank related workspace documents"
```

---

### Task 13: Add worker protocol, dedicated worker, and degraded fallback

**Files:**
- Create: `ui/src/insights/workerProtocol.ts`
- Create: `ui/src/insights/insights.worker.ts`
- Create: `ui/src/insights/workerClient.ts`
- Modify: `ui/vite.config.ts` only if worker bundling needs explicit configuration
- Test: `tests/unit/ui/insights/worker-client.test.ts`

**Interfaces:**
- Worker input: `initialize`, `applySourceBatch`, `applyFsDeltaBatch`, `setActiveOverlay`, `clearActiveOverlay`, `updateConfig`, `requestSnapshot`, `cancel`.
- Worker output: `progress`, `documentResults`, `snapshotDelta`, `complete`, `cancelled`, `error`.
- Produces `createInsightsWorkerClient()` and cooperative `createChunkedInsightsFallback()`.

- [ ] **Step 1: Write failing batching/lifecycle tests**

```ts
it('batches source work and emits provisional results before complete', async () => {
  const client = createTestWorkerClient();
  await client.applySourceBatch([
    { path: 'a.md', source: '# A', revision: '1' },
    { path: 'b.md', source: '# B', revision: '1' },
  ]);
  expect(client.events.some(e => e.type === 'documentResults')).toBe(true);
  expect(client.events.at(-1)?.type).toBe('complete');
});

it('reports degraded mode when Worker construction fails', () => {
  const client = createInsightsWorkerClient({ createWorker: () => { throw new Error('blocked'); } });
  expect(client.mode).toBe('degraded');
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/worker-client.test.ts
```

- [ ] **Step 3: Implement worker around `WorkspaceInsightsIndex`**

Batch messages; never emit one message per token/finding. Cancellation stops queued jobs and keeps completed index state reusable. Fallback processes bounded document chunks using `scheduler.yield` when available or `setTimeout(0)`/microtask scheduling, and exposes `mode: 'degraded'`.

- [ ] **Step 4: Run worker tests/build**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/worker-client.test.ts tests/unit/ui/insights
pnpm run build:ui
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/insights/workerProtocol.ts ui/src/insights/insights.worker.ts ui/src/insights/workerClient.ts ui/vite.config.ts tests/unit/ui/insights
git commit -m "feat: run workspace insights in a worker"
```

---

### Task 14: Add cache, workspace identity, settings precedence, and settings import/export

**Files:**
- Create: `ui/src/insights/cache.ts`
- Create: `ui/src/insights/workspaceIdentity.ts`
- Extend: `ui/src/insights/config.ts`
- Modify: `ui/src/settings/settingsImportExport.ts`
- Modify: `ui/src/constants/storage.ts`
- Modify: `ui/src/types/settings.ts`
- Test: `tests/unit/ui/insights/cache.test.ts`
- Test: `tests/unit/ui/insights/workspace-identity.test.ts`
- Test: `tests/unit/ui/settings-import-export.test.ts`

**Interfaces:**
- Produces `InsightsCacheStore`, `resolveWorkspaceIdentity()`, `resolveInsightsSettings(global, workspace)`, `resetWorkspaceInsightsOverrides()`.
- Cache schema stores derived data only; full source/session network/private approvals are structurally absent.

- [ ] **Step 1: Write failing persistence/privacy tests**

```ts
it('never serializes source bodies or external session state', async () => {
  await store.putWorkspace(makeCacheFixture({ source: '# secret', externalSession: { url: 'https://x' } }));
  const raw = JSON.stringify(await dumpIndexedDb(store));
  expect(raw).not.toContain('# secret');
  expect(raw).not.toContain('externalSession');
});

it('applies workspace override over global over built-in', () => {
  const resolved = resolveInsightsSettings(
    { nearDuplicateThreshold: 0.88 },
    { nearDuplicateThreshold: 0.93 },
  );
  expect(resolved.nearDuplicateThreshold).toBe(0.93);
});
```

Define `makeCacheFixture()` and `dumpIndexedDb()` in the test file using `fake-indexeddb`. Add schema-component invalidation, normal metadata-first restore, hybrid per-file then whole-workspace LRU, 500 MiB default cap, high-confidence moved-workspace path history, uncertain-new-workspace behavior, and settings import validation.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/cache.test.ts tests/unit/ui/insights/workspace-identity.test.ts tests/unit/ui/settings-import-export.test.ts
```

- [ ] **Step 3: Implement persistence/config integration**

Store schema/component versions. Evict inactive per-file entries first, then inactive workspace caches. Keep settings/suppressions separate from disposable cache. Extend existing settings JSON envelope rather than creating a second settings file format.

- [ ] **Step 4: Run cache/settings tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/cache.test.ts tests/unit/ui/insights/workspace-identity.test.ts tests/unit/ui/settings-import-export.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/insights/cache.ts ui/src/insights/workspaceIdentity.ts ui/src/insights/config.ts ui/src/settings/settingsImportExport.ts ui/src/constants/storage.ts ui/src/types/settings.ts tests/unit/ui
git commit -m "feat: persist workspace insights state"
```

---

### Task 15: Orchestrate lazy active-workspace Insights sessions and unsaved overlays

**Files:**
- Create: `ui/src/insights/useWorkspaceInsights.ts`
- Modify: `ui/src/contexts/useAppStateEffects.ts`
- Modify: `ui/src/App.tsx`
- Test: `tests/unit/ui/insights/use-workspace-insights.test.tsx`

**Interfaces:**
- Produces one `WorkspaceInsightsSession` for the active workspace.
- Session methods: `open()`, `closePanel()`, `refreshLocal()`, `pause()`, `dispose()`, `applyActiveOverlay()`, `clearActiveOverlay()`, `checkExternalLinks()`, `cancelExternalChecks()`.
- Provides the injected `WikiResolverContext`/catalog reader required by Task 5, reusing the live index when available and lazily constructing the minimum document catalog when Wiki navigation occurs before Insights has been opened.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it('does not scan or start a worker until first Insights open', () => {
  renderHook(() => useWorkspaceInsights(props));
  expect(host.scanInsightsWorkspace).not.toHaveBeenCalled();
  expect(workerFactory).not.toHaveBeenCalled();
});

it('pauses expensive work on panel close but keeps completed state warm', async () => {
  const { result } = renderHook(() => useWorkspaceInsights(props));
  await act(() => result.current.open());
  act(() => result.current.closePanel());
  expect(worker.pauseExpensiveWork).toHaveBeenCalled();
  expect(result.current.snapshot.documents.size).toBeGreaterThan(0);
});
```

Add active workspace switch serialize/teardown, streamed provisional results, complete-with-warnings, manual Refresh hashes every eligible source and performs zero external checks, overlay save/revert/close behavior, watcher/polling start/stop, and cancellation/resume.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/use-workspace-insights.test.tsx
```

- [ ] **Step 3: Implement session coordinator**

Normal reopen validation uses path/size/mtime first and hashes suspicious entries. Manual Refresh re-enumerates and hashes all eligible Markdown/MDX documents but reparses only changed/incompatible content. Keep one live session for active workspace only.

- [ ] **Step 4: Run lifecycle tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/insights/use-workspace-insights.test.tsx tests/unit/ui/insights/worker-client.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/insights/useWorkspaceInsights.ts ui/src/contexts/useAppStateEffects.ts ui/src/App.tsx tests/unit/ui/insights/use-workspace-insights.test.tsx
git commit -m "feat: orchestrate workspace insights sessions"
```

---

### Task 16: Add sidebar discovery entry and dedicated resizable panel shell

**Files:**
- Create: `ui/src/components/Insights/WorkspaceInsightsPanel.tsx`
- Create: `ui/src/components/Insights/InsightsSettings.tsx`
- Modify: `ui/src/components/Sidebar/SidebarTabsHeader.tsx`
- Modify: `ui/src/components/Sidebar/Sidebar.tsx`
- Modify: `ui/src/AppView.tsx`
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/hooks/useResize.ts` only to reuse/generalize existing behavior
- Create: `ui/src/styles/global/global-workspace-insights.css`
- Modify: global stylesheet entrypoint that imports the existing `global-*.css` files
- Test: `tests/unit/ui/components/workspace-insights-panel.test.tsx`

**Interfaces:**
- Panel receives `WorkspaceInsightsSessionViewModel`; view keys are `gallery | links | lint | duplicates | graph | related`.
- Sidebar action only opens/focuses the panel.

- [ ] **Step 1: Write failing shell/UI tests**

```tsx
it('opens Insights from the sidebar into the main resizable panel', async () => {
  render(<TestApp />);
  await user.click(screen.getByRole('button', { name: /workspace insights/i }));
  expect(screen.getByRole('region', { name: /workspace insights/i })).toBeVisible();
  expect(screen.getByRole('tab', { name: /gallery/i })).toHaveAttribute('aria-selected', 'true');
});
```

Define `TestApp` with the same app/provider test helpers already used by UI component tests. Test resize keyboard/pointer behavior, progress/provisional status, warning/truncated state, cancel, Refresh, settings, and panel close.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/components/workspace-insights-panel.test.tsx
```

- [ ] **Step 3: Implement shell using existing theme/resize patterns**

Do not add a narrow fourth content tab containing all results. The sidebar entry opens a wider main-area panel. Use existing CSS variables/theme tokens and `useResize` behavior. Keep view content lazy but session shared.

- [ ] **Step 4: Run UI/style tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/components/workspace-insights-panel.test.tsx
pnpm run lint:ui-styles
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Insights ui/src/components/Sidebar ui/src/App.tsx ui/src/AppView.tsx ui/src/hooks/useResize.ts ui/src/styles tests/unit/ui/components
git commit -m "feat: add workspace insights panel"
```

---

### Task 17: Implement Gallery, Links, Lint, and Duplicates views

**Files:**
- Create: `ui/src/components/Insights/GalleryView.tsx`
- Create: `ui/src/components/Insights/LinksView.tsx`
- Create: `ui/src/components/Insights/LintView.tsx`
- Create: `ui/src/components/Insights/DuplicatesView.tsx`
- Test: `tests/unit/ui/components/insights-gallery-links.test.tsx`
- Test: `tests/unit/ui/components/insights-lint-duplicates.test.tsx`

**Interfaces:**
- Consumes session snapshot plus source-navigation/probe/external-check/suppression actions.

- [ ] **Step 1: Write failing view behavior tests**

Gallery assertions:
- referenced media only;
- categories image/diagram/video/audio/document;
- invalid Mermaid visible with failed status;
- local existence invokes metadata probe;
- remote preview is unloaded by default and requires explicit `Load Preview`.

Links assertions:
- distinct missing/invalid-anchor/ambiguous/outside/dynamic/unsupported/non-checkable statuses;
- dynamic refs excluded from broken count;
- `file:` outside workspace classified outside-workspace.

Lint/Duplicate assertions:
- severity/rule filters;
- `Show suppressed`;
- finding/rule/path/workspace suppression actions;
- exact/repeated/near groups; threshold display and reversible duplicate suppression.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/components/insights-gallery-links.test.tsx tests/unit/ui/components/insights-lint-duplicates.test.tsx
```

- [ ] **Step 3: Implement views with source navigation and explicit network boundaries**

Remote Gallery cards must not set actual remote `src` until `Load Preview` is clicked. External-link status in Links remains `unchecked` until the separate check action runs. Use session-level probes/checks rather than direct `fetch()`.

- [ ] **Step 4: Run view tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/components/insights-gallery-links.test.tsx tests/unit/ui/components/insights-lint-duplicates.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Insights/GalleryView.tsx ui/src/components/Insights/LinksView.tsx ui/src/components/Insights/LintView.tsx ui/src/components/Insights/DuplicatesView.tsx tests/unit/ui/components
git commit -m "feat: add insights media links lint and duplicates views"
```

---

### Task 18: Implement Graph and Related views, external-check UX, and report export

**Files:**
- Create: `ui/src/components/Insights/GraphView.tsx`
- Create: `ui/src/components/Insights/RelatedView.tsx`
- Create: `ui/src/insights/reports.ts`
- Extend: `ui/src/components/Insights/LinksView.tsx`
- Extend: `ui/src/components/Insights/WorkspaceInsightsPanel.tsx`
- Test: `tests/unit/ui/components/insights-graph-related.test.tsx`
- Test: `tests/unit/ui/components/insights-external-check.test.tsx`
- Test: `tests/unit/ui/insights/reports.test.ts`

**Interfaces:**
- Graph consumes `FocusedGraph`.
- External checker UI holds session-only result cache and origin approvals; neither is persisted.
- Reports expose `createInsightsMarkdownReport(snapshot, scope)` and `createInsightsJsonReport(snapshot, scope)`.

- [ ] **Step 1: Write failing graph/accessibility/network/report tests**

```tsx
it('synchronizes graph and accessible list selection', async () => {
  render(<GraphView graph={fixture} />);
  await user.click(screen.getByRole('button', { name: /b\.md/i }));
  expect(screen.getByRole('treeitem', { name: /b\.md/i })).toHaveAttribute('aria-selected', 'true');
});

it('checks unique URLs only after explicit action', async () => {
  render(<LinksView {...props} />);
  expect(host.checkExternalLinks).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: /check external links/i }));
  expect(host.checkExternalLinks).toHaveBeenCalledTimes(1);
});
```

Define `fixture`, `props`, and `host` with concrete typed fixtures in the test files. Report tests verify full/filter/selection scope, completeness/provisional metadata, external summary-only fields, and absence of DNS/private approvals/credentials/source bodies.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run --project ui tests/unit/ui/components/insights-graph-related.test.tsx tests/unit/ui/components/insights-external-check.test.tsx tests/unit/ui/insights/reports.test.ts
```

- [ ] **Step 3: Implement graph/related/network/export UX**

Graph: deterministic SVG plus synchronized keyboard list; no force simulation. Inferred edges toggle defaults off.

External checks:
- setting must be enabled;
- selected/filtered scope is default when present;
- explicit full-workspace option;
- show unique URL count;
- origin-scoped private confirmation;
- cancellation aborts queued/in-flight;
- session result cache with age and Recheck bypass.

Export both Markdown and JSON through the existing save-export bridge.

- [ ] **Step 4: Run focused tests**

```bash
pnpm exec vitest run --project ui tests/unit/ui/components/insights-graph-related.test.tsx tests/unit/ui/components/insights-external-check.test.tsx tests/unit/ui/insights/reports.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Insights ui/src/insights/reports.ts tests/unit/ui/components tests/unit/ui/insights/reports.test.ts
git commit -m "feat: add graph related checks and insights reports"
```

---

### Task 19: Complete settings UI, localization, accessibility, documentation, and full verification

**Files:**
- Extend: `ui/src/components/Insights/InsightsSettings.tsx`
- Modify: `ui/src/components/Settings/SettingsModal.tsx`
- Modify: `ui/src/contexts/translations.ts`
- Modify: `ui/src/contexts/translationsData.ts`
- Modify: `ui/src/contexts/translationTypes.ts`
- Modify: `ui/src/contexts/auditedUiTranslations.ts`
- Modify: `ui/src/contexts/auditedUiTranslationTypes.ts`
- Modify: `docs/instructions/05-reference/01-ui-to-host-command-catalog.md`
- Modify: `docs/instructions/03-features/12-settings-preferences-import-export.md`
- Modify: `docs/instructions/05-reference/10-localization-catalog.md`
- Test: `tests/contracts/translations-coverage.test.ts`
- Test: `tests/contracts/ui-style-contract.test.ts`
- Test: `tests/node/localization-settings-doc-sync-contract.test.mjs`

**Interfaces:**
- Settings UI exposes global defaults, workspace overrides/reset, pattern validation, 10 MiB override patterns, duplicate threshold/suppressions, lint severity/suppressions, relationship presets/weights, graph cap, external timeout/toggle, 500 MiB cache cap/usage/clear.
- All user-facing copy is typed/localized.

- [ ] **Step 1: Add failing translation/settings/accessibility contract tests**

```ts
it('has localized Workspace Insights domains in every locale', () => {
  for (const locale of supportedLocales) {
    expect(AUDITED_UI_TRANSLATIONS[locale].insights.externalLinksDescription).toBeTruthy();
    expect(AUDITED_UI_TRANSLATIONS[locale].rendererUi.wikiTransclusionCycle).toBeTruthy();
  }
});
```

Add keyboard tests for graph/list, panel tabs, suppression controls, private confirmation dialog, and non-color edge/status semantics.

- [ ] **Step 2: Run RED**

```bash
pnpm run test:translations
pnpm run lint:ui-styles
node --experimental-strip-types --test tests/node/localization-settings-doc-sync-contract.test.mjs
pnpm exec vitest run --project ui tests/unit/ui/components
```

- [ ] **Step 3: Implement all locale/settings/doc updates**

Use the exact approved external-link setting meaning in every locale: anonymous checks, no cookies/Authorization, private-network confirmation, possible unknown/transient results, and zero external requests while disabled.

Document new host commands/results and runtime `unsupported` behavior. Document that manual Refresh is local-only and that remote media preview is separately explicit.

- [ ] **Step 4: Run the full fresh verification matrix**

Run from repository root:

```bash
pnpm test:ui
pnpm test:electron
pnpm test:vscode
pnpm test:chromium
pnpm test:contracts
pnpm test:translations
pnpm run lint:ui-styles
pnpm run build:ui
pnpm run build:vscode
pnpm run build:chromium
pnpm run build:website-app
cargo test --manifest-path tauri/Cargo.toml -- --test-threads=1
```

Then verify the branch diff contains no stale prototype files, generated artifacts, repository-local cache/config, direct UI `no-cors` external checking, or probe→binary-read coupling.

Expected: every command exits 0. If any command cannot run in the available environment, record it explicitly as unverified rather than claiming success.

- [ ] **Step 5: Commit final integration/docs**

```bash
git add ui electron vscode chromium-xtension website-app tauri tests docs pnpm-lock.yaml
git commit -m "docs: document workspace insights behavior"
```

After the commit, re-read PR #44 review threads/checks and address only technically valid new findings. Do not mark the implementation complete until the fresh verification matrix and final diff review support that claim.

---

## Plan Self-Review / Spec Coverage

This mapping is part of the implementation checklist; executors should preserve it when tasks are split among workers.

| Spec requirement | Implementation task(s) |
| --- | --- |
| Dedicated resizable six-view panel, lazy active-workspace lifecycle | 15–18 |
| Dedicated uncapped scan, exclusions, 10/64 MiB source rules, probes, watchers/polling | 1, 6, 7 |
| Greptile binary-probe finding | 1, 6, 7 |
| Greptile opaque-response finding | 6, 8, 18 |
| Shared parser/source mapping and exact renderer anchors | 2–4, 9 |
| YAML title/aliases/tags, malformed/duplicate handling | 2, 9 |
| Wiki syntax, ambiguity, case folding, paths, directory index behavior | 4–5 |
| Depth-5 interactive transclusion and preview-pipeline reuse | 5, 7, 15 |
| Markdown/HTML/MDX refs, dynamic refs, tags, local schemes | 4, 9 |
| Referenced-only Gallery, Mermaid failure, remote no-auto-load | 9, 17 |
| Broken Link status model | 4, 7, 9, 10, 17 |
| Secure explicit external checking/private approvals/session cache | 8, 15, 18 |
| Lint rules/severity/suppressions | 2, 9, 14, 17 |
| Exact/repeated/near duplicates without O(n²) | 11 |
| Backlinks/focused deterministic graph/accessibility | 10, 18 |
| Explainable relationship presets/custom weights | 12, 18 |
| Unsaved active overlay, delete/rename semantics | 10, 15 |
| Derived cache/versioning/hybrid 500 MiB eviction/workspace identity | 14 |
| Settings precedence/reset/import/export | 1, 14, 19 |
| Manual Refresh full hash/no network | 15 |
| Markdown + JSON report scopes/completeness/privacy | 18 |
| Localization and accessibility | 16–19 |
| Cross-runtime/security/build verification | 7, 8, 19 |

### Type consistency checkpoint

The plan intentionally uses these canonical names across tasks:

- `InsightsWorkspaceEntry`
- `WorkspaceResourceProbeResult`
- `ExternalLinkCheckRequest` / `ExternalLinkCheckResult`
- `WikiLinkToken` / `WikiResolution`
- `AnalyzedDocument`
- `WorkspaceInsightsIndex`
- `WorkspaceInsightsSnapshot`
- `InsightsSettings` / `InsightsWorkspaceOverrides`
- `WorkspaceInsightsSession`

If implementation discovers an existing repository name that should replace one of these, rename it once at the defining task and update all later task references in this plan before continuing.
