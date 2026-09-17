# Features Settings UX and HTML External Resource Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Settings > Features searchable and grouped, and add a safe three-state external HTML resource policy with ask-before-fetch permission UX.

**Architecture:** Keep Settings presentation, external-resource scanning, preview-policy resolution, and permission UI in separate focused modules. The shared HTML preview builder remains the only place that turns a resolved network permission into preview security behavior, while persisted user preference stays in `AppSettings` and temporary Ask-mode approval stays local to the preview instance.

**Tech Stack:** React + TypeScript, existing app-state/settings persistence, Vitest/Testing Library, sandboxed `srcDoc` HTML previews, existing nine-locale translation system, Electron/Tauri/VS Code/Chromium/Web shared UI.

**Spec:** `docs/superpowers/specs/2026-09-17-features-settings-html-external-resources-design.md`

## Global Constraints

- Rebase PR #48 onto the latest `main` before production implementation and preserve all v1.6.8 hot-fix behavior.
- Keep the release target at **1.6.9** across synchronized package/runtime metadata.
- Default `externalHtmlResourcePolicy` to **`ask`** for new and migrated settings.
- Keep iframe sandboxing; never add `allow-same-origin` or privileged host access.
- `Ask every time` must perform zero external loads before explicit user approval.
- `Save my option for later` is only available with Allow and persists **Always allow**; denial is never persisted.
- Historical Git HTML uses the same policy as live HTML.
- Add no native privileged network-fetch subsystem for this scope.
- Keep PR #48 open and unmerged until separate manual approval.

---

### Task 1: Rebase PR #48 onto latest main and preserve v1.6.8 hot fixes

**Files:**
- Rebase/replay the existing PR #48 logical commit stack onto latest `main`.
- Resolve overlaps especially in `package.json`, runtime package manifests, `CHANGELOG.md`, `ui/src/components/Settings/SettingsPreferencesPanel.tsx`, `ui/src/components/Settings/SettingsModal.tsx`, `ui/src/contexts/appStateConstants.ts`, `ui/src/contexts/appStateModel.ts`, `ui/src/themeTypes.ts`, runtime capability docs/tests, and VS Code packaging/activation files.
- Test: `tests/contracts/package-config.test.ts`
- Test: `tests/contracts/vscode-workspace-insights-boundary.test.ts`
- Test: `tests/contracts/website-demo-insights-removal.test.ts`
- Test: relevant Workspace Insights/runtime-capability unit tests touched by v1.6.8.

**Interfaces:**
- Consumes: latest `main` head immediately before execution.
- Produces: PR #48 branch whose merge base is current `main`, with PR features intact, v1.6.8 fixes intact, and root/runtime versions still `1.6.9`.

- [ ] **Step 1: Re-read latest `main` and compare it with the current PR base/head**

Record the latest main SHA and list overlapping files before rewriting the branch.

- [ ] **Step 2: Replay the PR's logical commits onto latest `main`**

Preserve logical history rather than merging `main` into the feature branch. Resolve overlaps by taking the v1.6.8 behavior first, then reapplying the PR-specific behavior on top.

- [ ] **Step 3: Verify version synchronization still targets 1.6.9**

Run:

```bash
pnpm exec vitest run tests/contracts/package-config.test.ts
```

Expected: PASS and all package manifests/configs report `1.6.9`.

- [ ] **Step 4: Verify v1.6.8 runtime capability/package fixes survived the rebase**

Run:

```bash
pnpm exec vitest run \
  tests/contracts/vscode-workspace-insights-boundary.test.ts \
  tests/contracts/website-demo-insights-removal.test.ts \
  tests/unit/ui/insights/runtime-capabilities.test.ts \
  tests/unit/vscode/extension-activation-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the resolved rebased stack only after focused conflict verification**

Use compact logical history; do not add a merge commit.

---

### Task 2: Add persisted external HTML resource policy

**Files:**
- Modify: `ui/src/themeTypes.ts`
- Modify: `ui/src/contexts/appStateConstants.ts`
- Modify: `ui/src/contexts/appStateModel.ts`
- Modify: `ui/src/settings/settingsImportExportBase.ts`
- Modify: `ui/src/settings/settingsImportExport.ts`
- Modify runtime state/settings adapters only where they explicitly project settings.
- Test: `tests/unit/ui/contexts/app-state.test.ts`
- Test: settings import/export unit tests under `tests/unit/ui/settings/` or existing matching suite.
- Test: `tests/contracts/package-config.test.ts` only if synchronization metadata is touched.

**Interfaces:**
- Produces:

```ts
export type ExternalHtmlResourcePolicy = 'always' | 'ask' | 'never';

export interface AppSettings {
  externalHtmlResourcePolicy: ExternalHtmlResourcePolicy;
}
```

and a normalizer:

```ts
export function normalizeExternalHtmlResourcePolicy(value: unknown): ExternalHtmlResourcePolicy;
```

- [ ] **Step 1: Write failing persistence/default tests**

Add cases proving:

```ts
expect(defaultSettings.externalHtmlResourcePolicy).toBe('ask');
expect(normalizeExternalHtmlResourcePolicy(undefined)).toBe('ask');
expect(normalizeExternalHtmlResourcePolicy('bogus')).toBe('ask');
expect(normalizeExternalHtmlResourcePolicy('always')).toBe('always');
expect(normalizeExternalHtmlResourcePolicy('never')).toBe('never');
```

Also round-trip `always`, `ask`, and `never` through settings export/import.

- [ ] **Step 2: Run the focused tests and verify RED**

Run the exact app-state/settings import-export suites containing the new assertions. Expected failure: missing field/normalizer.

- [ ] **Step 3: Implement the type, default, normalizer, persistence, and import/export plumbing**

Minimal implementation shape:

```ts
export type ExternalHtmlResourcePolicy = 'always' | 'ask' | 'never';

export function normalizeExternalHtmlResourcePolicy(value: unknown): ExternalHtmlResourcePolicy {
  return value === 'always' || value === 'never' ? value : 'ask';
}
```

Ensure older saved data that omits the field resolves to `ask`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Expected: all new persistence/default tests pass.

- [ ] **Step 5: Commit**

Suggested message:

```text
feat(settings): add external HTML resource policy
```

---

### Task 3: Refactor Settings > Features into searchable grouped UI

**Files:**
- Create: `ui/src/components/Settings/SettingsFeaturesPanel.tsx`
- Create: `ui/src/components/Settings/FeatureSettingsSearch.tsx`
- Create: `ui/src/components/Settings/FeatureSettingsGroup.tsx`
- Create: `ui/src/components/Settings/HtmlExternalResourcePolicyControl.tsx`
- Modify: `ui/src/components/Settings/SettingsPreferencesPanel.tsx`
- Modify: `ui/src/styles/global/global-settings-layout.css`
- Modify: feature/settings translation modules, including `ui/src/contexts/featureSettingsTranslations.ts` and typed translation data as required.
- Test: `tests/unit/ui/components/settings-modal-deep.test.tsx`
- Test: `tests/unit/ui/components/settings-render.test.tsx`
- Test: translation coverage contract.

**Interfaces:**
- `SettingsFeaturesPanel` consumes current `AppSettings`, runtime capability booleans already used by Settings, localized strings, and `updateSettings(patch)`.
- `HtmlExternalResourcePolicyControl` consumes:

```ts
{
  value: ExternalHtmlResourcePolicy;
  onChange: (value: ExternalHtmlResourcePolicy) => void;
  labels: Record<ExternalHtmlResourcePolicy, string>;
}
```

- [ ] **Step 1: Write failing UI tests for grouping, search, descriptions, and policy selector**

Cover:

```ts
expect(screen.getByRole('searchbox', { name: /search features/i })).toBeVisible();
expect(screen.getByText('Workspace')).toBeVisible();
expect(screen.getByText('Editing & History')).toBeVisible();
expect(screen.getByText('Document previews')).toBeVisible();
expect(screen.getByText('Limits')).toBeVisible();
```

Search should hide empty groups and show `No matching features`. Add keyboard test for Left/Right on the external-resource radiogroup.

- [ ] **Step 2: Run focused Settings tests and verify RED**

Expected: missing grouped panel/search/policy control.

- [ ] **Step 3: Move Features rendering out of `SettingsPreferencesPanel.tsx`**

Keep Appearance/Typography/Theme routing there, but render:

```tsx
{section === 'features' && (
  <SettingsFeaturesPanel
    state={state}
    t={t}
    isDesktop={isDesktop}
    updateSettings={updateSettings}
  />
)}
```

- [ ] **Step 4: Implement grouped searchable feature descriptors**

Use a typed descriptor model so search/filter logic is data-driven rather than duplicated JSX. Include stable keywords for terms like HTML, CDN, JavaScript, CSS, Office, bookmark, history, edit, tabs, and pins.

- [ ] **Step 5: Make descriptions visible and rows easier to click**

Boolean row click toggles once, but clicks originating from `button`, `input`, `select`, `textarea`, `a`, or another explicit interactive descendant do not bubble into a second toggle.

- [ ] **Step 6: Implement the screenshot-style segmented policy selector**

Use `role="radiogroup"`, three equal options, `aria-checked`, strong active styling, Tab focus, and Left/Right navigation.

- [ ] **Step 7: Run focused UI + translation tests and verify GREEN**

- [ ] **Step 8: Commit**

Suggested message:

```text
feat(settings): redesign searchable Features panel
```

---

### Task 4: Add pure external-resource scanner

**Files:**
- Create: `ui/src/markdown/htmlExternalResources.ts`
- Test: `tests/unit/ui/markdown/htmlExternalResources.test.ts`
- Add source to any production-source coverage manifest if required by repository contracts.

**Interfaces:**
- Produces:

```ts
export type ExternalHtmlResourceKind =
  | 'script' | 'style' | 'font' | 'image' | 'media' | 'frame' | 'other';

export interface ExternalHtmlResource {
  url: string;
  origin: string;
  host: string;
  kind: ExternalHtmlResourceKind;
}

export interface ExternalHtmlResourceScan {
  resources: readonly ExternalHtmlResource[];
  hosts: readonly string[];
  hasRuntimeNetworkCode: boolean;
}

export function scanExternalHtmlResources(
  source: string,
  baseHref?: string | null,
): ExternalHtmlResourceScan;
```

- [ ] **Step 1: Write failing scanner tests**

Test external script/style/image/media/frame URLs, protocol-relative URLs, CSS `@import`, CSS `url()`, deduplication, local relative paths, `data:`/`blob:` exclusion, privileged-scheme exclusion, and runtime API detection (`fetch`, XHR, WebSocket, EventSource, sendBeacon).

- [ ] **Step 2: Run scanner tests and verify RED**

- [ ] **Step 3: Implement deterministic scanning without executing HTML**

Use DOM parsing where available for resource-bearing attributes and a bounded CSS/text pass for `@import`, `url(...)`, and runtime-network API indicators. Resolve relative URLs against `baseHref` only for classification; relative/local resources must not be reported as external.

- [ ] **Step 4: Verify scanner failure defaults safe**

Expose a caller-friendly failure path that results in blocked preview behavior; do not treat parse failure as permission.

- [ ] **Step 5: Run scanner + coverage-contract tests and verify GREEN**

- [ ] **Step 6: Commit**

Suggested message:

```text
feat(html): detect external preview resources
```

---

### Task 5: Make HTML preview generation policy-aware and block declarative loads

**Files:**
- Modify: `ui/src/markdown/htmlPreviewDocument.ts`
- Modify: `ui/src/markdown/codeRenderer.ts`
- Modify corresponding VS Code copy only if that runtime still owns a duplicated renderer rather than consuming the shared one.
- Modify: `ui/src/dom/htmlPreviewActions.ts`
- Test: `tests/unit/ui/markdown/htmlPreviewDocument.test.ts` or current equivalent.
- Test: `tests/unit/ui/dom/htmlPreviewActions.test.ts`
- Test: `tests/unit/vscode/codeRenderer.test.ts` if duplicated VS Code rendering remains.

**Interfaces:**
- Extend preview options with resolved permission, not raw user preference:

```ts
export type HtmlPreviewNetworkPermission = 'blocked' | 'allowed';

export interface HtmlPreviewDocumentOptions {
  networkPermission?: HtmlPreviewNetworkPermission;
}
```

- [ ] **Step 1: Write failing security tests**

Prove blocked mode includes both runtime JS network guards and CSP/resource restrictions, while allowed mode removes Markdown Explorer's intentional network blocking but keeps iframe sandboxing at the rendering layer.

- [ ] **Step 2: Run focused HTML preview tests and verify RED**

- [ ] **Step 3: Generate a restrictive CSP in blocked mode**

The blocked preview must prevent remote declarative loads (`script-src`, `style-src`, `img-src`, `font-src`, `media-src`, `frame-src`, `connect-src`) while still permitting the existing inline preview machinery/local embedded data required for rendering.

- [ ] **Step 4: Generate allowed mode without privileged escalation**

Allowed mode permits HTTP/HTTPS resources and HTTP/HTTPS/WS/WSS network APIs inside the existing sandbox. Do not modify iframe sandbox flags.

- [ ] **Step 5: Propagate resolved permission through inline/modal/browser preview builders**

Keep resource-policy decision outside the builder; the builder only receives `blocked` or `allowed`.

- [ ] **Step 6: Run HTML preview tests and verify GREEN**

- [ ] **Step 7: Commit**

Suggested message:

```text
feat(html): enforce preview network permission
```

---

### Task 6: Add Ask-mode permission dialog and per-preview approval state

**Files:**
- Create: `ui/src/components/Modal/HtmlExternalResourcesDialog.tsx`
- Modify: preview orchestration where raw HTML source is turned into inline/modal/external preview documents, likely `ui/src/dom/htmlPreviewActions.ts` plus the document/HTML content surface that owns `.html/.htm` preview state.
- Modify: `ui/src/components/Modal/HtmlPreviewModal.tsx` only if it must receive/rebuild permission-aware document HTML.
- Modify shared app actions only for persisting Allow + Save choice.
- Test: `tests/unit/ui/dom/htmlPreviewActions.test.ts`
- Test: component tests for the new permission dialog and full HTML document preview path.

**Interfaces:**
- Dialog input:

```ts
interface HtmlExternalResourcesDialogProps {
  scan: ExternalHtmlResourceScan;
  onDeny: () => void;
  onAllow: (persistAlways: boolean) => void;
  onClose: () => void;
}
```

- Preview instance state resolves to `'blocked' | 'allowed'` independently of global settings.

- [ ] **Step 1: Write failing Ask-mode interaction tests**

Cover:

```text
ask + external resource -> blocked preview + dialog
Deny -> blocked preview, no settings change
Allow -> active preview becomes allowed, settings remain ask
Allow + Save -> active preview allowed, settings become always
reopen while still ask -> prompt again
```

Also prove no external-capable document is produced before approval.

- [ ] **Step 2: Run tests and verify RED**

- [ ] **Step 3: Implement session-only approval state**

Temporary approval belongs to the preview instance/file view lifecycle and is cleared when that preview is recreated/reopened. Do not store per-domain approvals.

- [ ] **Step 4: Implement permission dialog with host summary and runtime-network warning**

List deduplicated hosts from the scanner. If `hasRuntimeNetworkCode` is true, include a note that scripts may contact dynamically computed destinations after approval.

- [ ] **Step 5: Implement conditional persistence checkbox**

The checkbox is semantically tied to the Allow action. Deny never writes settings. Allow + checked performs:

```ts
updateSettings({ externalHtmlResourcePolicy: 'always' });
```

before/alongside rebuilding the current preview as allowed.

- [ ] **Step 6: Preserve focus and modal accessibility**

Trap focus, support Escape as safe denial/close according to existing modal conventions, and return focus to the triggering preview control.

- [ ] **Step 7: Run interaction tests and verify GREEN**

- [ ] **Step 8: Commit**

Suggested message:

```text
feat(html): ask before loading external resources
```

---

### Task 7: Apply the same policy to historical HTML and runtime variants

**Files:**
- Modify revision-backed document rendering path in `ui/src/history/` / content selectors only where HTML revision content currently bypasses normal HTML preview orchestration.
- Modify VS Code duplicated HTML preview helpers if still required.
- Verify Chromium/Web shared paths use the same UI policy and do not bypass it.
- Test: revision workspace/history component tests.
- Test: Chromium/Web/VS Code HTML preview/runtime tests.

**Interfaces:**
- Consumes: `scanExternalHtmlResources`, `HtmlPreviewNetworkPermission`, and global `externalHtmlResourcePolicy`.
- Produces: identical user policy semantics for live and historical HTML without changing historical read-only behavior.

- [ ] **Step 1: Write failing revision/runtime tests**

Historical HTML with an external script under `ask` must remain blocked and request approval; `never` must remain blocked; `always` may load external resources inside the same sandbox boundary.

- [ ] **Step 2: Run focused revision/runtime tests and verify RED**

- [ ] **Step 3: Route revision-backed HTML through the shared policy resolver**

Do not add host-specific permission storage.

- [ ] **Step 4: Verify unsupported/runtime-specific CSP restrictions remain authoritative**

`always` means Markdown Explorer does not intentionally block network access; it does not override VS Code Webview, Chromium CSP, browser CORS, or remote server policy.

- [ ] **Step 5: Run focused runtime tests and verify GREEN**

- [ ] **Step 6: Commit**

Suggested message:

```text
fix(html): keep external resource policy consistent across runtimes
```

---

### Task 8: Localize, document, sync 1.6.9 specs, and run full verification

**Files:**
- Modify all nine locale translation data files/modules used by Settings and permission dialogs.
- Modify: `docs/instructions/03-features/12-settings-preferences-import-export.md`
- Modify: `docs/instructions/04-runtimes/06-runtime-parity.md`
- Modify: `docs/instructions/05-reference/03-settings-catalog.md`
- Modify: `docs/instructions/05-reference/07-current-app-state.md`
- Modify: `docs/superpowers/specs/2026-09-17-pr48-as-built-sync.md`
- Modify: `CHANGELOG.md`
- Modify other active HTML-preview/security docs located during implementation.
- Verify package/runtime version metadata remains `1.6.9`.

**Interfaces:**
- Produces final documented behavior matching implementation and PR #48's authoritative as-built spec.

- [ ] **Step 1: Add all new localized strings across nine locales**

Include Features search/group copy, policy title/description/options, no-results state, permission dialog copy, runtime-network note, Allow, Don't allow, and Save my option for later.

- [ ] **Step 2: Run translation coverage and verify GREEN**

Run:

```bash
pnpm run test:translations
```

- [ ] **Step 3: Update settings/runtime/security/as-built documentation**

Document default `ask`, session-only approval, saved Always Allow, no persistent denial, sandbox retention, historical HTML parity, and runtime limitations.

- [ ] **Step 4: Re-check latest `main`**

If `main` advanced after Task 1, rebase again before final verification and repeat conflict-focused tests. Preserve `1.6.9`.

- [ ] **Step 5: Run focused full local verification**

Run:

```bash
pnpm run test:node
pnpm run test:contracts
pnpm run test:translations
pnpm run test:ui
pnpm run test:electron
pnpm run test:vscode
pnpm run test:chromium
pnpm run test:coverage
pnpm run build:ui
pnpm run build:vscode
```

Run Tauri tests where the environment supports them:

```bash
pnpm run test:tauri
```

Expected: zero failures.

- [ ] **Step 6: Push/force-update the rebased compact PR branch and verify GitHub Actions**

Do not claim completion until the definitive post-rebase/post-implementation workflow is green across all jobs.

- [ ] **Step 7: Update PR #48 description**

Add the new Features UX, external-resource policy, security semantics, latest-main rebase SHA, 1.6.9 target, and final compact commit list.

- [ ] **Step 8: Keep PR #48 open**

No merge until the user separately approves manual validation.
