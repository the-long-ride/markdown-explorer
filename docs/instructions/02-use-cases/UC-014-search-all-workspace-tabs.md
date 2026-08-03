---
timestamp: '2026-08-03T12:01:00+07:00'
name: Search Across Workspace Tabs
topic: Use case UC-014
document_type: use-case
status: active
ui_spec: true
parent_docs:
- ../00-foundation/06-coverage-matrix.md
related_docs: []
source_scope:
- ui/src/hooks/useDesktopTabSearchSync.ts
- ui/src/useAppSearchEffects.ts
- ui/src/components/Search/SearchOverlay.tsx
- ui/src/components/Search/SearchOverlayWorkspaceList.tsx
- ui/src/components/Search/SearchOverlayResults.tsx
- ui/src/components/Search/SearchDocumentPreview.tsx
- ui/src/components/Search/useSearchOverlayResize.ts
- electron/search/search-worker-controller.js
- electron/search/search-worker.js
- electron/search/search-index.js
- tauri/src/search/worker.rs
test_scope:
- tests/node/search-ui-contracts.test.mjs
- tests/node/search-preview-host-contracts.test.mjs
- tests/node/search-preview-runtime.test.mjs
- tests/unit/electron/search-worker-controller.test.ts
- tests/unit/electron/search-worker.test.ts
- tests/unit/ui/components/search-overlay-render.test.tsx
- tests/unit/ui/components/search-overlay-interaction.test.tsx
- tests/node/search-case-runtime.test.mjs
runtime_scope:
- electron
- tauri
- other-hosts
keywords:
- UC-014
- search-all-workspace-tabs
---

# Search Across Workspace Tabs

## Purpose

Search all open desktop workspaces without loading every document into the UI, stream bounded results, and navigate to the owning tab/file.

| Property | Specification |
|---|---|
| Use-case ID | `UC-014` |
| Primary actor | User |
| Trigger | All-tabs search action or shortcut. |
| Preconditions | Desktop workspace tabs exist; at least one has indexable files. |
| Success result | A bounded modal groups results by workspace, previews selection, and opens the owning tab/file from the result arrow. |
| Scope exclusion | Dead code, unsupported runtime behavior, and speculative behavior |

## Real-world scenario

A user remembers a phrase but not which of five repositories contains it.

```mermaid
flowchart LR
    S1["1. Open all-tabs search"]
    S2["2. Type query"]
    S1 --> S2
    S3["3. Stream batches"]
    S2 --> S3
    S4["4. Apply limits"]
    S3 --> S4
    S5["5. Select result"]
    S4 --> S5
    S6["6. Navigate to match"]
    S5 --> S6
```

## Main success flow

| Step | User or event | System processing | Observable result |
|---:|---|---|---|
| 1 | Open all-tabs search | Load/prime workspace indexes and show the workspace/result/preview modal. | Workspaces remain filterable inside the modal. |
| 2 | Check/uncheck workspaces | Build the enabled tab-ID set; all are checked by default. | Only selected workspace indexes participate in later requests. |
| 3 | Type query or toggle case | Create request ID and dispatch query, `matchCase`, and enabled `tabIds`. | Worker search starts with the selected casing rule and workspace set. |
| 4 | Stream batches | Host returns result batches/status. | UI appends results without blocking. |
| 5 | Apply limits | Stop at configured cap and mark truncation. | User sees bounded complete status. |
| 6 | Select result row | Load/render the full file and scroll the preview to the chosen match. | The selected content is readable before navigation. |
| 7 | Toggle preview or resize columns | Show/hide preview or drag either separator. | Preview defaults on; open arrows move between preview header and rows. |
| 8 | Click open arrow | Activate the result tab/workspace, open the file, and locate the match. | Correct document/match appears. |

## Alternate and failure flows

| Condition | Required behavior | Recovery |
|---|---|---|
| Index not loaded | Request `loadWorkspaceSearchIndexes`. | Search resumes after loaded message. |
| Query changes | Cancel or obsolete worker request. | Old batches ignored. |
| Result tab closed | Do not reactivate deleted tab. | Show unavailable result. |
| Limit reached | Set `truncated`. | Refine query. |

## Validation and business rules

- Each result includes tab ID/label and canonical file identity.
- Every workspace has a themed inclusion checkbox; all are on by default. Disabled workspace tab IDs are excluded in the worker, not merely hidden after search.
- Case-insensitive search is default; **Match case** is forwarded to worker metadata and content matching.
- **Preview** defaults on and renders the full selected source at the matching position. Preview-on hides row arrows and exposes one preview-header arrow; preview-off restores tooltip row arrows.
- Workspace, results, and preview widths are resizable.
- Worker search default maximum is bounded; UI pagination is bounded.
- Index priming is incremental to avoid blocking startup.
- Closed tabs invalidate associated indexes/results.


## Protocol effects

| Contract | Direction | Purpose |
|---|---|---|
| `loadWorkspaceSearchIndexes` | UI → host | Load file lists/trees for tabs. |
| `indexWorkspaceSearchItems` | UI → host | Prime searchable items. |
| `searchAcrossWorkspaces` | UI → host | Run all-tabs search with optional `matchCase` and enabled `tabIds`. |
| `loadSearchPreview` | UI → host | Read an indexed selected file. |
| `searchPreviewResult` | Host → UI | Return full Markdown/text source for rendered preview. |
| `workspaceSearchIndexLoaded` | Host → UI | Return loaded tab indexes. |
| `crossTabSearchResults` | Host → UI | Stream results/status/cancel/truncation. |

## State and persistence

| State | Rule |
|---|---|
| `cross-tab request ID` | Latest worker query. |
| `tab search indexes` | Per-workspace searchable metadata/content. |
| `page size` | UI shows bounded pages. |

## Runtime-specific behavior

| Runtime | Rule |
|---|---|
| Electron | Search worker; default max 2000 results, prime batch 5, UI page 100. |
| Tauri | Parity search implementation where available. |
| Other hosts | Feature hidden or adapted when desktop workspace tabs are absent. |

## Accessibility, security, and performance

- Keep keyboard focus on the active control or newly opened content.
- Give modal, case toggle, preview, and open controls translated accessible names.
- Reject stale host responses whose operation or request ID no longer matches.


## Acceptance criteria

- [ ] Results identify their workspace tab.
- [ ] Changing query prevents old batches from appending.
- [ ] Selecting a row does not activate a tab and renders the full file at its match.
- [ ] Workspace checkboxes default on and unchecked tabs are absent from worker search.
- [ ] Preview-on shows the header arrow; preview-off shows tooltip arrows on rows.
- [ ] Clicking the visible arrow activates the right tab before file navigation.
- [ ] Column resizing and exact-case results remain consistent.
- [ ] Truncation/cancellation status is visible.
## UI reference implementation

The sample shows the interaction boundary, not a replacement for the React implementation.

```html
<section class="spec-search-across-workspace-tabs" aria-labelledby="search-across-workspace-tabs-title">
  <h2 id="search-across-workspace-tabs-title">Search Across Workspace Tabs</h2>
  <p data-status role="status" aria-live="polite">Ready</p>
  <button type="button" data-action>Load workspace indexes</button>
</section>
```

```css
.spec-search-across-workspace-tabs {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius, 8px);
  background: var(--surface);
  color: var(--text);
}
.spec-search-across-workspace-tabs button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

```javascript
const root = document.querySelector('.spec-search-across-workspace-tabs');
const status = root.querySelector('[data-status]');
root.querySelector('[data-action]').addEventListener('click', () => {
  window.PlatformBridge.postMessage({ command: 'loadWorkspaceSearchIndexes', tabs: [{ tabId: 'workspace-tab-1', workspacePath: '/project/docs' }] });
  status.textContent = 'Request sent';
});
```
## Source traceability

| Kind | Path | Purpose |
|---|---|---|
| Implementation | `ui/src/hooks/useDesktopTabSearchSync.ts` | Active behavior or contract |
| Implementation | `ui/src/useAppSearchEffects.ts` | Cross-tab result navigation and search jump state |
| Implementation | `ui/src/components/Search/SearchOverlay.tsx` | Checked-tab dispatch, preview mode, and modal orchestration |
| Implementation | `ui/src/components/Search/SearchOverlayWorkspaceList.tsx` | Per-workspace inclusion controls |
| Implementation | `ui/src/components/Search/SearchDocumentPreview.tsx` | Rendered source preview at selected match |
| Implementation | `ui/src/components/Search/useSearchOverlayResize.ts` | Workspace/result/preview column resizing |
| Implementation | `electron/search/search-worker-controller.js` | Active behavior or contract |
| Implementation | `electron/search/search-worker.js` | Active behavior or contract |
| Implementation | `electron/search/search-index.js` | Active behavior or contract |
| Implementation | `tauri/src/search/worker.rs` | Active behavior or contract |
| Verification | `tests/unit/electron/search-worker-controller.test.ts` | Automated expectation |
| Verification | `tests/unit/electron/search-worker.test.ts` | Automated expectation |
| Verification | `tests/node/search-ui-contracts.test.mjs` | Three-column, tooltip, checkbox, and preview contracts |
| Verification | `tests/unit/ui/components/search-overlay-interaction.test.tsx` | Checked-workspace dispatch and preview/open behavior |
| Verification | `tests/node/search-preview-host-contracts.test.mjs` | Host preview routing and checked-tab worker filtering |

---

[← Search the Current Workspace](UC-013-search-current-workspace.md) · [Documentation index](../README.md) · [Open Dropped and External Paths →](UC-015-drag-drop-external-open.md)
