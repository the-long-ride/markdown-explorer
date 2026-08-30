# Workspace Insights and Wiki Links — Architecture Specification

## Status

**Approved design; implementation has not started.**

This specification supersedes the original Workspace Insights design and the obsolete implementation plan that were committed earlier on `feature/workspace-insights`.

The design was audited against the current Markdown Explorer renderer, parser, host-message model, settings import/export path, runtime constraints, and Greptile feedback on PR #44. In particular:

- Insights adds a metadata-only workspace resource probe instead of abusing binary export reads for existence checks.
- External link checks are host-backed and return real HTTP/network status. Browser `no-cors` opaque responses are not used for reachability classification.
- Insights uses a dedicated full workspace scan rather than the existing capped file list/search inventory.
- Structural Markdown analysis reuses the renderer parser/source-mapping model and the renderer's actual heading slug logic.
- Wiki Links and embeds are first-class renderer/navigation features, not an Insights-only syntax.

## Goals

Deliver six workspace-wide tools from one shared local index:

1. **Image and Media Gallery** — browse every image, diagram, video, audio, and supported embedded document referenced by Markdown/MDX in the workspace.
2. **Broken-Link Inspector** — report missing local files, invalid anchors, ambiguous Wiki Links, missing local resources, dynamic/uncheckable references, and explicitly checked external-link failures.
3. **Markdown Linter Panel** — report conservative structural/style diagnostics with configurable rule enablement and severity.
4. **Duplicate Content Finder** — find normalized exact duplicates, repeated sections/passages, and near-identical notes without an O(n²) workspace comparison.
5. **Backlinks and Knowledge Graph** — show inbound references and a focused, deterministic graph of explicit links/embeds with optional inferred relationships.
6. **Document Relationships Panel** — rank related documents with explainable, deterministic signals.

The same work also adds first-class Wiki Link navigation and transclusion because Insights must not invent a link language that the renderer itself does not understand.

## Constraints and principles

- Shared behavior lives in the shared React/TypeScript UI and shared Markdown analysis modules. Runtime hosts provide filesystem/network capabilities, not competing analysis implementations.
- Offline-first: opening a workspace, opening Insights, refreshing local analysis, rendering local embeds, and building relationships do not contact external URLs.
- External HTTP(S) checking is disabled by default and requires both an enabled setting and an explicit user action.
- No telemetry, cloud embedding service, cloud similarity service, or remote content analysis is introduced.
- Parse each document once per source revision and derive all six tools from one incremental index.
- No silent caps. Any runtime safety ceiling or incomplete scan is surfaced as a warning/truncated state with counts/reasons.
- One unreadable, oversized, unsupported, or transiently failed file must not prevent the rest of the workspace from completing.
- User-visible Insights strings and settings are localized in every supported locale.
- Diagnostics do not rewrite source in v1.

## Information architecture

### Entry point

Add **Workspace Insights** as a sidebar discovery action. Activating it opens a **dedicated resizable Workspace Insights panel** in the main workspace area rather than forcing six tools into the narrow sidebar.

The panel contains six views:

- Gallery
- Links
- Lint
- Duplicates
- Graph
- Related

The sidebar remains the navigation/discovery surface. The wider Insights panel owns filtering, tables, graph visualization, detailed evidence, settings, progress, cancellation, and exports.

### Lazy activation

Insights is lazy:

- ordinary workspace open does not restore the Insights cache, enumerate the full Insights workspace, or start the Insights worker;
- the first Insights open restores/validates cache and starts scanning;
- switching among Insights views reuses the same live index;
- closing the panel pauses/cancels expensive analysis while retaining completed state and minimal staleness tracking for the active workspace;
- switching workspaces serializes eligible derived cache for the old workspace and tears down its worker/watch state.

Only the **active workspace** has a live Insights worker/index/watch session. Inactive workspace derived state is cached locally.

## Architecture

### Responsibilities

**Runtime host**

- recursively enumerate workspace entries for Insights;
- canonicalize paths and enforce workspace/symlink boundaries;
- read Markdown/MDX source with explicit size limits;
- probe local resources using metadata only;
- expose filesystem deltas where reliable;
- provide metadata polling fallback where direct watching is unavailable;
- perform external HTTP(S) checks with real status, DNS/IP validation, timeouts, redirects, and cancellation;
- reuse the existing document conversion/preview pipeline for supported non-Markdown embeds.

**Dedicated Insights Web Worker**

- parse Markdown/MDX using the shared parser semantics;
- extract links, Wiki Links, static HTML/MDX references, media, tags, headings, sections, and metadata;
- maintain inverted indexes and incremental derived state;
- lint documents;
- compute duplicate signatures/candidates;
- build backlinks and graph edges;
- score relationships;
- emit batched partial results.

**React UI**

- panel navigation and filters;
- progress/provisional/completeness states;
- source navigation;
- settings and suppressions;
- graph/list interaction;
- explicit external-link check controls and private-origin confirmation;
- report export;
- worker lifecycle and host request coordination.

If Web Workers are unavailable, analysis falls back to cooperative chunked work on the UI runtime. The UI must display a **degraded performance** state; it must not pretend the worker is active.

### Shared Markdown semantics

Structural meaning comes from the existing Markdown parser/source mapping used by rendering: headings, Setext/ATX forms, lists, tables, fences, frontmatter boundaries, source ranges, and nested Markdown must not be independently reinterpreted by a regex-only Insights parser.

A focused secondary extractor is allowed only for semantics not exposed by the parser, such as Wiki Link tokens, standard link destinations, static HTML/MDX `href`/`src` attributes, inline tags, and related metadata. Extraction must respect parser ranges so code/fences and other non-prose contexts are excluded correctly.

Heading anchor generation calls the same shared `slugify()` behavior used by `HtmlRenderer`, including duplicate suffixes (`base`, `base-1`, `base-2`, ...). Insights must not implement a different GitHub-style approximation.

## Host capability contracts

Names below describe the required contract; final message/type names may follow existing repository conventions.

### 1. Dedicated Insights workspace scan

`scanInsightsWorkspace` is separate from the existing workspace `fileList`/search scan and has no silent 1000-file-style cap.

Input includes:

- workspace operation/request ID;
- user include/exclude rules;
- built-in exclusion profile version;
- cancellation token/request identity.

The host recursively streams batches of metadata first:

```ts
interface InsightsWorkspaceEntry {
  relativePath: string;
  canonicalRelativePath: string;
  kind: 'file' | 'directory';
  sizeBytes: number;
  mtimeMs: number;
  extension?: string;
  isSymlink?: boolean;
}
```

The scan also reports progress, excluded/skipped counts, and completion metadata. If a runtime must stop at an absolute safety boundary, the response is explicitly `truncated: true` with a reason and count; it is never presented as complete.

### 2. Insights source read

`readInsightsDocumentSource` reads a specific eligible Markdown/MDX file after metadata filtering.

Result categories:

- `ok`
- `missing`
- `outside-workspace`
- `unreadable`
- `unsupported`
- `too-large`

The default soft analysis limit is **10 MiB per Markdown/MDX file**. Users can override the soft limit for specific files or gitignore-style path patterns. An absolute **64 MiB per-source safety ceiling** is not overridable in v1.

The derived persistent cache never stores the full returned source body.

### 3. Metadata-only workspace resource probe

Add a generic `probeWorkspaceResource({ documentPath, resourcePath })` capability for any workspace-local referenced file.

Representative result:

```ts
interface WorkspaceResourceProbeResult {
  status: 'exists' | 'missing' | 'outside-workspace' | 'unreadable' | 'unsupported';
  relativePath?: string;
  kind?: 'file' | 'directory';
  sizeBytes?: number;
  mimeType?: string;
}
```

This operation performs canonical path resolution and metadata/stat work only. It **must not read file bytes, base64-encode content, or call `readWorkspaceExportResource` internally**.

Binary reads remain a separate, explicit operation used only when the user actually requests a preview/export that needs bytes.

### 4. Incremental filesystem deltas

Where a runtime has a reliable filesystem watcher, expose batched Insights deltas for:

- add
- update
- delete
- rename/move hint when the platform supplies one

Deleted files are removed from the live index immediately. Surviving inbound references become broken-link findings.

Rename/move identity is best-effort. High-confidence correlation may use native rename events plus prior path, content fingerprint, size, and mtime. High-confidence renames migrate derived cache entries, duplicate/lint suppressions, and per-file overrides. Low-confidence cases are treated as delete + add rather than attaching state to the wrong file.

### 5. Browser capability and polling fallback

If a browser-backed runtime lacks a reliable observer, use lightweight metadata polling only while Insights is active/visible. Polling stops when Insights is inactive. The UI labels this as polling, not real-time watching.

Every runtime exposes **Refresh** regardless of watcher support.

### 6. Active unsaved document overlay

Disk content is the source of truth for all non-active documents. The active Markdown/MDX document may overlay the indexed disk source with the unsaved source already supplied to rendering, together with a monotonic source revision/version.

The overlay affects the full derived index:

- outbound links and backlinks;
- graph and embed edges;
- broken links;
- Gallery and lint;
- duplicate signatures;
- relationship indexes/scores.

Save collapses the overlay into persistent disk state. Revert/close removes it. Only the active document needs unsaved overlay support in v1.

### 7. Host-backed external HTTP checking

External checking is a host capability, not `fetch(..., { mode: 'no-cors' })` in the UI. A runtime that cannot obtain reliable status while enforcing the network-safety contract returns `unsupported` instead of guessing.

The checker accepts a batch/request ID and streams per-URL results so progress/cancellation can be reflected immediately.

## Workspace scanning and exclusions

### Exclusion sources

The effective matcher uses gitignore-style syntax everywhere: initial scan, watcher reconciliation, polling, manual Refresh, and oversized overrides.

**Hard safety exclusions** cannot be overridden. They are intentionally minimal:

- VCS internals such as `.git/`;
- Markdown Explorer runtime/cache/internal storage paths;
- runtime-internal paths that must not be traversed for correctness/safety.

**Built-in default exclusions** are overridable and cover common high-volume generated/dependency directories such as `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`, common cache directories, and vendor output.

Then apply repository `.gitignore` rules.

Finally apply user Insights rules **in user-defined order with gitignore last-match-wins semantics**. User negation/re-include rules may override `.gitignore` and built-in defaults but can never override hard safety exclusions.

Invalid user patterns are rejected at settings-save/import normalization with a visible validation message rather than being silently ignored.

The UI reports excluded/skipped counts and, where practical, the effective rule/source that caused a path to be excluded.

## Index lifecycle and persistence

### Initial indexing

On first Insights open:

1. derive/resolve the app-local workspace identity;
2. restore compatible derived cache if present;
3. enumerate the dedicated Insights workspace metadata stream;
4. compare metadata with cached entries;
5. load eligible changed/uncached Markdown/MDX source in bounded batches;
6. send source/revision batches to the worker;
7. stream partial results into the six views;
8. establish watcher or visible-only polling after scan reconciliation.

Results are **provisional** while indexing is incomplete. Per-document Gallery/Lint data may appear immediately. Workspace-wide duplicates, graph, backlinks, and relationships update incrementally but remain marked `still indexing` until every eligible file was attempted.

A completed index may contain warnings. Completion means every eligible file was attempted; unreadable, oversized, unsupported, or failed documents remain visible with a reason and affected views warn that results may be incomplete.

### Refresh

Manual **Refresh** is intentionally stronger than ordinary reopen validation:

- re-enumerate eligible documents;
- hash every eligible Markdown/MDX source;
- reparse only content whose fingerprint changed or whose analyzer/cache component is incompatible;
- reconcile add/delete/rename/exclusion/size-override changes;
- re-probe affected local resources as necessary;
- rebuild only affected derived indexes.

Refresh performs **zero external HTTP requests**. External checks have their own explicit Check/Recheck actions.

### Normal reopen validation

Ordinary cache restore compares canonical path, size, and mtime first. Entries that appear changed/suspicious are fingerprinted; unchanged content is reused. Metadata-only reuse is an optimization, not the source of truth.

### Persistent cache

The cache is app-local and never written into the repository/workspace.

Persistent cache may contain:

- workspace identity/path history;
- file identity, canonical relative path, size, mtime, content fingerprint;
- headings, tags, link targets, anchors, media metadata;
- duplicate fingerprints/signatures;
- hashed terminology/signatures used for candidate generation;
- graph/index metadata;
- analyzer/cache component versions.

It must not contain:

- full Markdown/MDX bodies;
- binary media bodies;
- remote response bodies;
- cookies, Authorization headers, credentials;
- private-origin confirmations;
- external-check session cache;
- readable significant terminology solely for similarity ranking.

Readable filenames/headings/tags/titles may be cached where required for restored UI. Human-readable relationship terminology is reconstructed from source on demand when an explanation is expanded.

### Cache versioning

Store a cache schema version plus component versions for parser/resolver, lint, duplicate signatures, relationships, and other derived models. Invalidate/rebuild incompatible portions while reusing compatible entries. If safe compatibility cannot be determined, discard the affected workspace cache.

### Cache capacity and eviction

Default global cache cap: **500 MiB**, user-configurable subject to runtime storage quota.

Eviction is hybrid:

1. remove least-recently-used per-file derived entries from inactive workspaces;
2. retain lightweight workspace metadata where useful for validation;
3. if still over cap, evict entire inactive workspace caches by LRU.

Never evict the active workspace live index mid-session. Cache eviction never deletes Insights user settings/suppressions.

Expose cache usage and **Clear Insights cache** globally and per workspace.

### Workspace identity

Per-workspace settings/cache use an app-local generated identity plus known canonical path history. A bounded fingerprint of stable workspace characteristics is used for best-effort move/rename recognition. High-confidence recognition migrates path history/cache/settings; uncertain matches become a new workspace. No identity file is written into the repository.

## Wiki Links

Wiki Links are part of the shared renderer/navigation/resolver contract.

### Syntax

Supported links:

- `[[Note]]`
- `[[Note#Heading]]`
- `[[Note|Label]]`
- `[[Note#Heading|Label]]`
- `[[#Heading]]` for a same-document fragment
- relative path forms such as `[[./Local]]` and `[[../shared/Guide]]`

Supported embeds:

- `![[Note]]`
- `![[Note#Heading]]`
- `![[image.png]]`
- other supported local media/document targets.

Wiki Link escaping uses backslash only:

- `\#` literal `#`
- `\|` literal `|`
- `\\` literal backslash

The parser splits at the first unescaped `|` for label and first unescaped `#` for fragment. Percent encoding is not a second Wiki Link escaping system.

Both `/` and `\` are accepted as Wiki Link path separators and normalized internally to `/`. Original source text is preserved.

Malformed Wiki Link syntax renders as plain text and produces a warning diagnostic. No graph/backlink/embed edge is created for malformed syntax.

### Resolution

Matching uses Unicode normalization plus locale-independent case-insensitive matching while preserving original/canonical casing for display.

Canonical document title precedence:

1. YAML frontmatter `title`;
2. first rendered H1;
3. filename stem.

Resolver keys include:

- explicit/relative workspace path;
- filename/stem;
- canonical document title;
- YAML frontmatter `aliases`.

YAML aliases support scalar/list forms normalized to strings. YAML is the only frontmatter format interpreted in v1.

Path-qualified targets take precedence over bare-name title/alias search. Bare-name resolution gathers viable filename/title/alias candidates. If more than one viable target remains, the result is **ambiguous** and the UI presents candidates; no target is silently guessed.

Extensionless Wiki Link paths try `.md` and `.mdx`. If both remain viable, resolution is ambiguous. An explicit extension is authoritative.

Relative paths resolve from the source document directory. Canonical resolution must remain inside the workspace after symlink resolution.

`[[#Heading]]` resolves within the source document. Inside transcluded content, “source document” means the embedded document, not the parent container.

Canonical filesystem casing is displayed for resolved paths. A case-only source mismatch remains valid but produces an `info` portability diagnostic.

Wiki Link source is never rewritten automatically after file rename/move.

### Directory targets

A Markdown or Wiki Link that targets a directory is valid only when the directory contains exactly one unambiguous recognized index document among:

- `README.md`
- `README.mdx`
- `index.md`
- `index.mdx`

Matching is case-insensitive under the same normalization rules. Multiple viable index candidates produce an ambiguous target. A directory without one is unresolved.

### Transclusion

Wiki embeds are full transclusion, not an Insights-only preview.

For Markdown/MDX embeds:

- render the embedded document/section using the normal renderer;
- preserve embedded source-document identity and source mapping;
- resolve nested links relative to the embedded source document;
- keep links, headings, tables, callouts, code, Mermaid, media, and supported controls interactive;
- cap recursive transclusion depth at **5**;
- detect cycles independently of depth and render an explicit cycle placeholder;
- render ambiguity/missing/depth/preview failures as non-fatal placeholders.

Graph/backlink semantics distinguish normal links from embed/transclusion edges. Duplicate detection operates on source documents only; rendered transcluded content is never counted as copied source.

For supported non-Markdown local documents (for example PDF/DOCX/XLSX/PPTX/HTML/RTF where the application already supports preview/conversion), reuse the existing preview pipeline. Unsupported binaries fall back to attachment cards.

Remote media/content is never automatically downloaded by transclusion. Remote preview remains a separate explicit user action.

## Standard Markdown, HTML, and MDX references

### Normal Markdown links

Normal Markdown links preserve standard path semantics. `[Guide](Guide)` checks the literal local target `Guide`; it does not implicitly try `Guide.md`/`.mdx`.

For local links, query strings are excluded from filesystem resolution but preserved as link metadata. Fragments are validated separately.

Normal URL fragments are percent-decoded before anchor comparison. Invalid percent encoding produces a malformed-link diagnostic rather than a guessed resolution.

### Anchors

Valid local anchors are:

- renderer-generated Markdown heading IDs using the exact shared slug/duplicate algorithm;
- literal static HTML/MDX `id="..."` anchors;
- legacy literal `<a name="...">` anchors.

Dynamic `id={expression}` is not evaluated and is classified as dynamic/unresolved.

### Static HTML/MDX references

Analyze literal link/media attributes such as:

- `href`
- `src`
- `poster`
- `<source src>`

Dynamic expressions such as `href={buildUrl()}` or `src={assetPath}` are never evaluated. They appear in Links as **dynamic / not statically checkable**, are excluded from broken counts, and preserve source location/expression evidence.

### Inline tags

Recognize `#tag` only in Markdown-aware prose/list contexts. Exclude fenced code, inline code, URLs, link destinations, HTML attributes, and anchor fragments. Support nested forms such as `#project/backend` plus YAML frontmatter `tags`.

Matching is normalized case-insensitively while original spelling is preserved for display.

## Local link/resource policy

Symlinks are followed only when their canonical target remains inside the current workspace. Canonical targets are deduplicated and cycles are prevented. Display uses the workspace-relative path users recognize.

`file:` URLs are validated only when canonicalized inside the current workspace. Outside-workspace targets are classified **outside workspace**, never opened automatically, and are not treated as generic broken files.

Non-HTTP schemes such as `mailto:`, `tel:`, `data:`, `vscode:`, and custom schemes are visible as **valid/non-checkable** inventory entries and excluded from broken counts. Malformed URI syntax may still produce a lint diagnostic.

## Gallery

Gallery is **referenced-media only**. It does not become a general filesystem asset browser.

Sources include:

- Markdown image/media references;
- Wiki embeds;
- static HTML/MDX media attributes;
- Mermaid blocks and supported diagram sources;
- supported embedded local documents.

Categories:

- `image` — PNG/JPEG/GIF/WebP/SVG by default;
- `diagram` — Mermaid and explicitly supported diagram formats;
- `video`;
- `audio`;
- `document`.

SVG defaults to image unless a renderer explicitly treats the source as a diagram format.

Local entries use metadata probes for existence. Binary bytes are loaded only for an explicit preview that requires them.

Remote entries show URL/metadata/placeholder and are never auto-loaded. **Load Preview** is a separate explicit network action from **Open externally** and is not implicitly enabled by external-link checking.

Invalid Mermaid remains visible as a failed diagram entry with source range/error summary. Mermaid render/syntax failure produces a lint diagnostic with default severity `warning`.

## Broken-Link Inspector

Local statuses include at least:

- valid
- missing
- invalid anchor
- ambiguous
- outside workspace
- unreadable
- dynamic / unchecked
- unsupported
- non-checkable scheme

Ambiguous is not collapsed into missing. Dynamic/uncheckable is not counted as broken.

The view retains original source text, canonical resolved target where available, source file/range, and reason.

## External HTTP(S) checking

### User control

Setting: **Check external links** — default **OFF**.

Required localized description:

> Verify HTTP(S) links from your Markdown files when requested. Checks are anonymous and do not send cookies or authorization credentials. Private-network destinations require confirmation. Some sites may block automated requests, require authentication, rate-limit checks, or return transient errors, so results can be reachable, broken, unreachable, or unknown. External links are never contacted when this setting is disabled.

When disabled:

- zero external checker requests are issued;
- URLs remain listed;
- status is `unchecked`;
- check actions are hidden/disabled.

### Scope

**Check external links** supports:

- current filtered/selected scope (default when such scope exists);
- explicit **Check entire workspace**.

The UI shows the number of unique URLs that will be contacted. Duplicate URLs are checked once and shared across references.

### Anonymous requests

Never send application/session cookies, Authorization headers, or user credentials. System proxy/network stack may be used. `401`/`403` are valid reachability results indicating authentication/authorization is required.

### Method

1. try `HEAD`;
2. if method-related/inconclusive (for example `405`, `501`, or equivalent host-detected HEAD incompatibility), issue a streaming `GET`;
3. inspect status/headers and abort body transfer immediately.

Do not download response bodies for reachability checking.

### Status semantics

- `2xx`, successful redirect chain -> `reachable`
- `401`, `403` -> `reachable/auth-required`
- `404`, `410` -> `broken`
- `429` -> `rate-limited/unknown`
- `5xx` -> `server-error/retryable`, not immediately `broken`
- DNS failure, refused connection, timeout, TLS validation failure -> `unreachable`
- private-not-confirmed, blocked, unsupported -> `unchecked/unknown`

TLS verification is never disabled.

### SSRF/private-network policy

Resolve DNS before connecting and classify all resolved addresses. Private classes include localhost/loopback, link-local, RFC1918/private ranges, and equivalent IPv6 ranges.

Connect only to an IP that passed policy validation while preserving the original hostname for TLS SNI/Host semantics. Re-resolve and revalidate every redirect target. This prevents DNS rebinding from validating one address and connecting to another.

A public URL redirecting to a private target requires confirmation.

Private confirmation is scoped to **scheme + host + port (origin)** for the **current active workspace session only**. A redirect to another private origin requires a new confirmation. Approvals are discarded on workspace deactivation/close and are never persisted/exported.

### Redirects and transport

- maximum redirects: **5**;
- redirect-limit exhaustion -> `unknown / redirect limit exceeded`;
- HTTPS -> HTTP downgrade may be followed but adds an **insecure downgrade** warning separate from reachability status;
- TLS certificate failures -> `unreachable`;
- every hop repeats DNS/IP/private validation.

### Concurrency, timeout, retry

- global concurrency: **4**;
- per-origin concurrency: **2**;
- default timeout: **10 seconds per attempt**;
- configurable timeout range: **3–30 seconds**, global default with per-workspace override;
- at most **one retry** after the initial attempt;
- retry only transient network failures and retryable `5xx`;
- use exponential backoff;
- honor `Retry-After`;
- do not retry `404`, `410`, `401`, `403`, or explicit cancellation;
- `429` stays rate-limited/unknown and must not trigger aggressive retries.

### Session cache and cancellation

Results are cached only for the active workspace session with status, code/category, final URL, and timestamp. The UI shows checked age. Explicit **Recheck** bypasses the session cache.

Closing Insights, switching workspace, or pressing Cancel aborts both queued and in-flight checks. Canceled URLs revert to their previous session result or `unchecked`; cancellation is never classified as unreachable/broken.

Manual local **Refresh** never rechecks external URLs.

## Markdown linter

The linter is diagnostics-only in v1: finding, severity, explanation, source range, navigation. No auto-format, quick-fix, or source rewrite.

Each rule supports enable/disable and severity (`info`, `warning`, `error`) where severity is meaningful. Configuration follows global defaults plus per-workspace overrides and reset.

Conservative initial rules include:

| Rule | Default | Behavior |
| --- | --- | --- |
| `frontmatter/malformed` | error | YAML frontmatter cannot be parsed; body analysis continues |
| `frontmatter/duplicate-key` | error | duplicated key is ignored rather than first/last-wins |
| `frontmatter/invalid-insights-metadata` | warning | invalid `title`/`aliases`/`tags` shape |
| `heading/duplicate` | warning | repeated normalized heading; renderer suffix behavior still works |
| `heading/skipped-level` | warning | structural heading jump |
| `table/malformed-delimiter` | error | table-like header has invalid delimiter row |
| `table/column-count` | warning | inconsistent table structure |
| `list/inconsistent-marker` | warning | sibling list marker inconsistency |
| `list/inconsistent-indent` | warning | inconsistent nesting indentation |
| `format/trailing-whitespace` | info | avoidable line-end whitespace |
| `wiki/malformed` | warning | malformed Wiki Link/embed rendered as plain text |
| `link/case-mismatch` | info | resolved local path differs only by casing |
| `link/malformed-uri` | warning | invalid URI/percent-encoding syntax |
| `mermaid/render-failure` | warning | Mermaid parse/render failure |

Malformed YAML does **not** remove the document from Insights. Ignore unusable metadata fields and continue body analysis.

Duplicate YAML keys are errors. The duplicated field is ignored; unrelated valid frontmatter fields and body analysis continue.

### Lint suppressions

App-local suppressions support:

- one finding;
- one rule for one file;
- one rule for a path/glob pattern;
- one rule for an entire workspace.

Suppressions are visible, reversible, included in settings export/import, and never inserted into Markdown source. Suppressed findings remain internally detectable and can be shown with **Show suppressed**.

High-confidence rename detection migrates applicable per-file suppressions.

## Duplicate Content Finder

Analysis always uses source documents, never rendered transcluded output.

### Exact duplicates

Exact duplicate normalization:

- strip UTF-8 BOM;
- normalize CRLF/CR to LF;
- remove trailing whitespace per line;
- normalize final newline handling;
- preserve all other Markdown/frontmatter content.

Hash normalized content and group equal hashes.

### Repeated sections/passages

Use two candidate systems:

1. heading-delimited normalized section fingerprints;
2. bounded sliding-window fingerprints for substantial unheaded/cross-heading passages.

Ignore trivial/common boilerplate and tiny fragments. Default implementation constants should be conservative: heading/passages need meaningful content (approximately >=100 normalized characters and >=20 meaningful tokens); sliding windows should be bounded (for example ~120 normalized tokens with ~50% stride) and are candidate generators, not an instruction to compare every window with every other window.

### Near duplicates

Default threshold: **90% similarity**, configurable globally/per workspace with a bounded conservative range.

Require a minimum meaningful document size before near-duplicate analysis. Generate candidates from fingerprints/buckets/inverted term evidence first, then run exact similarity only on candidates. Never perform full all-pairs O(n²) comparison.

Exact duplicates are independent of the near-duplicate threshold.

### Suppression

Users may suppress a noisy duplicate group/pattern. Suppressions are reversible/visible and affect presentation only; they never modify documents or relationship indexes.

## Backlinks and focused Knowledge Graph

### Graph model

Primary nodes: Markdown/MDX documents.

Primary directed edges:

- resolved explicit Markdown/HTML/Wiki document links;
- resolved embed/transclusion edges, visually/type-distinct from normal links.

Optional secondary layers:

- tags;
- significant headings.

Inferred relationship edges are **off by default** and shown only through an explicit toggle. They must be visually/type-distinct from explicit links.

Local same-document fragment links do not create document-to-document graph edges.

### Focused rendering

Do not render a full workspace force graph in v1.

Default graph is a focused neighborhood centered on the active/selected document:

- direct explicit neighbors on the inner ring;
- secondary neighbors on outer rings;
- optional tag/heading nodes in dedicated outer bands;
- backlinks/outbound direction markers;
- embed edges visually distinct;
- deterministic radial placement for the same graph state.

Default visible-node cap: **100**, configurable (bounded to a practical range). Strongest/relevant neighbors are selected first; explicit link relationships rank ahead of optional inferred edges. When truncated, show how many nodes are hidden. Search/recenter can bring an omitted document into focus without increasing the cap.

### Accessibility

Every visible graph node/edge is mirrored in a synchronized, keyboard-navigable structured list. Graph and list selection/focus remain synchronized. Edge type/direction is available in text and never depends on color alone.

## Document Relationships

Use deterministic local candidate generation, not embeddings/cloud models and not all-pairs comparison.

Candidate inverted indexes include:

- explicit inbound/outbound links;
- tags;
- normalized headings;
- filename/title terms;
- significant terminology signatures.

Default scoring profile:

- direct/shared links: 35%
- shared tags: 20%
- shared headings: 15%
- filename/title overlap: 10%
- terminology overlap: 20%

Normalize final score to 0–100 and omit candidates with no meaningful signal.

Provide presets:

- Default
- Link-focused
- Tag-focused
- Terminology-focused
- Custom weights

Custom weights are normalized before scoring and persisted through the Insights settings model.

Every result exposes contributing signals. Show actual shared tags/headings/terms when requested. Readable significant terminology is kept only in the live index or reconstructed from source on demand; the persistent cache keeps hashed/signature terminology used for candidate generation.

## Settings model

Configuration precedence:

1. per-workspace override;
2. global user default;
3. built-in default.

Insights settings include at least:

- external-link checking enabled (default off);
- external timeout (default 10 s, 3–30 s);
- scan user patterns;
- 10 MiB soft source limit and per-file/pattern oversized overrides;
- duplicate threshold and suppressions;
- lint rule enable/severity and suppressions;
- relationship preset/custom weights;
- graph visible-node cap;
- cache capacity (global default 500 MiB).

Provide **Reset workspace overrides**.

Extend the existing settings JSON export/import schema to include Insights global defaults and per-workspace overrides keyed by app-local workspace identity. Import normalization validates sizes, patterns, severities, thresholds, and weights.

Private-network approvals, external session results, worker/cache bodies, and other transient state are never included in settings export.

## Reports

Insights can export analysis snapshots as both:

- **Markdown** — human-readable review/share format;
- **JSON** — structured automation/CI/tooling format.

Export scope supports:

- entire workspace;
- current filtered view;
- explicit selection.

Report metadata records scope, workspace identity/display path as appropriate, analyzer version, indexing completeness, skipped/warning counts, and whether results were provisional/incomplete.

External-link export includes summary fields only:

- original URL;
- status category;
- HTTP status code when available;
- final URL;
- checked timestamp;
- insecure downgrade flag where applicable.

Do not export private approvals, DNS resolution chains, credentials, cookies, Authorization, or remote response bodies.

## Performance model

- Dedicated workspace scan streams metadata in batches.
- Source reads are bounded and batched.
- One parse per document source revision.
- Worker messages are batched; avoid one message per token/finding.
- Incremental deltas update only the affected document and dependent inverted indexes/backlinks/relationships.
- Near duplicates and relationships use indexed candidate generation; no full O(n²) pairwise workspace pass.
- Graph rendering is bounded independently of full index size.
- Local resource existence checks use metadata probes, never binary reads.
- Inactive workspaces have no live worker/watch analysis.
- Browser polling occurs only while Insights is active/visible.

## Failure and cancellation semantics

### Indexing

Cancellation stops queued reads/worker jobs and leaves already completed derived state reusable. Closing the panel marks unfinished indexing resumable rather than complete.

Individual failures remain explicit entries/reasons. A workspace can finish **with warnings**.

### Deletion

Deleted documents are removed immediately from index/cache/graph/duplicate/relationship state. No tombstones or historical graph nodes are retained. Surviving references become broken links.

### Rename/move

High-confidence rename detection migrates internal state; source links are never rewritten automatically.

### Unsupported capabilities

A runtime that cannot reliably implement a capability reports `unsupported`/degraded status. Do not emulate HTTP status with opaque responses or emulate filesystem existence with binary reads.

## Security and privacy

- Workspace canonicalization occurs before reads/probes/navigation.
- Symlink targets outside workspace are rejected.
- Static analysis never evaluates MDX expressions or arbitrary user code.
- External checker never sends application authentication/session credentials.
- External checker validates DNS/IP at every hop and pins a validated destination address.
- Private-network access requires origin-scoped session confirmation.
- Remote media is never auto-loaded.
- Persistent cache stores derived data only and minimizes readable terminology.
- External/session/private state is non-persistent.
- No repository files are written for cache, settings, workspace identity, or suppressions.

## Localization

All new user-visible strings must be added to the existing typed translation catalog and every supported locale, including:

- Workspace Insights entry/panel/view names;
- statuses, errors, progress and provisional/completeness messages;
- external checker setting/confirmation/status text;
- settings labels/descriptions/reset actions;
- lint/duplicate suppression controls;
- graph accessibility labels;
- export labels/messages;
- Wiki Link ambiguity/missing/cycle/depth placeholders where renderer UI exposes text.

No English-only fallback strings should be introduced in shared user-facing components where the translation model already requires locale coverage.

## Testing strategy

### Shared parser/resolver tests

Cover:

- renderer-consistent headings/anchors including duplicate suffixes and Setext/ATX;
- static HTML anchors;
- standard Markdown local/query/fragment behavior;
- Wiki Link parser escaping, path separators, aliases/titles, relative paths, extension expansion, ambiguity, case folding, same-document fragments;
- directory index target behavior;
- malformed Wiki Links;
- transclusion cycle/depth/source-relative resolution;
- static HTML/MDX refs and dynamic-expression classification;
- Markdown-aware tags.

### Worker/index tests

Cover:

- initial batched index;
- active unsaved overlay replacement/removal;
- add/update/delete/rename deltas;
- backlinks/graph/embed edge maintenance;
- incremental candidate index maintenance;
- exact/repeated/near duplicate behavior;
- relationship presets/custom scoring/evidence;
- partial failure/completeness state;
- cancellation/resume.

### Host contract tests per runtime

Cover:

- dedicated scan is not constrained by legacy file-list caps;
- pattern precedence and canonical symlink boundaries;
- source size soft/hard limits;
- `probeWorkspaceResource` uses metadata only and does not read/base64 binaries;
- watcher or polling capability reporting;
- document conversion reuse for supported embeds.

### External checker security/behavior tests

Cover:

- real status categories (not opaque response behavior);
- HEAD -> bounded GET fallback;
- no Cookie/Authorization credentials;
- DNS public/private classification;
- IP pinning/rebinding defense;
- redirect revalidation/private confirmation;
- 5-redirect cap;
- HTTPS downgrade flag;
- TLS failure classification;
- 4-global/2-origin concurrency;
- timeout/retry/Retry-After behavior;
- cancellation of queued and in-flight requests;
- session cache/Recheck;
- unsupported runtime behavior.

### UI/settings/accessibility tests

Cover:

- lazy first-open startup;
- streamed provisional results/progress;
- dedicated resizable panel navigation;
- filtered/full external check scope;
- suppressions/show-suppressed;
- global/per-workspace settings precedence/reset;
- settings export/import normalization;
- cache clear/usage states;
- Markdown+JSON report scope/completeness metadata;
- graph/list keyboard synchronization and non-color edge semantics;
- all typed translation keys/locales.

## Acceptance criteria

1. Workspace Insights opens from the sidebar into a dedicated resizable panel with Gallery, Links, Lint, Duplicates, Graph, and Related views.
2. First open performs a dedicated full Insights scan with streamed progress and no silent workspace file cap.
3. The shared parser/renderer semantics are used for headings/anchors/structures; Insights does not maintain an incompatible structural Markdown parser.
4. Wiki Links and `![[...]]` embeds render/navigate through a shared resolver with explicit ambiguity, case-insensitive matching, YAML title/aliases, relative paths, `.md/.mdx` extensionless resolution, depth-5 transclusion, and cycle protection.
5. Gallery lists referenced media/documents only; missing local resources are metadata-probed without binary reads; remote media is never auto-loaded; invalid Mermaid remains visible and linted.
6. Broken Links correctly distinguishes missing, invalid-anchor, ambiguous, outside-workspace, dynamic/uncheckable, unsupported, and non-checkable references.
7. External checking is off by default, explicit, anonymous, host-backed with real status, SSRF protections, private-origin confirmation, redirect/IP revalidation, bounded GET fallback, cancellation, and session-only caching.
8. Lint diagnostics are configurable and suppressible without modifying source.
9. Duplicate detection distinguishes normalized exact duplicates, repeated sections/passages, and candidate-bucketed near duplicates with default 90% threshold and no full all-pairs workspace pass.
10. Backlinks and graph derive from the same resolved link/embed index. The graph is focused, deterministic radial, capped by default at 100 visible nodes, explicit-link-first, and paired with an accessible synchronized list.
11. Related documents use inverted candidate indexes, deterministic 0–100 scoring, presets/custom weights, and human-readable contributing evidence.
12. Active unsaved Markdown/MDX content overlays the disk index and updates all derived views incrementally.
13. Deletions remove state immediately; high-confidence renames migrate app-local state without rewriting Markdown source.
14. Derived cache is app-local, versioned, source-body-free, capped at 500 MiB by default, and uses hybrid eviction. Only the active workspace keeps live analysis state.
15. Manual Refresh hashes all eligible Markdown/MDX sources but makes zero external HTTP requests.
16. Settings export/import includes Insights global defaults and per-workspace overrides but excludes private/network session state.
17. Markdown and JSON report export support full workspace and filtered/selected scopes with explicit completeness metadata.
18. All new user-visible text is localized through the existing translation system.
19. Unit/integration/runtime tests cover parser/resolver, incremental index, cache, security-sensitive host contracts, external checker, UI accessibility, and settings/report behavior.

## Non-goals for this implementation

- cloud embeddings/AI similarity services;
- full-workspace force/WebGL graph mode;
- automatic source rewriting after rename;
- linter auto-fixes/formatting;
- executing dynamic MDX expressions for static analysis;
- automatic remote media loading;
- continuous external-link monitoring;
- persistent deleted-document/tombstone history;
- arbitrary filesystem access outside the active workspace;
- TOML/JSON frontmatter metadata interpretation;
- repository-local Insights cache/config files.
