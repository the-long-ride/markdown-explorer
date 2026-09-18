# Features Settings UX and HTML External Resource Policy Design

**Date:** 2026-09-17  
**Status:** Approved design  
**Branch:** `feature/editor-git-history-split-view`  
**Target version:** `1.6.9`  
**PR:** #48

## 1. Goal

Improve **Settings > Features** so users can quickly scan, search, understand, and change feature preferences, and add an explicit policy controlling whether HTML previews may load external web resources such as JavaScript, CSS, fonts, images, media, CDN assets, and runtime network requests.

The feature must preserve Markdown Explorer's local-first security model while making external-resource behavior understandable and controllable.

## 2. Pre-implementation branch synchronization

Before production implementation begins:

1. Rebase `feature/editor-git-history-split-view` onto the latest `main`.
2. The current known `main` head at design time is `360e6efebb82570945cacf0dd6872d038ec70f16` (`v1.6.8`). Re-check `main` immediately before rebasing and use the then-latest head.
3. Resolve overlapping hot-fix changes instead of replacing them with the older PR versions.
4. Preserve the PR target version as **1.6.9** across root/runtime/package metadata.
5. Preserve all `v1.6.8` Workspace Insights/runtime capability, packaging, activation, and documentation fixes from `main`.
6. Run focused conflict-regression tests before feature implementation continues.

If `main` advances again during implementation, rebase once more before final verification.

## 3. Settings > Features UX

The current flat list is replaced by a searchable, grouped Features panel.

### 3.1 Header and search

The panel starts with:

- title: **Features**
- existing explanatory subtitle
- search field: **Search features...**

Search is case-insensitive and matches:

- setting title,
- visible description,
- group title,
- stable search keywords associated with the setting.

Groups with no matching rows are hidden while searching. If no setting matches, show a compact **No matching features** empty state.

Search is presentation-only; it never changes settings.

### 3.2 Groups

Use these groups and order:

#### Workspace

- Sidebar file labels
- Open files in tabs
- Bookmarks
- Workspace Insights

Runtime capability gates remain authoritative. A feature unavailable in the active runtime must remain hidden or disabled according to its existing runtime contract rather than being exposed merely because the search matches it.

#### Editing & History

- Markdown Explorer editing
- History sidebar

#### Document previews

- Read DOCX, PDF, Office, and text files
- Default HTML preview
- Default HTML code-block preview
- **External resources in HTML**
- Default CSV preview

#### Limits

- Maximum pinned items

### 3.3 Row presentation

Feature rows prioritize readability over hover discovery:

- title is always visible,
- concise description is always visible below the title,
- boolean toggles stay right-aligned,
- the boolean row has a generous click target and clicking the row toggles the value unless the click originated from another interactive control,
- keyboard focus remains visible,
- existing detailed tooltips may remain for supplemental information/shortcuts but are not required to understand the setting.

The panel must remain usable at current Settings modal widths and responsive layouts.

### 3.4 Component boundaries

Do not keep expanding `SettingsPreferencesPanel.tsx` into a large mixed-responsibility component.

Create focused units:

- `SettingsFeaturesPanel` — grouped/searchable Features section and filtering.
- `FeatureSettingsSearch` — search input and clear action.
- `FeatureSettingsGroup` — section heading and visible rows.
- `HtmlExternalResourcePolicyControl` — three-option segmented selector.

`SettingsPreferencesPanel` should route the `features` section into `SettingsFeaturesPanel` and continue owning Appearance/Typography/Theme routing.

## 4. External HTML resource policy

### 4.1 Settings type

Add:

```ts
export type ExternalHtmlResourcePolicy = 'always' | 'ask' | 'never';
```

Add to `AppSettings` and persisted settings:

```ts
externalHtmlResourcePolicy: ExternalHtmlResourcePolicy;
```

Default and migration value:

```ts
'ask'
```

Older saved settings without this field normalize to `ask`.

The value participates in:

- app-state defaults,
- normalization,
- persistence,
- Settings import/export,
- runtime settings synchronization where applicable,
- all nine supported locales.

### 4.2 User-facing control

Label:

**External resources in HTML**

Description:

**Choose whether HTML previews may load external JavaScript, CSS, fonts, images, media, or CDN resources.**

Render a single rounded segmented control in the style approved from the supplied reference image, with three equal options:

1. **Always allow**
2. **Ask every time**
3. **Don't fetch**

The active option has a stronger surface/border treatment. The control supports pointer use, Tab focus, and Left/Right arrow navigation.

## 5. External resource detection

Add a pure HTML resource inspection module rather than mixing detection into React or host code.

Suggested module:

`ui/src/markdown/htmlExternalResources.ts`

### 5.1 Static resources to detect

Inspect HTML/CSS source before preview execution for external HTTP/HTTPS or protocol-relative references, including where practical:

- `<script src>`
- `<link href>` including stylesheets/preloads
- `<img src>` and `srcset`
- `<source src>` / `srcset`
- `<video src>` / `<audio src>` / `<track src>`
- `<iframe src>`
- `<object data>` / `<embed src>`
- CSS `@import`
- CSS `url(...)`
- other standard resource-bearing attributes already handled by the HTML preview pipeline

Relative paths, workspace-local paths, `blob:`, and safe in-document `data:` resources do not trigger the external-network prompt.

Privileged/non-web schemes such as `file:`, application protocols, or host-specific bridge schemes are never enabled by this setting.

### 5.2 Detection result

Expose a deterministic model such as:

```ts
interface ExternalHtmlResource {
  url: string;
  origin: string;
  host: string;
  kind: 'script' | 'style' | 'font' | 'image' | 'media' | 'frame' | 'other';
}

interface ExternalHtmlResourceScan {
  resources: readonly ExternalHtmlResource[];
  hosts: readonly string[];
  hasRuntimeNetworkCode: boolean;
}
```

Deduplicate URLs and hosts. Host display ordering is deterministic.

`hasRuntimeNetworkCode` indicates statically detectable use of APIs such as `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or `sendBeacon`. It is informational; JavaScript may still calculate new destinations dynamically after permission is granted.

## 6. Preview security policy

### 6.1 Existing baseline

Markdown Explorer currently injects a network guard into HTML preview documents and renders preview iframes with `sandbox="allow-scripts"`.

This sandbox boundary remains in every policy mode.

The external-resource policy must **not** add:

- `allow-same-origin`,
- filesystem access,
- Electron APIs,
- Tauri APIs,
- VS Code privileged bridge access,
- unrestricted host protocol access.

### 6.2 Blocked preview

For `ask` before approval and for `never` permanently, block external network loading through two layers:

1. Keep runtime JavaScript network APIs blocked (`fetch`, XHR, WebSocket, EventSource, sendBeacon, and equivalent supported guards).
2. Add a restrictive preview CSP/resource policy so declarative loads such as `<script src>`, `<link href>`, images, fonts, frames, and media cannot bypass the JavaScript guard.

Local/embedded content needed by the preview remains available according to existing preview behavior.

### 6.3 Allowed preview

For `always`, or after a one-session approval under `ask`:

- external HTTP/HTTPS resources may load,
- runtime HTTP/HTTPS and WS/WSS requests may run inside the sandboxed preview,
- the iframe sandbox itself remains unchanged,
- privileged schemes and host bridges remain blocked.

The network guard must therefore be generated from an explicit resolved preview permission rather than unconditionally injected.

## 7. Ask-every-time permission flow

### 7.1 Trigger

When policy is `ask` and external resources or statically detectable runtime network usage are present:

1. Do not fetch external resources before user approval.
2. Render or prepare the preview in blocked mode.
3. Open `HtmlExternalResourcesDialog` before enabling network access.

If no external resource/network usage is detected, render normally in blocked/local-first mode with no prompt.

### 7.2 Dialog content

Dialog title:

**External resources detected**

Message explains that the HTML wants to connect to the internet and that external content can change independently from the local file.

Display deduplicated external hosts, for example:

- `cdn.jsdelivr.net`
- `fonts.googleapis.com`
- `example.com`

If runtime network code is detected but no static destination is available, show a short note that the page contains code capable of making additional network requests after approval.

Actions:

- **Don't allow**
- **Allow**

Checkbox:

- **Save my option for later**
- visible/enabled only for the Allow path,
- never persists a denial.

### 7.3 Outcomes

#### Don't allow

- close the dialog,
- keep that preview in blocked/local-first mode,
- do not change global settings.

#### Allow

- close the dialog,
- rebuild/reload only that preview with external network permission,
- approval is session/preview-instance scoped.

Reopening the same HTML later prompts again while the global setting is still `ask`.

#### Allow + Save my option for later

- first update `externalHtmlResourcePolicy` to `always`,
- then reload the current preview with external access,
- future previews use the global `always` policy until the user changes it in Settings.

## 8. Historical/revision HTML

Historical Git snapshot HTML files use the same external-resource policy.

Revision browsing must not silently bypass the prompt simply because the content originates from Git history. Historical content remains read-only and has no additional host privileges.

## 9. Runtime behavior

The policy is a shared UI/preview contract and should behave consistently in Electron, Tauri, VS Code, Chromium extension, and website/browser preview paths to the extent each runtime supports interactive HTML preview.

Runtime CSP/webview restrictions remain authoritative. `always` means Markdown Explorer no longer intentionally blocks external resources inside the sandbox; it does not guarantee a runtime or remote server will permit every request.

No new privileged native download/fetch API is required for this design. External resources are loaded by the sandboxed preview environment when permission allows them.

## 10. Localization and accessibility

Add all new strings to the existing nine-locale localization system:

- Features search placeholder
- clear search
- group labels if not already localized
- no matching features
- external resource setting title/description
- three policy labels
- permission dialog title/body
- domain/network-code explanations
- Allow
- Don't allow
- Save my option for later

Accessibility requirements:

- search has an explicit accessible label,
- segmented control uses radiogroup/radio semantics or equivalent correct ARIA,
- arrow-key navigation works within the policy selector,
- setting descriptions are visible text and programmatically associated where practical,
- permission dialog traps focus and returns focus to the triggering preview/control,
- host/resource list is readable by screen readers,
- checkbox has an accessible label and is keyboard operable.

## 11. Error behavior

- Invalid persisted policy normalizes to `ask`.
- Resource scanner failure falls back to the safe blocked preview rather than enabling network access.
- If a user approves external access but a remote request fails, show the preview's normal failure behavior; do not silently switch policy.
- If saving `always` fails, the current session may still use the explicit one-time approval, but the UI must not claim the setting persisted.
- A denied prompt never prevents the local HTML body from rendering when it can render without external assets.

## 12. Testing strategy

### Settings UI

- Features groups render in the approved order.
- Search matches title, description, group, and configured keywords.
- Empty groups disappear while searching.
- No-results state renders correctly.
- Boolean rows retain existing runtime capability gates.
- Clicking a boolean row toggles exactly once.
- Visible descriptions render without hover.
- Three-state control supports mouse and keyboard selection.

### Persistence

- missing policy migrates to `ask`,
- invalid policy migrates to `ask`,
- `always`, `ask`, and `never` survive save/load,
- Settings import/export preserves the field,
- all runtime settings projections preserve the field where relevant.

### Resource scanning

- external script detection,
- external stylesheet detection,
- CSS `@import` and `url()` detection,
- external images/fonts/media detection,
- protocol-relative URL detection,
- URL/host deduplication,
- local relative resources do not trigger,
- data/blob resources do not trigger,
- privileged schemes remain blocked,
- runtime network API detection.

### Preview policy

- `never` performs zero external loads and blocks runtime network APIs,
- `ask` performs zero external loads before approval,
- one-time Allow rebuilds only the active preview and does not mutate settings,
- Don't allow keeps the preview blocked and never persists,
- Allow + Save my option for later changes the global policy to `always`,
- `always` omits the intentional network guard while retaining iframe sandboxing,
- historical HTML obeys the same policy,
- Electron/Tauri/VS Code/Chromium/Web adapters remain within their existing privilege boundaries.

### Regression

- existing HTML code-block preview tests,
- HTML preview modal/browser actions,
- local-first warning behavior,
- Settings import/export tests,
- runtime parity/contracts,
- localization contracts,
- full GitHub Actions matrix.

## 13. Documentation synchronization

Update active documentation/specs in the same PR to describe:

- searchable/grouped Features Settings UI,
- visible setting descriptions,
- external HTML resource policy and default `ask`,
- permission prompt behavior,
- session-only approval versus saved Always Allow,
- sandbox/security limitations,
- runtime parity behavior,
- target version `1.6.9`.

The PR #48 as-built spec must be updated again after implementation so it remains authoritative.

## 14. Acceptance criteria

The feature is complete when:

1. The branch is rebased onto the latest `main` and v1.6.8 hot-fix behavior is preserved.
2. PR/runtime version remains 1.6.9.
3. Features settings are grouped, searchable, and show visible descriptions.
4. The new external-resource policy defaults to **Ask every time**.
5. **Always allow**, **Ask every time**, and **Don't fetch** are selectable using the approved segmented-control UI.
6. External resources cannot load before Ask-mode approval.
7. Don't Fetch blocks both declarative external assets and supported runtime network APIs.
8. Ask-mode Allow is session-only by default.
9. **Save my option for later** is only available on Allow and switches the global setting to Always Allow.
10. A denial is never persisted automatically.
11. The iframe remains sandboxed and gains no privileged host access in any policy mode.
12. Historical HTML uses the same policy.
13. All nine locales contain the new UI copy.
14. Focused tests and the complete GitHub Actions matrix pass before merge.
15. PR #48 remains open for manual validation until separately approved for merge.
