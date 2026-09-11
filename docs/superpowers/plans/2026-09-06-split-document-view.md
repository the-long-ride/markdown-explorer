# Split Document View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a resizable two-pane document workspace where each pane can independently display a file and choose its own view mode while sharing one editable working copy per file.

**Architecture:** Split pane state is view state, not document state. Pane records reference file paths and modes; editable source continues to live in the shared `documentSessions` map created by the editing plan. Extract the current document presentation into a reusable document surface so single-pane and split-pane views use the same Markdown rendering, editing, bookmark/media, and accessibility behavior.

**Tech Stack:** React 19, TypeScript, existing content-tab/session state, native pointer/keyboard events, existing Markdown Explorer CSS/theming. Zero new production dependencies.

**Spec:** `docs/superpowers/specs/2026-09-06-editor-git-history-split-view-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-06-markdown-editing-save-core.md`

## Global Constraints

- Maximum two panes in the first release.
- Side-by-side split only; no vertical split.
- Each pane owns independent file selection, mode, and scroll position.
- Both panes showing the same file share the same `EditableDocumentSession` and dirty state.
- Active pane receives pane-scoped keyboard/navigation actions.
- Opening a split must not create a duplicate logical content tab solely for presentation.
- Plain/Inline/Rendered modes must work immediately; Git Revision/Diff mode entry points remain capability-gated until the Git plan is implemented.
- Divider is pointer-draggable and keyboard-resizable with accessible semantics.
- Zero new production dependencies.

---

## File Structure

- Create `ui/src/split-view/paneState.ts` — pure pane model and transitions.
- Create `ui/src/split-view/paneSelectors.ts` — resolve pane file/content/session projections.
- Create `ui/src/components/Content/DocumentSurface.tsx` — reusable document body extracted from current single-view content.
- Create `ui/src/components/SplitView/SplitDocumentView.tsx` — two-pane shell.
- Create `ui/src/components/SplitView/DocumentPane.tsx` — pane header/mode controls/document surface.
- Create `ui/src/components/SplitView/SplitDivider.tsx` — accessible resizing.
- Create `ui/src/styles/global/global-split-document-view.css`.
- Modify `ui/src/contexts/appStateModel.ts` and `AppStateContext.tsx` — split state/actions.
- Modify `ui/src/AppView.tsx`/`Content.tsx` — choose single vs split surface.
- Modify sidebar/content-tab/context menus to add Open in split/Move to other pane.
- Modify keyboard routing to target active pane.

---

### Task 1: Define pure two-pane state and transitions

**Files:**
- Create: `ui/src/split-view/paneState.ts`
- Create: `ui/src/split-view/paneSelectors.ts`
- Modify: `ui/src/contexts/appStateModel.ts`
- Test: `tests/unit/ui/split-view/pane-state.test.ts`

**Interfaces:**
- Produces `PaneId = 'primary' | 'secondary'`.
- Produces `DocumentViewMode = 'rendered' | 'inline-edit' | 'plain' | 'git-revision' | 'diff'`.
- Produces `DocumentPaneState`, `SplitViewState`.
- Produces transitions `openSplit`, `closeSplit`, `setPaneFile`, `setPaneMode`, `setActivePane`, `swapPanes`, `setSplitRatio`, `setPaneScrollTop`.

- [ ] **Step 1: Write failing pure-state tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  closeSplit,
  createSplitViewState,
  openSplit,
  setPaneFile,
  setPaneMode,
  swapPanes,
} from '../../../../ui/src/split-view/paneState';

describe('split pane state', () => {
  it('opens a secondary pane without changing the primary file', () => {
    const initial = createSplitViewState('/docs/a.md');
    const next = openSplit(initial, '/docs/b.md');
    expect(next.enabled).toBe(true);
    expect(next.primary.filePath).toBe('/docs/a.md');
    expect(next.secondary.filePath).toBe('/docs/b.md');
  });

  it('keeps independent modes', () => {
    let state = openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md');
    state = setPaneMode(state, 'primary', 'plain');
    state = setPaneMode(state, 'secondary', 'rendered');
    expect(state.primary.mode).toBe('plain');
    expect(state.secondary.mode).toBe('rendered');
  });

  it('swaps complete pane view state', () => {
    const state = setPaneFile(openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md'), 'secondary', '/docs/c.md');
    const next = swapPanes(state);
    expect(next.primary.filePath).toBe('/docs/c.md');
    expect(next.secondary.filePath).toBe('/docs/a.md');
  });

  it('closing split keeps the selected active pane as primary', () => {
    const state = { ...openSplit(createSplitViewState('/docs/a.md'), '/docs/b.md'), activePane: 'secondary' as const };
    expect(closeSplit(state).primary.filePath).toBe('/docs/b.md');
  });
});
```

- [ ] **Step 2: Run test and verify failure**

```bash
pnpm vitest run tests/unit/ui/split-view/pane-state.test.ts
```

Expected: FAIL because split state does not exist.

- [ ] **Step 3: Implement immutable pane state**

Use these core types:

```ts
export type PaneId = 'primary' | 'secondary';
export type DocumentViewMode = 'rendered' | 'inline-edit' | 'plain' | 'git-revision' | 'diff';

export interface DocumentPaneState {
  readonly id: PaneId;
  readonly filePath: string | null;
  readonly mode: DocumentViewMode;
  readonly scrollTop: number;
  readonly revision?: string;
  readonly diffKey?: string;
}

export interface SplitViewState {
  readonly enabled: boolean;
  readonly activePane: PaneId;
  readonly ratio: number;
  readonly primary: DocumentPaneState;
  readonly secondary: DocumentPaneState;
}
```

Clamp ratio to `0.25..0.75`. `closeSplit` promotes the active secondary pane when secondary was active; otherwise it keeps primary. Add `splitView` to `AppState` initialized from the current file projection but do not persist it across application restart in the first release.

- [ ] **Step 4: Run split state tests**

```bash
pnpm vitest run tests/unit/ui/split-view/pane-state.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit pane state**

```bash
git add ui/src/split-view/paneState.ts ui/src/split-view/paneSelectors.ts ui/src/contexts/appStateModel.ts tests/unit/ui/split-view/pane-state.test.ts
git commit -m "feat(split-view): add two-pane state model"
```

---

### Task 2: Extract a reusable document surface from the single-document view

**Files:**
- Create: `ui/src/components/Content/DocumentSurface.tsx`
- Modify: `ui/src/components/Content/ContentMainView.tsx`
- Modify: `ui/src/components/Content/Content.tsx`
- Test: `tests/unit/ui/components/document-surface.test.tsx`
- Regression: existing Content/Bookmark/Media tests

**Interfaces:**
- Produces `DocumentSurfaceProps` containing a file/document projection instead of the whole global `AppState`.
- Existing single-pane Content consumes `DocumentSurface` with the current active file.
- Later `DocumentPane` consumes the same component with a pane projection.

- [ ] **Step 1: Write a failing parity test**

```tsx
it('renders the same markdown body through DocumentSurface', () => {
  render(<DocumentSurface document={fixtureDocument('# Hello')} mode="rendered" />);
  expect(screen.getByRole('heading', { name: /hello/i })).toBeInTheDocument();
});
```

Add assertions that the surface still exposes current-file stale notice, TOC/frontmatter, media click handling, bookmark hooks, and rendered source attributes when supplied through props.

- [ ] **Step 2: Run focused Content tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/components/document-surface.test.tsx
```

Expected: FAIL because the reusable surface does not exist.

- [ ] **Step 3: Extract only the document-specific branch**

Define a narrow projection:

```ts
export interface DocumentSurfaceModel {
  readonly filePath: string;
  readonly relativePath: string;
  readonly contentHtml: string;
  readonly markdownSource: string | null;
  readonly sourceDocumentText: string | null;
  readonly frontmatter: Record<string, string>;
  readonly toc: readonly TocEntry[];
  readonly previewInfo: DocumentPreviewInfo | null;
  readonly stale: boolean;
}
```

Move the rendered document/HTML-preview/plain/inline selection into `DocumentSurface`. Leave workspace-empty/loading/unavailable screens in `ContentMainView`; do not duplicate those screens per pane.

Single-pane `Content.tsx` constructs `DocumentSurfaceModel` from the existing active tab/current state so behavior remains unchanged.

- [ ] **Step 4: Run Content regression tests**

```bash
pnpm vitest run --project ui tests/unit/ui/components/document-surface.test.tsx tests/unit/ui/components
```

Expected: PASS with no single-pane behavior change.

- [ ] **Step 5: Commit the extraction**

```bash
git add ui/src/components/Content/DocumentSurface.tsx ui/src/components/Content/ContentMainView.tsx ui/src/components/Content/Content.tsx tests/unit/ui/components/document-surface.test.tsx
git commit -m "refactor(content): extract reusable document surface"
```

---

### Task 3: Render the resizable two-pane shell

**Files:**
- Create: `ui/src/components/SplitView/SplitDocumentView.tsx`
- Create: `ui/src/components/SplitView/DocumentPane.tsx`
- Create: `ui/src/components/SplitView/SplitDivider.tsx`
- Create: `ui/src/styles/global/global-split-document-view.css`
- Modify: `ui/src/styles/global.css`
- Modify: `ui/src/AppView.tsx`
- Test: `tests/unit/ui/split-view/split-document-view.test.tsx`
- Test: `tests/unit/ui/split-view/split-divider.test.tsx`

**Interfaces:**
- `SplitDocumentView({ state, onActivatePane, onRatioChange, onCloseSplit, onSwapPanes })`.
- `DocumentPane` resolves file/tab/session through `paneSelectors` and renders `DocumentSurface`.
- `SplitDivider` emits a clamped ratio.

- [ ] **Step 1: Write failing layout/divider tests**

```tsx
it('renders two independently labelled pane regions', () => {
  render(<SplitDocumentView {...fixtureProps()} />);
  expect(screen.getByRole('region', { name: /primary document pane/i })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: /secondary document pane/i })).toBeInTheDocument();
});

it('keyboard arrows resize the separator', async () => {
  render(<SplitDivider ratio={0.5} onChange={onChange} />);
  const separator = screen.getByRole('separator');
  separator.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(onChange).toHaveBeenCalledWith(0.52);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/split-view/split-document-view.test.tsx tests/unit/ui/split-view/split-divider.test.tsx
```

Expected: FAIL because split components do not exist.

- [ ] **Step 3: Implement shell, active-pane indication, and divider**

Use CSS grid:

```tsx
<div
  className="split-document-view"
  style={{ gridTemplateColumns: `${ratio * 100}% 6px ${100 - ratio * 100}%` }}
>
  <DocumentPane pane={state.primary} active={state.activePane === 'primary'} />
  <SplitDivider ratio={ratio} onChange={onRatioChange} />
  <DocumentPane pane={state.secondary} active={state.activePane === 'secondary'} />
</div>
```

The separator uses `role="separator"`, `aria-orientation="vertical"`, `aria-valuemin="25"`, `aria-valuemax="75"`, and `aria-valuenow`. Pointer drag calculates ratio from the split container bounding box; keyboard Left/Right changes by `0.02`, Home sets `0.25`, End sets `0.75`.

- [ ] **Step 4: Run layout tests and UI style contract**

```bash
pnpm vitest run tests/unit/ui/split-view/split-document-view.test.tsx tests/unit/ui/split-view/split-divider.test.tsx
pnpm run lint:ui-styles
```

Expected: PASS.

- [ ] **Step 5: Commit split shell**

```bash
git add ui/src/components/SplitView ui/src/styles/global/global-split-document-view.css ui/src/styles/global.css ui/src/AppView.tsx tests/unit/ui/split-view
git commit -m "feat(split-view): render resizable document panes"
```

---

### Task 4: Add split actions and active-pane navigation

**Files:**
- Modify: `ui/src/contexts/AppStateContext.tsx`
- Modify: `ui/src/components/Content/ContentTabs.tsx`
- Modify: `ui/src/components/Content/ContentTabItem.tsx`
- Modify: sidebar row/context-menu components
- Modify: `ui/src/components/shared/LinkContextMenu.tsx` if link-open-in-other-pane is exposed there
- Modify: `ui/src/hooks/useKeyboard.ts` and `keyboardUtils.ts`
- Test: `tests/unit/ui/split-view/split-actions.test.tsx`
- Test: `tests/unit/ui/split-view/active-pane-navigation.test.tsx`

**Interfaces:**
- Context actions: `openInSplit(filePath)`, `moveToOtherPane(filePath)`, `swapSplitPanes()`, `closeSplitView()`, `activatePane(paneId)`.
- Navigation resolves `targetPane = split.enabled ? split.activePane : 'primary'`.

- [ ] **Step 1: Write failing action/navigation tests**

```tsx
it('Open in split keeps the current document primary and opens target secondary', async () => {
  const { state, actions } = renderHarness('/docs/a.md');
  actions.openInSplit('/docs/b.md');
  expect(state().splitView.primary.filePath).toBe('/docs/a.md');
  expect(state().splitView.secondary.filePath).toBe('/docs/b.md');
});

it('link navigation changes only the active pane', () => {
  const next = navigatePane(splitFixture('a.md', 'b.md', 'secondary'), 'c.md');
  expect(next.primary.filePath).toBe('a.md');
  expect(next.secondary.filePath).toBe('c.md');
});
```

- [ ] **Step 2: Run focused tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/split-view/split-actions.test.tsx tests/unit/ui/split-view/active-pane-navigation.test.tsx
```

Expected: FAIL because actions still target only global `currentFile`.

- [ ] **Step 3: Implement pane-scoped navigation and menus**

When split is disabled, existing navigation stays unchanged. When enabled, link/sidebar/content-tab navigation updates the active pane file and loads/activates the logical content tab as needed for source availability, but must not create a second tab for the same file.

Expose menu actions:

```text
Open in split
Move to other pane
Swap panes
Close split
```

Only show Move/Swap/Close when split is active. `Open in split` replaces the secondary pane when one already exists after applying the existing dirty-document replacement guard.

- [ ] **Step 4: Run navigation/menu/keyboard tests**

```bash
pnpm vitest run tests/unit/ui/split-view tests/unit/ui/hooks/useKeyboard.test.ts
```

Expected: PASS; Back/Forward and normal file navigation act on the active pane only while split is active.

- [ ] **Step 5: Commit split actions**

```bash
git add ui/src/contexts/AppStateContext.tsx ui/src/components/Content/ContentTabs.tsx ui/src/components/Content/ContentTabItem.tsx ui/src/components/Sidebar ui/src/components/shared/LinkContextMenu.tsx ui/src/hooks/useKeyboard.ts ui/src/hooks/keyboardUtils.ts tests/unit/ui/split-view
git commit -m "feat(split-view): route navigation through active pane"
```

---

### Task 5: Add independent pane modes, scroll memory, and shared-session guarantees

**Files:**
- Modify: `ui/src/components/SplitView/DocumentPane.tsx`
- Modify: `ui/src/components/Content/DocumentSurface.tsx`
- Modify: `ui/src/split-view/paneSelectors.ts`
- Modify: `ui/src/contexts/AppStateContext.tsx`
- Test: `tests/unit/ui/split-view/pane-modes.test.tsx`
- Test: `tests/unit/ui/split-view/shared-session.test.tsx`
- Test: `tests/unit/ui/split-view/pane-scroll.test.tsx`

**Interfaces:**
- Pane mode controls call `setPaneMode(paneId, mode)`.
- `git-revision` and `diff` remain disabled/hidden until runtime history capability is provided by the next plan.

- [ ] **Step 1: Write failing mode/session/scroll tests**

```tsx
it('shows Plain on left and Rendered on right for the same file using one source', async () => {
  render(<SplitHarness primary={{ file: 'a.md', mode: 'plain' }} secondary={{ file: 'a.md', mode: 'rendered' }} />);
  await userEvent.type(screen.getByLabelText(/primary.*markdown source/i), ' changed');
  expect(screen.getByRole('region', { name: /secondary document pane/i })).toHaveTextContent('changed');
  expect(getDocumentSessionCountFor('a.md')).toBe(1);
});

it('restores each pane scroll position when switching active pane', () => {
  const next = setPaneScrollTop(setPaneScrollTop(state, 'primary', 100), 'secondary', 450);
  expect(next.primary.scrollTop).toBe(100);
  expect(next.secondary.scrollTop).toBe(450);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/split-view/pane-modes.test.tsx tests/unit/ui/split-view/shared-session.test.tsx tests/unit/ui/split-view/pane-scroll.test.tsx
```

Expected: FAIL because panes do not yet own mode/scroll controls end-to-end.

- [ ] **Step 3: Implement independent modes and pane scroll handling**

`DocumentPane` obtains the session by normalized `filePath`; never copy the session into pane state. Plain and Inline Edit update the same `setWorkingDocumentSource(filePath, source)` action from the editing plan. Rendered mode consumes the current working render.

Each pane owns a scroll container ref. On scroll, persist a throttled `scrollTop` into pane state. On pane file/mode activation, restore that pane's stored position after layout. When closing split, copy the promoted pane scroll position into the existing single-document reading-memory path.

- [ ] **Step 4: Run pane and editing integration tests**

```bash
pnpm vitest run tests/unit/ui/split-view tests/unit/ui/editor tests/unit/ui/components/plain-markdown-editor.test.tsx tests/unit/ui/components/inline-markdown-editor.test.tsx
```

Expected: PASS; same-file panes cannot diverge.

- [ ] **Step 5: Commit independent pane modes**

```bash
git add ui/src/components/SplitView/DocumentPane.tsx ui/src/components/Content/DocumentSurface.tsx ui/src/split-view/paneSelectors.ts ui/src/contexts/AppStateContext.tsx tests/unit/ui/split-view
git commit -m "feat(split-view): support independent pane modes and scroll"
```

---

### Task 6: Localize, document, and fully verify Split View

**Files:**
- Modify: translation type/data files for all nine locales
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: shortcut/user manual/current-state docs
- Add/update Split View use-case/feature docs
- Modify coverage/manifest tests

**Interfaces:**
- Documents the split actions and mode capability rules already implemented.

- [ ] **Step 1: Add failing localization/documentation contract assertions**

Assert every locale contains labels for `Open in split`, `Move to other pane`, `Swap panes`, `Close split`, primary/secondary pane accessible labels, and mode names.

- [ ] **Step 2: Run contracts and verify failure**

```bash
pnpm run test:translations
pnpm run test:contracts
pnpm run test:node
```

Expected: FAIL until localization and docs are synchronized.

- [ ] **Step 3: Update all nine locales and product docs**

Document: two panes maximum, horizontal only, active-pane navigation, independent mode/scroll state, same-file shared working copy, and history modes capability-gated until Git support is available.

- [ ] **Step 4: Run full verification for this plan**

```bash
pnpm run test:ui
pnpm run test:electron
pnpm run test:vscode
pnpm run test:chromium
pnpm run test:contracts
pnpm run test:node
pnpm run test:translations
pnpm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit docs/localization**

```bash
git add README.md CHANGELOG.md docs ui/src/contexts tests
git commit -m "docs: document split document view"
```
