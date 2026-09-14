# History Sidebar, Feature Controls, and Split-View Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship feature-gated Markdown editing, a repository History sidebar with read-only commit snapshot browsing, improved document-history controls/layout, and split panes that do not visibly refresh when the opposite pane changes.

**Architecture:** Keep live working-tree/editor state separate from repository snapshot state. Extend the existing Git history request/response protocol with repository-level read-only operations, then layer a dedicated sidebar History UI and snapshot context on top of the shared `HistoryClient`. Centralize feature availability in persisted settings, generalize sidebar tabs to descriptors, and replace split-view global render invalidation with document-scoped render revisions plus memoized pane surfaces.

**Tech Stack:** React 19, TypeScript 5.8 / ES2020 target, Vitest, Node test runner, Electron Node host, Tauri/Rust, VS Code extension host, Chromium extension host, Git CLI.

**Spec:** `docs/superpowers/specs/2026-09-13-history-sidebar-features-and-split-isolation-design.md`

## Global Constraints

- Do not check out commits or mutate the user's working tree while browsing history.
- Historical snapshot browsing is always read-only.
- `markdownEditingEnabled` defaults to `false`.
- `historySidebarEnabled` defaults to `true`, but the History tab is only visible when Git capability is supported for the current workspace/runtime.
- More than three visible left-sidebar tabs must render icon-only tab buttons; three or fewer keep icon + label.
- Chromium/Web must preserve protocol parity and explicitly return `unsupported-runtime` for local Git repository operations.
- All Git OIDs and revision paths must use the existing full-OID validation and workspace-boundary protections.
- Imported SVGRepo artwork must be embedded locally, normalized to `currentColor`, and have its per-icon license verified before commit; no remote runtime SVG loading.
- Keep the TypeScript UI compatible with the existing ES2020 `lib`; do not introduce ES2022-only APIs such as `Array.prototype.at`.
- The unaffected split pane may React-render for parent bookkeeping, but its expensive document body must not remount/re-render when only the other pane's source, scroll, or active state changes.

---

### Task 1: Persist Feature Flags and Create Settings > Features

**Files:**
- Modify: `ui/src/themeTypes.ts` (`AppSettings`, `PersistedState`)
- Modify: `ui/src/contexts/appStateModel.ts` (`initialState`, `createInitialState`)
- Modify: `ui/src/settings/settingsImportExportBase.ts` (`normalizeSettings`)
- Modify: `ui/src/components/Settings/SettingsModal.tsx` (`activeSection`, `settingsSections`)
- Modify: `ui/src/components/Settings/SettingsPreferencesPanel.tsx` (`SettingsPreferencesSection`, move feature rows)
- Modify: `ui/src/components/shared/icons.tsx` (add `SettingsFeaturesIcon`)
- Modify: `ui/src/contexts/translationTypes.ts`
- Modify: `ui/src/contexts/translations.ts`
- Modify: `ui/src/contexts/translationsData.ts`
- Create: `tests/unit/ui/components/settings-features-panel.test.tsx`
- Modify: `tests/unit/ui/contexts/constants.test.ts`
- Modify: `tests/node/ci-regression-contracts.test.mjs`

**Interfaces:**
- Produces: `AppSettings.historySidebarEnabled: boolean`
- Produces: `AppSettings.markdownEditingEnabled: boolean`
- Produces: `SettingsPreferencesSection = 'appearance' | 'typography' | 'theme' | 'features'`
- Defaults: `historySidebarEnabled === true`, `markdownEditingEnabled === false`

- [ ] **Step 1: Write failing settings-model tests**

Add assertions that a fresh state and a migrated old state both expose the exact defaults, while explicit imported values survive normalization:

```ts
expect(initialState.settings.historySidebarEnabled).toBe(true);
expect(initialState.settings.markdownEditingEnabled).toBe(false);

const migrated = createInitialState({ bookmarksEnabled: true }, true, storageStub);
expect(migrated.settings.historySidebarEnabled).toBe(true);
expect(migrated.settings.markdownEditingEnabled).toBe(false);
```

In `settings-features-panel.test.tsx`, render the settings modal and assert `Features` contains `fileTabs`, `bookmarksEnabled`, `insightsEnabled`, `documentConversion`, HTML/CSV preview settings, `maxPinnedItems`, `historySidebarEnabled`, and `markdownEditingEnabled`, while Appearance no longer renders those rows.

- [ ] **Step 2: Run the tests and confirm the red state**

Run:

```bash
pnpm vitest run tests/unit/ui/components/settings-features-panel.test.tsx tests/unit/ui/contexts/constants.test.ts
node --test tests/node/ci-regression-contracts.test.mjs
```

Expected: FAIL because the new settings and `features` section do not exist.

- [ ] **Step 3: Add the settings fields and deterministic migration**

Use these exact shapes in `themeTypes.ts`:

```ts
export interface AppSettings {
  // existing fields...
  historySidebarEnabled: boolean;
  markdownEditingEnabled: boolean;
}

export interface PersistedState {
  // existing fields...
  historySidebarEnabled?: boolean;
  markdownEditingEnabled?: boolean;
}
```

Initialize/migrate with:

```ts
historySidebarEnabled: saved.historySidebarEnabled !== false,
markdownEditingEnabled: saved.markdownEditingEnabled === true,
```

Normalize imported settings with the same semantics:

```ts
historySidebarEnabled: raw.historySidebarEnabled !== false,
markdownEditingEnabled: raw.markdownEditingEnabled === true,
```

- [ ] **Step 4: Add the Features settings section and move feature rows**

Extend the section union, add `SettingsFeaturesIcon`, add a `features` navigation entry, and render the moved rows only when `section === 'features'`. Keep color mode and desktop Focus/Tabs mode under Appearance.

Use the existing `switch-toggle` control for settings booleans. Add localized labels/descriptions for:

```ts
features: string;
featuresDesc: string;
historySidebarEnabled: string;
historySidebarEnabledDesc: string;
markdownEditingEnabled: string;
markdownEditingEnabledDesc: string;
```

Populate all nine locale records in `translationsData.ts` and keep `translations.ts` / `translationTypes.ts` in sync with the project translation structure.

- [ ] **Step 5: Run focused tests**

```bash
pnpm vitest run tests/unit/ui/components/settings-features-panel.test.tsx tests/unit/ui/contexts/constants.test.ts
node --test tests/node/ci-regression-contracts.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/src/themeTypes.ts ui/src/contexts/appStateModel.ts ui/src/settings/settingsImportExportBase.ts ui/src/components/Settings ui/src/components/shared/icons.tsx ui/src/contexts/translationTypes.ts ui/src/contexts/translations.ts ui/src/contexts/translationsData.ts tests/unit/ui/components/settings-features-panel.test.tsx tests/unit/ui/contexts/constants.test.ts tests/node/ci-regression-contracts.test.mjs
git commit -m "feat(settings): add feature controls"
```

---

### Task 2: Make Markdown Editing a Real Feature Gate

**Files:**
- Create: `ui/src/editor/editingFeature.ts`
- Modify: `ui/src/components/Topbar/Topbar.tsx`
- Modify: `ui/src/components/shared/ToolbarActionMenu.tsx`
- Modify: `ui/src/components/Content/SplitContent.tsx`
- Modify: `ui/src/contexts/AppStateContext.tsx` (guard editing actions/shortcut entry)
- Modify: `ui/src/hooks/useKeyboard.ts` if `editCurrentDocument` enters edit mode directly
- Create: `tests/unit/ui/editor/editing-feature-gate.test.tsx`
- Modify: `tests/unit/ui/components/topbar-markdown-editing.test.tsx`
- Modify: `tests/unit/ui/split-view/split-content.test.tsx`

**Interfaces:**
- Produces: `isMarkdownEditingAvailable(settings: AppSettings): boolean`
- Rule: editing entry points are available only when `settings.markdownEditingEnabled === true`

- [ ] **Step 1: Write failing feature-gate tests**

Test the helper and UI with explicit OFF/ON settings:

```ts
expect(isMarkdownEditingAvailable({ ...settings, markdownEditingEnabled: false })).toBe(false);
expect(isMarkdownEditingAvailable({ ...settings, markdownEditingEnabled: true })).toBe(true);
```

For OFF, assert:
- More Actions does not contain Edit.
- topbar Markdown mode group is absent.
- split pane offers only `rendered` plus history-only read modes, not `inline-edit`/`plain`.
- invoking the app-state edit action leaves the document mode `rendered`.

For ON, preserve the current editor behavior.

- [ ] **Step 2: Run tests and confirm failure**

```bash
pnpm vitest run tests/unit/ui/editor/editing-feature-gate.test.tsx tests/unit/ui/components/topbar-markdown-editing.test.tsx tests/unit/ui/split-view/split-content.test.tsx
```

Expected: FAIL because editing is currently exposed without the feature flag.

- [ ] **Step 3: Implement one source of truth**

Create:

```ts
import type { AppSettings } from '../types';

export function isMarkdownEditingAvailable(settings: AppSettings): boolean {
  return settings.markdownEditingEnabled === true;
}
```

Use it in `Topbar`, `SplitContent`, and app-state editing actions. Set the toolbar menu prop as:

```tsx
showEdit={isMarkdownEditingAvailable(state.settings) && (state.appRuntime === 'desktop' || state.appRuntime === 'tauri')}
```

Also hide the VS Code topbar edit affordance that enters Markdown Explorer editing when this feature is OFF; native "open in editor" behavior that merely hands the file to VS Code may remain available only if it is clearly not the Markdown Explorer editor flow.

- [ ] **Step 4: Guard non-visual entry points**

Before applying `inline-edit` or `plain` in app-state actions/keyboard handling:

```ts
if (!isMarkdownEditingAvailable(state.settings) && mode !== 'rendered') return;
```

Historical revision/diff modes remain available because they are read-only.

- [ ] **Step 5: Run focused tests**

```bash
pnpm vitest run tests/unit/ui/editor/editing-feature-gate.test.tsx tests/unit/ui/components/topbar-markdown-editing.test.tsx tests/unit/ui/split-view/split-content.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/src/editor/editingFeature.ts ui/src/components/Topbar/Topbar.tsx ui/src/components/shared/ToolbarActionMenu.tsx ui/src/components/Content/SplitContent.tsx ui/src/contexts/AppStateContext.tsx ui/src/hooks/useKeyboard.ts tests/unit/ui/editor/editing-feature-gate.test.tsx tests/unit/ui/components/topbar-markdown-editing.test.tsx tests/unit/ui/split-view/split-content.test.tsx
git commit -m "feat(editor): gate Markdown editing behind setting"
```

---

### Task 3: Fix History Safe Region and Redesign Document-History Controls

**Files:**
- Modify: `ui/src/components/History/DocumentHistoryPanel.tsx`
- Create: `ui/src/components/History/HistoryActionIcons.tsx`
- Create: `ui/src/components/History/HistorySelectionCheckbox.tsx`
- Create: `ui/src/components/History/CopyableHistoryMeta.tsx`
- Modify: `ui/src/components/Modal/SupportPromptModal.tsx` if checkbox icons are extracted for reuse
- Modify: `ui/src/components/shared/icons.tsx` (shared checked/unchecked SVGs when extracted)
- Modify: `ui/src/styles/global/global-history-diff.css`
- Modify: `ui/src/styles/tokens/tokens-app-shell.css` or the existing shell-layout CSS that owns `--topbar-h`
- Modify: `tests/unit/ui/history/document-history-panel.test.tsx`
- Create: `tests/node/history-panel-layout-contract.test.mjs`

**Interfaces:**
- Produces: icon-only history actions with localized `aria-label` + tooltip
- Produces: `CopyableHistoryMeta({ value, copyValue, label, copiedLabel })`
- Produces: custom SVG selection control with `aria-checked`
- Layout invariant: history backdrop begins below the effective desktop header in both Focus and Tabs view

- [ ] **Step 1: Verify SVGRepo sources before embedding**

Search SVGRepo for View/Eye, Git Compare, Git Commit/History, Copy, and checkmark/checkbox icons. Record the source URL and license in a short source comment beside each imported path. Reject any icon whose per-icon license is incompatible with this repository; prefer CC0/public-domain candidates. Convert fills/strokes to `currentColor` and preserve only the needed SVG path data.

- [ ] **Step 2: Write failing UI and layout tests**

Add tests asserting:

```ts
expect(screen.queryByRole('button', { name: t.viewRevision })).toHaveTextContent('');
expect(screen.getByRole('checkbox', { name: /revision/i })).toHaveAttribute('aria-checked', 'false');
```

Simulate click/keyboard activation on SHA and author and assert `bridge.copyToClipboard` receives the full OID and author respectively.

The Node contract must assert the history backdrop uses a top safe-area variable rather than `inset: 0`, and that both layout classes define it:

```js
assert.match(css, /\.history-panel-backdrop\s*\{[^}]*top:\s*var\(--app-content-top/s);
assert.match(shellCss, /\.app--focus-view[^}]*--app-content-top:/s);
assert.match(shellCss, /\.app--tab-view[^}]*--app-content-top:/s);
```

- [ ] **Step 3: Run tests and confirm failure**

```bash
pnpm vitest run tests/unit/ui/history/document-history-panel.test.tsx
node --test tests/node/history-panel-layout-contract.test.mjs
```

Expected: FAIL against the current text buttons, raw checkbox, and `inset: 0` backdrop.

- [ ] **Step 4: Implement the content-safe overlay**

Define one shell variable and consume it from the backdrop:

```css
.app--focus-view,
.app--tab-view {
  --app-content-top: var(--topbar-h);
}

.history-panel-backdrop {
  position: fixed;
  top: var(--app-content-top, 0px);
  right: 0;
  bottom: 0;
  left: 0;
}
```

If the existing Tabs header uses a different token, set `--app-content-top` to that existing token in `.app--tab-view` rather than adding a magic pixel value. Keep fullscreen behavior consistent with the shell's active header geometry.

- [ ] **Step 5: Implement compact actions, custom checkbox, and copyable metadata**

Use `TooltipButton` with icon-only rendering:

```tsx
<TooltipButton
  type="button"
  className="document-history-panel__icon-action"
  tooltip={t.viewRevision}
  aria-label={t.viewRevision}
  icon={<HistoryViewIcon size={15} />}
  onClick={() => void runAction(() => onViewRevision(revision))}
/>
```

Implement the selection control as a button with `role="checkbox"`, `aria-checked`, and checked/unchecked SVG children; do not expose a visible raw `<input type="checkbox">`.

`CopyableHistoryMeta` uses `usePlatform().copyToClipboard(copyValue)` and an internal `aria-live="polite"` copied message. SHA displays `shortOid` but passes `revision.oid` as `copyValue`.

- [ ] **Step 6: Run focused tests**

```bash
pnpm vitest run tests/unit/ui/history/document-history-panel.test.tsx
node --test tests/node/history-panel-layout-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/History ui/src/components/Modal/SupportPromptModal.tsx ui/src/components/shared/icons.tsx ui/src/styles/global/global-history-diff.css ui/src/styles/tokens tests/unit/ui/history/document-history-panel.test.tsx tests/node/history-panel-layout-contract.test.mjs
git commit -m "feat(history): compact revision controls and safe layout"
```

---

### Task 4: Generalize Sidebar Tabs and Add History Visibility Rules

**Files:**
- Create: `ui/src/components/Sidebar/sidebarTabs.ts`
- Modify: `ui/src/components/Sidebar/Sidebar.tsx`
- Modify: `ui/src/components/Sidebar/SidebarTabsHeader.tsx`
- Modify: `ui/src/contexts/appStateModel.ts` (`SidebarTabId`, action/state type)
- Modify: `ui/src/styles/global/global-content-tabs-focus-search.css`
- Modify: `ui/src/styles/global/global-shell-control-sizing.css`
- Create: `tests/unit/ui/components/sidebar-tabs-history.test.tsx`
- Modify: `tests/node/sidebar-focus-search-layout.test.mjs`

**Interfaces:**
- Produces: `export type SidebarTabId = 'files' | 'search' | 'bookmarks' | 'history'`
- Produces: `buildVisibleSidebarTabs(input): readonly SidebarTabDescriptor[]`
- Produces: `iconOnly = visibleTabs.length > 3`

- [ ] **Step 1: Write failing descriptor and rendering tests**

Use a pure descriptor helper so visibility/order is testable without the whole Sidebar:

```ts
expect(buildVisibleSidebarTabs({ bookmarksEnabled: false, historyEnabled: false })).toHaveLength(2);
expect(buildVisibleSidebarTabs({ bookmarksEnabled: true, historyEnabled: false })).toHaveLength(3);
expect(buildVisibleSidebarTabs({ bookmarksEnabled: true, historyEnabled: true })).toHaveLength(4);
```

Render 3 tabs and assert labels are visible. Render 4 tabs and assert each tab has an accessible name/tooltip but the text-label span is omitted or visually hidden according to the component contract.

Also test that active `history` falls back to `files` when `historyEnabled` becomes false.

- [ ] **Step 2: Run tests and confirm failure**

```bash
pnpm vitest run tests/unit/ui/components/sidebar-tabs-history.test.tsx
node --test tests/node/sidebar-focus-search-layout.test.mjs
```

Expected: FAIL because sidebar tabs are currently a fixed three-tab union.

- [ ] **Step 3: Implement the visible-tab registry**

Create:

```ts
export type SidebarTabId = 'files' | 'search' | 'bookmarks' | 'history';

export interface SidebarTabDescriptor {
  readonly id: SidebarTabId;
  readonly label: string;
  readonly icon: ReactNode;
  readonly count?: number;
}
```

`buildVisibleSidebarTabs` always returns Files/Search first, then optional Bookmarks, then optional History. Derive slide direction from indices in the current descriptor array instead of a fixed `Record`.

`SidebarTabsHeader` receives `tabs`, computes `iconOnly = tabs.length > 3`, and uses `TooltipButton` semantics or native title/ARIA so icon-only tabs remain understandable.

- [ ] **Step 4: Wire capability-aware History visibility**

History is visible only when:

```ts
const historyEnabled = state.settings.historySidebarEnabled && state.gitCapability?.supported === true;
```

If History is active and either condition becomes false, dispatch `SET_SIDEBAR_ACTIVE_TAB` with `files`.

- [ ] **Step 5: Run focused tests**

```bash
pnpm vitest run tests/unit/ui/components/sidebar-tabs-history.test.tsx
node --test tests/node/sidebar-focus-search-layout.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/src/components/Sidebar ui/src/contexts/appStateModel.ts ui/src/styles/global/global-content-tabs-focus-search.css ui/src/styles/global/global-shell-control-sizing.css tests/unit/ui/components/sidebar-tabs-history.test.tsx tests/node/sidebar-focus-search-layout.test.mjs
git commit -m "feat(sidebar): add adaptive History tab"
```

---

### Task 5: Extend Shared Git Contracts and HistoryClient for Repository Snapshots

**Files:**
- Modify: `ui/src/history/contracts.ts`
- Modify: `ui/src/history/historyClient.ts`
- Modify: `ui/src/types/webviewMessages.ts`
- Modify: `ui/src/types/hostMessages.ts`
- Modify: `tests/unit/ui/history/history-client.test.ts`
- Modify: `tests/unit/ui/contexts/history-translations.test.ts`
- Modify: `ui/src/contexts/historyTranslations.ts`

**Interfaces:**
- Produces:

```ts
export interface GitRepositoryCommit {
  readonly oid: string;
  readonly shortOid: string;
  readonly parentOids: readonly string[];
  readonly author: string;
  readonly authoredAt: string;
  readonly subject: string;
  readonly refs: readonly string[];
  readonly isHead: boolean;
}

export interface GitRevisionFile {
  readonly path: string;
}

export interface GitRevisionFileSnapshot {
  readonly oid: string;
  readonly path: string;
  readonly source: string;
}
```

- Produces `HistoryClient.listRepositoryHistory(limit?)`, `listRevisionFiles(oid)`, and `readRevisionFile(oid, path)`.
- Protocol commands/results:
  - `listRepositoryHistory` / `repositoryHistoryResult`
  - `listRevisionFiles` / `revisionFilesResult`
  - `readRevisionFile` / `revisionFileResult`

- [ ] **Step 1: Write failing client protocol tests**

Extend the fake bridge tests to assert each method posts the exact request and resolves only from its matching response. Example:

```ts
const pending = client.listRepositoryHistory(200);
expect(posted.at(0)).toEqual({ command: 'listRepositoryHistory', requestId: 'req-1', limit: 200 });
emit({ command: 'repositoryHistoryResult', requestId: 'req-1', ok: true, commits: [commit] });
await expect(pending).resolves.toEqual([commit]);
```

Use ES2020-compatible indexing in committed code/tests (`posted[0]`, not `.at(0)`). Add rejection assertions for `unsupported-runtime`, invalid revision, and host failures.

- [ ] **Step 2: Run tests and confirm failure**

```bash
pnpm vitest run tests/unit/ui/history/history-client.test.ts tests/unit/ui/contexts/history-translations.test.ts
```

Expected: FAIL because repository-level request kinds/types are absent.

- [ ] **Step 3: Add contracts and message unions**

Extend `RequestKind` with `repository-history`, `revision-files`, and `revision-file`. Add typed request/response interfaces to the two message union files. Keep all result messages correlated by `requestId` and all failure responses carrying `ok: false` plus `reason`.

- [ ] **Step 4: Implement HistoryClient methods**

Add:

```ts
listRepositoryHistory(limit) {
  return request<readonly GitRepositoryCommit[]>('repository-history', (requestId) => ({
    command: 'listRepositoryHistory', requestId, ...(limit === undefined ? {} : { limit }),
  }));
},
listRevisionFiles(oid) {
  return request<readonly GitRevisionFile[]>('revision-files', (requestId) => ({
    command: 'listRevisionFiles', requestId, oid,
  }));
},
readRevisionFile(oid, path) {
  return request<GitRevisionFileSnapshot>('revision-file', (requestId) => ({
    command: 'readRevisionFile', requestId, oid, path,
  }));
},
```

Add history translations for repository history, commit browsing, loading/error states, and Back to current HEAD across all supported history locales.

- [ ] **Step 5: Run focused tests**

```bash
pnpm vitest run tests/unit/ui/history/history-client.test.ts tests/unit/ui/contexts/history-translations.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/src/history ui/src/types/hostMessages.ts ui/src/types/webviewMessages.ts ui/src/contexts/historyTranslations.ts tests/unit/ui/history/history-client.test.ts tests/unit/ui/contexts/history-translations.test.ts
git commit -m "feat(history): add repository snapshot contracts"
```

---

### Task 6: Implement Repository History in Electron

**Files:**
- Modify: `electron/git/document-history.js`
- Modify: `electron/core/ipc-handlers.js` and/or the existing Git-history command registration if required by the dispatcher
- Modify: `electron/core/main-runtime.js` only if the current handler list requires explicit wiring
- Modify: `tests/unit/electron/document-history.test.ts`

**Interfaces:**
- Consumes the Task 5 command/result names and `GitRepositoryCommit` shape.
- Produces read-only Git CLI operations for history, tree listing, and file reads.

- [ ] **Step 1: Write failing Electron adapter tests**

Create a temp repository with:
- at least three commits,
- a side branch merged back to produce a two-parent merge commit,
- a workspace subdirectory so outside-workspace filtering can be proven.

Assert `listRepositoryHistory` returns `parentOids`, `refs`, `isHead`, and merge parents. Assert `listRevisionFiles` returns only files inside the workspace root. Assert `readRevisionFile` reads historical source and rejects `../` traversal / invalid OIDs.

- [ ] **Step 2: Run tests and confirm failure**

```bash
pnpm vitest run tests/unit/electron/document-history.test.ts
```

Expected: FAIL because only document-scoped history exists.

- [ ] **Step 3: Implement repository commit parsing**

Use one record separator and field separator so commit subjects cannot corrupt parsing:

```js
const output = await runGit(repositoryRoot, [
  'log', '--all',
  '--format=%x1e%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D',
  '-n', String(normalizeHistoryLimit(limit)),
]);
```

Resolve current HEAD once with `git rev-parse HEAD`; set `isHead` by exact full-OID comparison. Split `%P` on spaces and refs on commas after trimming.

- [ ] **Step 4: Implement workspace-scoped revision tree and file reads**

Determine repository-relative workspace prefix from `repositoryRoot`/`workspaceRoot`. List files with:

```bash
git ls-tree -r --name-only <oid> -- <workspace-prefix>
```

Return paths relative to the workspace root. For file reads, validate the workspace-relative path, prepend the workspace prefix, then run:

```bash
git show <oid>:<repository-relative-path>
```

Never run checkout/reset/stash/switch.

- [ ] **Step 5: Extend Electron message handlers**

Add new commands to `createGitHistoryMessageHandlers` and emit the exact Task 5 result message names. All exceptions become `ok: false` with the existing failure reason conventions.

- [ ] **Step 6: Run focused tests**

```bash
pnpm vitest run tests/unit/electron/document-history.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add electron/git/document-history.js electron/core tests/unit/electron/document-history.test.ts
git commit -m "feat(electron): browse repository revisions"
```

---

### Task 7: Implement Repository History in Tauri

**Files:**
- Modify: `tauri/src/dispatcher/git_history.rs`
- Modify: `tauri/src/dispatcher/commands.rs` only if the command routing whitelist is duplicated there
- Modify: `tauri/src/dispatcher/content_handlers.rs` only if host message forwarding requires explicit result handling

**Interfaces:**
- Mirrors Task 6 semantics and Task 5 wire names exactly.

- [ ] **Step 1: Add failing Rust tests**

Extend the existing `git_history.rs` test module with a temp repo containing a merge commit and workspace subdirectory. Assert:
- parent OIDs and `is_head`,
- workspace-scoped file listing,
- historical file read,
- invalid OID/path rejection,
- no file-system changes after snapshot operations.

- [ ] **Step 2: Run Tauri Git-history tests and confirm failure**

```bash
cargo test --manifest-path tauri/Cargo.toml git_history -- --test-threads=1
```

Expected: FAIL because repository-level functions/commands are missing.

- [ ] **Step 3: Add Rust result structs and parsers**

Add Rust equivalents with `#[serde(rename_all = "camelCase")]`:

```rust
pub struct GitRepositoryCommit {
    pub oid: String,
    pub short_oid: String,
    pub parent_oids: Vec<String>,
    pub author: String,
    pub authored_at: String,
    pub subject: String,
    pub refs: Vec<String>,
    pub is_head: bool,
}

pub struct GitRevisionFile { pub path: String }
pub struct GitRevisionFileSnapshot { pub oid: String, pub path: String, pub source: String }
```

Use the same Git commands and workspace-prefix logic as Electron.

- [ ] **Step 4: Extend `handle_command`**

Include `listRepositoryHistory`, `listRevisionFiles`, and `readRevisionFile` in the match guard and emit `repositoryHistoryResult`, `revisionFilesResult`, and `revisionFileResult` with the same `ok/reason` conventions as the UI types.

- [ ] **Step 5: Run focused Rust tests**

```bash
cargo test --manifest-path tauri/Cargo.toml git_history -- --test-threads=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tauri/src/dispatcher/git_history.rs tauri/src/dispatcher/commands.rs tauri/src/dispatcher/content_handlers.rs
git commit -m "feat(tauri): browse repository revisions"
```

---

### Task 8: Implement Repository History in VS Code and Explicit Chromium Unsupported Parity

**Files:**
- Modify: `vscode/src/core/panelGitHistory.ts`
- Modify: `vscode/src/core/panel.ts` only if command dispatch requires explicit registration
- Modify: `chromium-xtension/src/browser-git-history-host.ts`
- Modify: `tests/unit/vscode/panel-git-history.test.ts`
- Modify: `tests/unit/chromium/browser-git-history-host.test.ts`

**Interfaces:**
- VS Code mirrors Electron/Tauri repository operations.
- Chromium responds to every new command with `unsupported-runtime` and the exact Task 5 result shape.

- [ ] **Step 1: Add failing VS Code adapter tests**

Mock `execFileImpl` and assert exact Git argument sequences for repository log, tree listing, and historical file read. Add parsing coverage for two parents and decorated refs.

- [ ] **Step 2: Add failing Chromium parity tests**

For each command:

```ts
await handleBrowserGitHistoryCommand({ command: 'listRepositoryHistory', requestId: 'r1' }, send);
expect(send).toHaveBeenCalledWith({
  command: 'repositoryHistoryResult', requestId: 'r1', ok: false, commits: [], reason: 'unsupported-runtime',
});
```

Do equivalent checks for revision files and revision file content.

- [ ] **Step 3: Run tests and confirm failure**

```bash
pnpm vitest run tests/unit/vscode/panel-git-history.test.ts tests/unit/chromium/browser-git-history-host.test.ts
```

Expected: FAIL because the new commands are unknown.

- [ ] **Step 4: Implement VS Code operations and dispatch**

Reuse the existing path/OID validators and add the Task 6 Git commands. Extend `handlePanelGitHistoryMessage` with the three new commands and result types.

- [ ] **Step 5: Extend Chromium unsupported command set**

Add the new commands to `GIT_HISTORY_COMMANDS` and return explicit failure messages with empty arrays where required.

- [ ] **Step 6: Run focused tests**

```bash
pnpm vitest run tests/unit/vscode/panel-git-history.test.ts tests/unit/chromium/browser-git-history-host.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add vscode/src/core/panelGitHistory.ts vscode/src/core/panel.ts chromium-xtension/src/browser-git-history-host.ts tests/unit/vscode/panel-git-history.test.ts tests/unit/chromium/browser-git-history-host.test.ts
git commit -m "feat(hosts): expose repository snapshot history"
```

---

### Task 9: Build the History Sidebar Graph and Read-Only Snapshot Browser

**Files:**
- Create: `ui/src/history/gitGraphLayout.ts`
- Create: `ui/src/contexts/RepositorySnapshotContext.tsx`
- Create: `ui/src/components/History/GitCommitGraph.tsx`
- Create: `ui/src/components/History/RepositoryHistoryPanel.tsx`
- Create: `ui/src/components/History/RepositorySnapshotContent.tsx`
- Modify: `ui/src/components/Sidebar/Sidebar.tsx`
- Modify: `ui/src/components/Content/Content.tsx`
- Modify: `ui/src/contexts/HistoryContext.tsx` only to share/reuse the existing `HistoryClient` cleanly
- Modify: `ui/src/AppShell.tsx` to place the snapshot provider inside the existing platform/history providers
- Modify: `ui/src/styles/global/global-history-diff.css`
- Create: `tests/unit/ui/history/git-graph-layout.test.ts`
- Create: `tests/unit/ui/history/repository-history-panel.test.tsx`
- Create: `tests/unit/ui/history/repository-snapshot-context.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface RepositorySnapshotState {
  readonly selectedOid: string | null;
  readonly headOid: string | null;
  readonly files: readonly GitRevisionFile[];
  readonly activePath: string | null;
  readonly activeFile: GitRevisionFileSnapshot | null;
  readonly status: 'idle' | 'loading-history' | 'loading-files' | 'loading-file' | 'ready' | 'error';
  readonly error: string | null;
}
```

- Produces context actions: `loadHistory()`, `selectCommit(oid)`, `openSnapshotFile(path)`, `returnToHead()`.
- Snapshot rendering uses existing `renderMarkdownClientSide(source, path, isMdx, state.settings)` and never writes into `documentSessions` or live `contentTabs`.

- [ ] **Step 1: Write failing graph-layout tests**

Given commits `M -> [A,B]`, `A -> [R]`, `B -> [R]`, assert the layout assigns deterministic lane indexes and edges without negative lanes or dangling unknown-parent edges. Keep the algorithm pure and independent from React.

- [ ] **Step 2: Write failing snapshot-context tests**

With a fake `HistoryClient`, assert:
- selecting a commit requests its file list,
- opening a file requests `oid + path`,
- live `documentSessions` are never mutated,
- `returnToHead()` clears selected OID/files/active snapshot file,
- an unsaved live session remains intact after enter/exit snapshot mode.

- [ ] **Step 3: Write failing History sidebar UI tests**

Assert the panel shows commit subject/SHA/author/time, graph SVG, HEAD marker, and a Back to current HEAD action only while browsing a selected non-live snapshot. Selecting a commit swaps the lower pane from commit list to revision file browser without changing the Git working tree.

- [ ] **Step 4: Run tests and confirm failure**

```bash
pnpm vitest run tests/unit/ui/history/git-graph-layout.test.ts tests/unit/ui/history/repository-history-panel.test.tsx tests/unit/ui/history/repository-snapshot-context.test.tsx
```

Expected: FAIL because no repository snapshot UI/state exists.

- [ ] **Step 5: Implement the graph layout and History sidebar panel**

`RepositoryHistoryPanel` loads commits through `HistoryClient.listRepositoryHistory()`. Render each commit with `GitCommitGraph` plus compact metadata. A commit click calls `selectCommit(commit.oid)`.

When `selectedOid` is active, show revision files from `listRevisionFiles(selectedOid)` and a persistent icon/text action for `returnToHead()`.

- [ ] **Step 6: Implement isolated snapshot content**

When `activeFile` exists, derive render output without touching live app state:

```ts
const rendered = useMemo(
  () => renderMarkdownClientSide(activeFile.source, activeFile.path, /\.mdx$/i.test(activeFile.path), state.settings),
  [activeFile, state.settings.defaultHtmlCodeBlockPreview, state.settings.defaultCsvPreview, state.settings.language],
);
```

Render it through `DocumentSurface` in `rendered` mode with edit/save callbacks omitted/disabled. Add a visible revision badge containing the short OID.

In `Content.tsx`, snapshot content takes precedence over live/split document rendering only while a snapshot file is active. Do not clear or rewrite `state.splitView`, live content tabs, or editor sessions; returning to HEAD reveals the exact prior live view.

- [ ] **Step 7: Wire History tab content**

In `Sidebar.tsx`, render `RepositoryHistoryPanel` only for active `history`. Preserve the existing Files/Search/Bookmarks panels and slide behavior.

- [ ] **Step 8: Run focused tests**

```bash
pnpm vitest run tests/unit/ui/history/git-graph-layout.test.ts tests/unit/ui/history/repository-history-panel.test.tsx tests/unit/ui/history/repository-snapshot-context.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add ui/src/history/gitGraphLayout.ts ui/src/contexts/RepositorySnapshotContext.tsx ui/src/components/History ui/src/components/Sidebar/Sidebar.tsx ui/src/components/Content/Content.tsx ui/src/contexts/HistoryContext.tsx ui/src/AppShell.tsx ui/src/styles/global/global-history-diff.css tests/unit/ui/history/git-graph-layout.test.ts tests/unit/ui/history/repository-history-panel.test.tsx tests/unit/ui/history/repository-snapshot-context.test.tsx
git commit -m "feat(history): browse repository snapshots from sidebar"
```

---

### Task 10: Isolate Split-Pane Rendering by Document

**Files:**
- Modify: `ui/src/components/Content/SplitContent.tsx`
- Modify: `ui/src/split-view/paneSelectors.ts`
- Modify: `ui/src/contexts/appStateModel.ts`
- Modify: `ui/src/contexts/contentTabState.ts`
- Modify: `ui/src/contexts/appStateReducer.ts`
- Modify: `ui/src/contexts/AppStateContext.tsx`
- Create: `ui/src/split-view/documentRenderRevision.ts`
- Modify: `tests/unit/ui/split-view/split-content.test.tsx`
- Modify: `tests/unit/ui/split-view/pane-selectors.test.ts`
- Create: `tests/unit/ui/split-view/split-render-isolation.test.tsx`

**Interfaces:**
- Produces: document-scoped render revision map, keyed by normalized file path.
- Produces: `selectDocumentRenderRevision(state, filePath): number`.
- `SplitPaneView` becomes `memo`-wrapped and receives only pane-local projection/history/render revision.

- [ ] **Step 1: Add failing render-isolation probes**

Instrument `DocumentSurface` through a test mock that increments counters per file path. Render primary `a.md`, secondary `b.md`, then:
- edit primary source,
- change primary scroll,
- activate secondary,
- change secondary scroll.

Assert `b.md` document body count does not change for primary-only source/scroll updates, and `a.md` does not change for secondary-only scroll/activation updates.

Also test same-document split panes: editing the source pane updates the preview only through the chosen debounced/document-scoped revision path, not by remounting both bodies per keystroke.

- [ ] **Step 2: Run tests and confirm failure**

```bash
pnpm vitest run tests/unit/ui/split-view/split-render-isolation.test.tsx tests/unit/ui/split-view/split-content.test.tsx tests/unit/ui/split-view/pane-selectors.test.ts
```

Expected: FAIL because both panes currently receive global `state.renderVersion` and fresh projection objects.

- [ ] **Step 3: Introduce document-scoped render revisions**

Add state such as:

```ts
readonly documentRenderRevisions: Record<string, number>;
```

and helper:

```ts
export function bumpDocumentRenderRevision(
  revisions: Record<string, number>, filePath: string,
): Record<string, number> {
  const key = normalizePathKey(filePath);
  return { ...revisions, [key]: (revisions[key] ?? 0) + 1 };
}
```

Bump only when that document's rendered content/source meaningfully changes. Do not bump for active pane, opposite-pane scroll, or unrelated file updates.

- [ ] **Step 4: Make pane projections stable and minimal**

Split projection selection into pane shell state and document render payload if needed. Memoize `SplitPaneView` with a comparator that checks:
- `filePath`, `mode`, and that pane's scroll value for shell behavior,
- document source/content/session identity for that file,
- pane-local history entry,
- document-scoped render revision.

Do not pass global `state.renderVersion` into both panes.

- [ ] **Step 5: Debounce same-document rendered preview updates**

Use a short deterministic debounce (150 ms) only for a rendered pane mirroring an actively edited copy of the same document. The editor pane still receives source immediately. Clear the timer on unmount/file change and flush after save so persisted content is visible without waiting.

- [ ] **Step 6: Run focused tests**

```bash
pnpm vitest run tests/unit/ui/split-view/split-render-isolation.test.tsx tests/unit/ui/split-view/split-content.test.tsx tests/unit/ui/split-view/pane-selectors.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/Content/SplitContent.tsx ui/src/split-view ui/src/contexts/appStateModel.ts ui/src/contexts/contentTabState.ts ui/src/contexts/appStateReducer.ts ui/src/contexts/AppStateContext.tsx tests/unit/ui/split-view
git commit -m "perf(split-view): isolate pane document rendering"
```

---

### Task 11: Update Coverage, Documentation, Changelog, and Run Final Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md` if user-facing feature summary mentions editing/history availability
- Modify: `docs/instructions/03-features/03-sidebar-tree-and-scope.md`
- Modify: `docs/instructions/04-runtimes/06-runtime-parity.md`
- Modify: `docs/instructions/05-reference/01-ui-to-host-command-catalog.md`
- Modify: `docs/instructions/05-reference/02-host-to-ui-message-catalog.md`
- Modify: `docs/instructions/05-reference/07-current-app-state.md`
- Modify: `docs/instructions/06-quality/07-release-acceptance-matrix.md`
- Modify: `tests/manifest/editor-git-split-coverage-manifest.ts`
- Modify: `tests/manifest/coverage-manifest.test.ts`
- Modify: `.github/workflows/test.yml` only if new test paths are not already covered by existing globs/scripts

**Interfaces:**
- Documentation must describe the exact final settings defaults and host capability matrix.

- [ ] **Step 1: Add/adjust manifest coverage entries first**

Map every new production file to at least one focused test in `editor-git-split-coverage-manifest.ts`, then run:

```bash
pnpm vitest run tests/manifest/coverage-manifest.test.ts
```

Expected: PASS after all new files are represented.

- [ ] **Step 2: Update user and protocol documentation**

Document:
- Settings > Features and the OFF-by-default Markdown editor gate.
- capability-aware History sidebar toggle.
- icon-only sidebar tabs when more than three are visible.
- repository history graph and read-only snapshot browsing without checkout.
- Back to current HEAD behavior.
- three new UI-to-host commands and three result messages.
- Electron/Tauri/VS Code support and Chromium unsupported parity.
- split-view render isolation semantics.

Update Unreleased changelog under Added/Changed/Fixed rather than creating a new release section.

- [ ] **Step 3: Run the complete focused editor/history/split test set**

```bash
pnpm vitest run \
  tests/unit/ui/editor \
  tests/unit/ui/history \
  tests/unit/ui/split-view \
  tests/unit/ui/components/settings-features-panel.test.tsx \
  tests/unit/ui/components/sidebar-tabs-history.test.tsx \
  tests/unit/electron/document-history.test.ts \
  tests/unit/vscode/panel-git-history.test.ts \
  tests/unit/chromium/browser-git-history-host.test.ts \
  tests/manifest/coverage-manifest.test.ts
node --test tests/node/history-panel-layout-contract.test.mjs tests/node/sidebar-focus-search-layout.test.mjs tests/node/es2020-array-compat-contract.test.mjs tests/node/export-runtime-build-config-contract.test.mjs
cargo test --manifest-path tauri/Cargo.toml git_history -- --test-threads=1
```

Expected: all commands exit 0 with zero failures.

- [ ] **Step 4: Run full repository verification**

```bash
pnpm test
pnpm run build:ui:tauri
pnpm run test:tauri
```

Expected: all commands exit 0. `build:ui:tauri` must not emit the prior ES2020 `.at()` errors or redundant `inlineDynamicImports` warning.

- [ ] **Step 5: Inspect the final branch diff against main**

```bash
git fetch origin
git diff --check origin/main...HEAD
git status --short
git log --oneline --decorate origin/main..HEAD
```

Expected:
- `git diff --check` prints nothing and exits 0.
- working tree is clean.
- commits are limited to this feature branch's editor/history work plus the approved design/plan docs.

- [ ] **Step 6: Commit documentation**

```bash
git add CHANGELOG.md README.md docs/instructions tests/manifest .github/workflows/test.yml
git commit -m "docs: document repository history and feature controls"
```

- [ ] **Step 7: Re-run final verification after the documentation commit**

```bash
pnpm test
pnpm run build:ui:tauri
pnpm run test:tauri
git diff --check origin/main...HEAD
```

Expected: all commands exit 0 and `git diff --check` has no output.
