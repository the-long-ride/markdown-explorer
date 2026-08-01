---
timestamp: '2026-08-01T22:54:00+07:00'
name: Find, Workspace Search, and Cross-Tab Search
topic: Find, Workspace Search, and Cross-Tab Search
document_type: specification
status: active
ui_spec: true
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- ui/src/components/Search/FindInFilePanel.tsx
- ui/src/components/Search/SearchOverlay.tsx
- ui/src/useAppSearchEffects.ts
- electron/search/search-index.js
- electron/search/search-worker-controller.js
- tauri/src/search/index.rs
- vscode/src/core/panelSearch.ts
- chromium-xtension/src/search-index.ts
test_scope:
- tests/unit/ui/components/search-overlay-render.test.tsx
- tests/unit/electron/search-index.test.ts
- tests/unit/electron/search-worker-controller.test.ts
- tests/unit/chromium/search-index.test.ts
runtime_scope:
- all
- electron
- tauri/vs-code/chromium/website
keywords:
- find, workspace search, and cross-tab search
---

# Find, Workspace Search, and Cross-Tab Search

## Feature intent

Define the three distinct search modes, indexing boundaries, Unicode behavior, correlation, streaming, truncation, result navigation, and accessibility.

## Capability contract

| Capability | Required behavior | User result |
|---|---|---|
| Find in document | Search eligible rendered DOM text and wrap navigation. | Immediate current-page lookup. |
| Workspace search | Search title/name/path and bounded Markdown/text contents. | Repository lookup. |
| Cross-tab search | Stream results from open desktop workspace indexes. | Multi-project lookup. |
| Scoped search | Apply `searchScopeFocus` independently from browsing scope. | Relevant folders only. |
| Result navigation | Open owning workspace/file and locate match ordinal. | Search leads to exact context. |

## Interaction and processing flow

```mermaid
flowchart LR
    A[User input or host event] --> B[Validate and normalize]
    B --> C[Update application state]
    C --> D[Render or dispatch host command]
    D --> E[Announce result or recover error]
```

### Index/search limits

| Rule | Value |
|---|---:|
| Workspace items | maximum 10,000 |
| Content indexing | skip file bodies above 2 MiB |
| Electron cross-tab result default max | 2,000 |
| Electron index-prime batch | 5 |
| UI result page | 100 |

Find-in-document excludes interactive chrome, scripts/styles, iframe, SVG/canvas, line numbers, and table toolbar text. Search responses must match the latest request ID.


## States and failure behavior

| State | Required presentation | Exit condition |
|---|---|---|
| Closed | No overlay/panel | Open |
| Querying | Latest request active | Results/error/cancel |
| Results | Count/list/selection | Navigate/refine |
| No results | Explicit empty state | Refine |
| Truncated/cancelled | Status shown | Refine/retry |

## Runtime behavior

| Runtime | Specification |
|---|---|
| All | Shared overlay/result UI and DOM find. |
| Electron | Worker-backed cross-tab search. |
| Tauri/VS Code/Chromium/Website | Runtime-specific workspace index/search implementation. |

## Non-functional requirements

- All actions remain keyboard reachable.
- A failed enhancement must not prevent the base document from rendering.
- Host-facing inputs are validated before filesystem, shell, or network access.


## Acceptance criteria

- [ ] The three search modes do not mix scopes/results.
- [ ] Stale request results are ignored.
- [ ] Search controls and results are keyboard navigable.
- [ ] Oversized files are metadata searchable without body indexing.
## UI reference implementation

The sample shows the interaction boundary, not a replacement for the React implementation.

```html
<section class="spec-find-workspace-search-and-cross-tab-search" aria-labelledby="find-workspace-search-and-cross-tab-search-title">
  <h2 id="find-workspace-search-and-cross-tab-search-title">Find, Workspace Search, and Cross-Tab Search</h2>
  <p data-status role="status" aria-live="polite">Ready</p>
  <button type="button" data-action>Search workspace</button>
</section>
```

```css
.spec-find-workspace-search-and-cross-tab-search {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius, 8px);
  background: var(--surface);
  color: var(--text);
}
.spec-find-workspace-search-and-cross-tab-search button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

```javascript
const root = document.querySelector('.spec-find-workspace-search-and-cross-tab-search');
const status = root.querySelector('[data-status]');
root.querySelector('[data-action]').addEventListener('click', () => {
  window.PlatformBridge.postMessage({ command: 'searchWorkspace', requestId: crypto.randomUUID(), query: 'architecture', items: [] });
  status.textContent = 'Request sent';
});
```
## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/components/Search/FindInFilePanel.tsx` | Active behavior or contract |
| Implementation | `ui/src/components/Search/SearchOverlay.tsx` | Active behavior or contract |
| Implementation | `ui/src/useAppSearchEffects.ts` | Active behavior or contract |
| Implementation | `electron/search/search-index.js` | Active behavior or contract |
| Implementation | `electron/search/search-worker-controller.js` | Active behavior or contract |
| Implementation | `tauri/src/search/index.rs` | Active behavior or contract |
| Implementation | `vscode/src/core/panelSearch.ts` | Active behavior or contract |
| Implementation | `chromium-xtension/src/search-index.ts` | Active behavior or contract |
| Verification | `tests/unit/ui/components/search-overlay-render.test.tsx` | Automated expectation |
| Verification | `tests/unit/electron/search-index.test.ts` | Automated expectation |
| Verification | `tests/unit/electron/search-worker-controller.test.ts` | Automated expectation |
| Verification | `tests/unit/chromium/search-index.test.ts` | Automated expectation |

---

[← HTML Preview and Standalone Browser Preview](10-html-preview-and-browser.md) · [Documentation index](../README.md) · [Settings, Preferences, and Import/Export →](12-settings-preferences-import-export.md)
