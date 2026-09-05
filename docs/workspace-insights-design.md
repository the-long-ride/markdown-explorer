# Workspace Insights and Wiki Links — Architecture Specification

## Implementation status

Workspace Insights and Wiki Links are implemented on `feature/workspace-insights` and are under review in PR #44. This document describes the behavior that exists in the branch rather than a future-only design.

The implementation keeps Markdown semantics in shared TypeScript modules, keeps filesystem/network capabilities in runtime hosts, and keeps presentation/session orchestration in the shared React UI. The feature remains offline-first: local indexing, local refresh, transclusion, duplicate analysis, graph generation, and relationship scoring do not contact external URLs.

## Implemented scope

Workspace Insights exposes six workspace-wide views backed by one shared local index:

1. **Gallery** — referenced images, diagrams, video, audio, and supported embedded documents.
2. **Links** — missing files, invalid anchors, outside-workspace references, dynamic references, ambiguous Wiki Links, and explicitly checked external links.
3. **Lint** — conservative structural/style diagnostics with configurable severity and suppression settings.
4. **Duplicates** — exact, repeated-section/passage, and near-duplicate candidates without a full O(n²) workspace comparison.
5. **Graph** — backlinks and a bounded, deterministic focused knowledge graph.
6. **Related** — deterministic document relationships with explainable signals.

Wiki Links and Wiki transclusion are first-class renderer/navigation features shared with Insights rather than an Insights-only syntax.

## Runtime architecture

### Shared UI and analysis

Shared React/TypeScript code owns:

- Markdown/Wiki syntax and resolution;
- renderer-consistent heading anchors;
- source/reference extraction;
- lint, duplicate, graph, backlink, and relationship analysis;
- worker/client lifecycle and degraded fallback;
- workspace session orchestration;
- IndexedDB derived-cache persistence;
- settings, progress, filtering, reports, and presentation.

A dedicated Insights worker maintains the live index where Web Workers are available. Cooperative UI-thread fallback is used only when workers are unavailable and is surfaced as degraded performance.

### Runtime hosts

Electron, VS Code, Chromium/web, and Tauri hosts provide the capabilities that need platform access:

- recursive Insights workspace enumeration;
- canonical path and workspace-boundary enforcement;
- bounded Markdown/MDX source reads;
- metadata-only resource probes;
- watcher or polling change signals;
- supported document-preview reuse;
- host-backed external HTTP checks.

Hosts do not implement competing Markdown analysis engines.

## Workspace scan and source reads

Insights uses its own recursive workspace scan rather than the legacy capped workspace/search inventory. Any unavoidable runtime safety ceiling is reported as a truncated/incomplete result rather than silently presented as complete.

Markdown/MDX reads keep the 10 MiB default soft analysis limit and 64 MiB non-overridable per-source safety ceiling. Unreadable, unsupported, missing, outside-workspace, or oversized files are reported without aborting the rest of the workspace.

The UI limits source loading to **8 concurrent source reads per platform bridge**. The limiter is shared per bridge, starts work synchronously when a slot is free so request/listener ordering is preserved, and drains queued reads as earlier requests settle.

## Cache authority and privacy

The persistent cache is app-local and stores only persistence-safe derived analysis and metadata. Restored cache data is **provisional only**: a live Insights session rereads every eligible Markdown/MDX file before restored results are treated as authoritative. Metadata and derived values can accelerate presentation, but they do not replace source validation.

The cache does not persist:

- full Markdown/MDX source bodies;
- binary media bodies;
- external response bodies;
- cookies or authorization/session credentials;
- active unsaved source overlays;
- private-origin approvals;
- readable relationship-only terminology that is not otherwise required for presentation.

Cache compatibility is versioned by analyzer/schema inputs. Incompatible portions are invalidated rather than silently reused.

## Incremental change handling

Reliable filesystem watchers are used where the runtime provides them. Chromium/web falls back to lightweight metadata polling while Insights is active. The polling loop has an explicit in-flight guard, so **polls never overlap** even when a recursive snapshot takes longer than the polling interval. Polling stops when the session is inactive.

Every runtime exposes an explicit Refresh path. Refresh performs local reconciliation and does not implicitly run external HTTP checks.

## Wiki Links and navigation

Supported forms include:

- `[[Note]]`
- `[[Note#Heading]]`
- `[[Note|Label]]`
- `[[Note#Heading|Label]]`
- `[[#Heading]]`
- relative forms such as `[[./Local]]` and `[[../shared/Guide]]`
- embeds such as `![[Note]]`, `![[Note#Heading]]`, and supported local media/document targets.

Resolution uses normalized workspace paths, filenames/stems, frontmatter title/aliases, renderer-consistent heading anchors, and explicit ambiguity results. Extensionless Markdown targets may resolve to `.md` or `.mdx`; ambiguous candidates are not guessed.

Rendered Wiki-link clicks carry or inherit the source document path from the rendered Markdown root. This preserves the correct directory context for relative links.

Production mounts `WorkspaceNavigationProvider`, which lazily builds a workspace Wiki catalog from the active platform bridge and invalidates it when workspace inputs/settings change. The generic `NavigationProvider` remains platform-agnostic for consumers that inject their own resolver.

For a resolved `[[Document#Fragment]]` navigation, the provider starts fragment observation, navigates to the canonical destination, and scrolls **after the destination document renders**. The destination `#mdBody` must advertise the expected canonical source path before a fragment can be selected, preventing a same-ID heading in the previous document from being scrolled. Before scrolling, **collapsed parent sections are expanded** so the target is visible. Same-document fragment links avoid reopening the current document.

A later Wiki navigation supersedes any pending fragment observer; pending work is also cleaned up on provider unmount.

## External link checks

External HTTP(S) checking is disabled by default and requires an enabled setting plus explicit user action. It is host-backed so results are based on real status/network outcomes rather than browser opaque `no-cors` responses.

The checker follows the feature's existing safety contract: bounded concurrency and timeouts, redirect limits, cancellation, private-network validation, and no application cookies or authorization/session credentials.

## Localized presentation

Workspace Insights presentation is translated for all supported locales:

- `en`
- `vi`
- `fr`
- `es`
- `zh`
- `no`
- `ja`
- `ko`
- `ru`

The translated presentation domain includes **Gallery categories**, **link statuses**, **relationship presets**, **lint rule names**, and **severity labels**, in addition to panel/settings copy (sections, unit notes, search placeholders, graph navigation controls, and empty states). Typed translation contracts and localization-focused component tests prevent presentation code from falling back to embedded English domain labels.

## Performance characteristics

The implemented performance safeguards include:

- lazy Insights activation;
- one live workspace Insights session at a time;
- worker-backed indexing with cooperative fallback;
- one parse/analyze pass per source revision;
- 8-read bridge-level source concurrency;
- non-overlapping Chromium polling;
- incremental updates to affected documents/indexes;
- indexed candidate generation for duplicates and relationships instead of a full O(n²) comparison;
- bounded graph projection independent of full workspace size;
- metadata-only local resource probes rather than binary reads for existence checks.

## Failure and cancellation behavior

Individual file failures do not fail the workspace. Session generation/request identity prevents stale scan/source/worker work from becoming authoritative after a workspace/session change. Worker and host requests are cancelled or ignored when superseded. Unsupported runtime capabilities are surfaced rather than guessed.

## Verification

PR #44 includes unit and contract coverage for shared analysis, cache/session behavior, Wiki parsing/resolution/rendering/navigation, source-path propagation, fragment navigation, bridge concurrency, Chromium polling, localization, runtime host contracts, and cross-runtime builds.

The historical implementation checklist is retained at `docs/superpowers/plans/2026-08-27-workspace-insights-wiki-links.md` as a completion record. This document is the current architecture reference for the implemented feature.
