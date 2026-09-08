# Git History and Diff Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add document-focused local Git history, read-only historical revision viewing, dependency-free source/rendered diffs, and Git Revision/Diff pane modes for Electron, Tauri, and VS Code.

**Architecture:** Git execution lives only in trusted desktop/VS Code hosts and always uses structured argument arrays with the active repository as working directory. Hosts return commit metadata and source snapshots; the shared UI owns history presentation and diff computation. Browser runtimes explicitly report Git as unsupported while normal reading/editing remains unaffected.

**Tech Stack:** Node built-in `child_process.execFile`, Rust `std::process::Command`, React 19, TypeScript, existing Markdown parser/renderer. Zero new production dependencies.

**Spec:** `docs/superpowers/specs/2026-09-06-editor-git-history-split-view-design.md`

**Depends on:**
- `docs/superpowers/plans/2026-09-06-markdown-editing-save-core.md`
- `docs/superpowers/plans/2026-09-06-split-document-view.md`

## Global Constraints

- Git features run only on Electron, Tauri, and VS Code.
- Use the user's installed local `git` executable; add no Git library/package.
- Never execute Git through a shell string.
- First release is read-only: no stage, commit, checkout, reset, restore, stash, branch, merge, or repository mutation.
- Git operations are restricted to the active workspace/repository and requested document.
- Historical revisions are always read-only.
- Chromium/Web explicitly report Git unsupported.
- Source and rendered diff computation uses shared local code with zero new production dependencies.
- Git failure must not affect editing or ordinary Markdown reading.

---

## File Structure

### Shared history/diff domain

- Create `ui/src/history/contracts.ts` — Git capability, revision, comparison models.
- Create `ui/src/history/historyClient.ts` — correlated bridge requests.
- Create `ui/src/history/lineDiff.ts` — dependency-free Myers line diff.
- Create `ui/src/history/diffRanges.ts` — line changes to source character ranges for rendered highlighting.
- Create `ui/src/components/History/DocumentHistoryPanel.tsx` — history list/actions.
- Create `ui/src/components/History/GitRevisionView.tsx` — read-only historical Markdown render.
- Create `ui/src/components/History/DocumentDiffView.tsx` — Source/Rendered toggle.
- Create `ui/src/components/History/SourceDiffView.tsx`.
- Create `ui/src/components/History/RenderedDiffView.tsx`.
- Create `ui/src/styles/global/global-history-diff.css`.

### Protocol/state

- Modify `ui/src/types/webviewMessages.ts` and `hostMessages.ts`.
- Modify `ui/src/contexts/appStateModel.ts`/`AppStateContext.tsx` for Git capability/results.
- Modify `ui/src/components/Topbar/Topbar.tsx`/More Actions to expose History.
- Modify `ui/src/components/SplitView/DocumentPane.tsx` and pane selectors to enable Git Revision/Diff modes.

### Runtime hosts

- Create `electron/git/document-history.js`; modify Electron command router.
- Create `vscode/src/core/panelGitHistory.ts`; modify `vscode/src/core/panel.ts`.
- Create `tauri/src/dispatcher/git_history.rs`; modify dispatcher/message registration.
- Modify Chromium/Web message routers to return `unsupported-runtime` for Git capability and reject history reads safely.

---

### Task 1: Add Git history protocol and shared client contracts

**Files:**
- Create: `ui/src/history/contracts.ts`
- Create: `ui/src/history/historyClient.ts`
- Modify: `ui/src/types/webviewMessages.ts`
- Modify: `ui/src/types/hostMessages.ts`
- Modify: `ui/src/contexts/appStateModel.ts`
- Test: `tests/unit/ui/history/history-client.test.ts`
- Test: protocol parity tests

**Interfaces:**

```ts
export interface GitCapability {
  readonly supported: boolean;
  readonly repositoryRoot?: string;
  readonly reason?: 'unsupported-runtime' | 'git-unavailable' | 'not-repository';
}

export interface GitRevisionSummary {
  readonly oid: string;
  readonly shortOid: string;
  readonly author: string;
  readonly authoredAt: string;
  readonly subject: string;
  readonly path: string;
}

export interface GitRevisionSnapshot {
  readonly oid: string;
  readonly path: string;
  readonly source: string;
}

export type GitCompareSide =
  | { readonly kind: 'revision'; readonly oid: string; readonly path: string }
  | { readonly kind: 'current'; readonly path: string };
```

- [ ] **Step 1: Write failing correlated-client tests**

```ts
it('resolves only the matching history request id', async () => {
  const pending = client.listDocumentHistory('/docs/a.md');
  bridge.emit({ command: 'documentHistoryResult', requestId: 'wrong', ok: true, revisions: [] });
  expect(isSettled(pending)).toBe(false);
  bridge.emit({ command: 'documentHistoryResult', requestId: bridge.lastRequestId, ok: true, revisions: [revision] });
  await expect(pending).resolves.toEqual([revision]);
});

it('normalizes unsupported Git capability without throwing', async () => {
  const pending = client.getCapability();
  bridge.emit({ command: 'gitCapabilityResult', requestId: bridge.lastRequestId, capability: { supported: false, reason: 'unsupported-runtime' } });
  await expect(pending).resolves.toEqual({ supported: false, reason: 'unsupported-runtime' });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/history/history-client.test.ts tests/contracts/host-message-parity.test.ts
```

Expected: FAIL because Git commands/results do not exist.

- [ ] **Step 3: Add exact message contracts and client**

Add UI-to-host messages:

```ts
export interface GetGitCapabilityMessage { readonly command: 'getGitCapability'; readonly requestId: string; }
export interface ListDocumentHistoryMessage { readonly command: 'listDocumentHistory'; readonly requestId: string; readonly filePath: string; readonly limit?: number; }
export interface ReadGitRevisionMessage { readonly command: 'readGitRevision'; readonly requestId: string; readonly oid: string; readonly path: string; }
export interface CompareGitRevisionsMessage { readonly command: 'compareGitRevisions'; readonly requestId: string; readonly left: GitCompareSide; readonly right: GitCompareSide; }
```

Add host responses:

```ts
export interface GitCapabilityResultMessage { readonly command: 'gitCapabilityResult'; readonly requestId: string; readonly capability: GitCapability; }
export interface DocumentHistoryResultMessage { readonly command: 'documentHistoryResult'; readonly requestId: string; readonly ok: boolean; readonly revisions: readonly GitRevisionSummary[]; readonly reason?: string; }
export interface GitRevisionResultMessage { readonly command: 'gitRevisionResult'; readonly requestId: string; readonly ok: boolean; readonly snapshot?: GitRevisionSnapshot; readonly reason?: string; }
export interface GitComparisonResultMessage { readonly command: 'gitComparisonResult'; readonly requestId: string; readonly ok: boolean; readonly leftSource?: string; readonly rightSource?: string; readonly leftLabel?: string; readonly rightLabel?: string; readonly reason?: string; }
```

`historyClient.ts` owns request IDs and listener cleanup. It must reject/return typed failures without mutating document editor sessions.

- [ ] **Step 4: Run client/protocol tests**

```bash
pnpm vitest run tests/unit/ui/history/history-client.test.ts tests/contracts/host-message-parity.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Git contracts/client**

```bash
git add ui/src/history/contracts.ts ui/src/history/historyClient.ts ui/src/types/webviewMessages.ts ui/src/types/hostMessages.ts ui/src/contexts/appStateModel.ts tests/unit/ui/history/history-client.test.ts tests/contracts/host-message-parity.test.ts
git commit -m "feat(history): add local git history contracts"
```

---

### Task 2: Implement the Electron local Git adapter

**Files:**
- Create: `electron/git/document-history.js`
- Modify: `electron/core/runtime-command-handlers.js`
- Test: `tests/unit/electron/document-history.test.ts`

**Interfaces:**
- Produces `detectGitCapability(workspacePath)`.
- Produces `listDocumentHistory({ workspacePath, filePath, limit })`.
- Produces `readGitRevision({ workspacePath, oid, path })`.
- Produces `compareGitSources({ workspacePath, left, right })`.

- [ ] **Step 1: Write failing adapter tests with a temporary Git repository**

```ts
it('lists revisions newest first and preserves renamed historical paths', async () => {
  const repo = await createTempGitRepo();
  await commitFile(repo, 'old.md', '# one', 'first');
  await renameAndCommit(repo, 'old.md', 'new.md', 'rename');
  const revisions = await listDocumentHistory({ workspacePath: repo, filePath: path.join(repo, 'new.md'), limit: 20 });
  expect(revisions.map((item) => item.subject)).toEqual(['rename', 'first']);
  expect(revisions[0].path).toBe('new.md');
  expect(revisions[1].path).toBe('old.md');
});

it('rejects an oid that was not returned/valid', async () => {
  await expect(readGitRevision({ workspacePath: repo, oid: 'HEAD;rm -rf .', path: 'a.md' })).rejects.toThrow(/invalid revision/i);
});
```

- [ ] **Step 2: Run Electron Git tests and verify failure**

```bash
pnpm vitest run tests/unit/electron/document-history.test.ts
```

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement structured `git` execution with no shell**

Use only `execFile`/argument arrays:

```js
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;

async function runGit(cwd, args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    windowsHide: true,
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    encoding: 'utf8',
  });
  return stdout;
}
```

Capability:

```text
git -C <workspace> rev-parse --show-toplevel
```

History:

```text
git -C <repo> log --follow --format=%H%x1f%an%x1f%aI%x1f%s%x1e --name-status -n <limit> -- <repo-relative-path>
```

Parse record separator `\x1e` and field separator `\x1f`. Track path backwards through `R<score> old new` name-status lines: each commit's snapshot path is the currently tracked path; after a rename record whose `new` equals the tracked path, set the tracked path to `old` for older commits.

Validate requested OIDs using full object IDs only:

```js
const FULL_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
```

Read snapshots using argument array `['-C', repo, 'show', `${oid}:${gitPath}`]`. Resolve current-side comparisons by reading the validated workspace file directly; do not call `git diff` for unsaved UI sources.

- [ ] **Step 4: Run adapter tests**

```bash
pnpm vitest run tests/unit/electron/document-history.test.ts
```

Expected: PASS for Git missing, non-repository, normal history, rename-following, snapshot read, invalid OID, outside-workspace path, and output-limit failure.

- [ ] **Step 5: Commit Electron Git support**

```bash
git add electron/git/document-history.js electron/core/runtime-command-handlers.js tests/unit/electron/document-history.test.ts
git commit -m "feat(history): read local git history on electron"
```

---

### Task 3: Implement VS Code/Tauri Git adapters and explicit browser unsupported responses

**Files:**
- Create: `vscode/src/core/panelGitHistory.ts`
- Modify: `vscode/src/core/panel.ts`
- Create: `tauri/src/dispatcher/git_history.rs`
- Modify: `tauri/src/dispatcher.rs`
- Modify: `tauri/src/host_message.rs`
- Modify: `chromium-xtension/src/chrome-host.ts`
- Modify: `website-app/src/web-host.ts`
- Test: `tests/unit/vscode/panel-git-history.test.ts`
- Test: Rust tests in `tauri/src/dispatcher/git_history.rs`
- Test: browser capability tests

**Interfaces:**
- Same normalized response models as Task 2.
- Chromium/Web implement `getGitCapability` as `{ supported: false, reason: 'unsupported-runtime' }` and safely reject the other three Git commands.

- [ ] **Step 1: Write failing runtime parity tests**

VS Code test injects `execFile` and asserts argument arrays/cwd. Rust test creates a temp Git repository and asserts history/snapshot behavior. Browser test sends `getGitCapability` and expects `gitCapabilityResult` with `unsupported-runtime`.

- [ ] **Step 2: Run runtime tests and verify failure**

```bash
pnpm vitest run tests/unit/vscode/panel-git-history.test.ts tests/unit/chromium tests/unit/website
cargo test --manifest-path tauri/Cargo.toml git_history -- --test-threads=1
```

Expected: FAIL until adapters/routes are implemented.

- [ ] **Step 3: Implement VS Code and Rust process adapters**

VS Code uses Node `execFile` exactly like Electron, with the active workspace folder as the input boundary.

Tauri uses no shell:

```rust
fn run_git(repo: &Path, args: &[&str]) -> Result<String, GitHistoryError> {
    let output = std::process::Command::new("git")
        .current_dir(repo)
        .args(args)
        .output()?;
    if !output.status.success() {
        return Err(GitHistoryError::CommandFailed(String::from_utf8_lossy(&output.stderr).into_owned()));
    }
    Ok(String::from_utf8(output.stdout)?)
}
```

Use the same separators, full-OID validation, path-tracking algorithm, and output-size guard as Electron. Keep the normalized JSON message shapes identical.

Browser routers must never attempt process execution; respond unsupported immediately.

- [ ] **Step 4: Run runtime/parity tests**

```bash
pnpm vitest run tests/unit/vscode/panel-git-history.test.ts tests/unit/chromium tests/unit/website tests/contracts/host-message-parity.test.ts tests/contracts/tauri-host-message-parity.test.ts
cargo test --manifest-path tauri/Cargo.toml git_history -- --test-threads=1
```

Expected: PASS.

- [ ] **Step 5: Commit runtime Git parity**

```bash
git add vscode/src/core/panelGitHistory.ts vscode/src/core/panel.ts tauri/src/dispatcher/git_history.rs tauri/src/dispatcher.rs tauri/src/host_message.rs chromium-xtension/src/chrome-host.ts website-app/src/web-host.ts tests
git commit -m "feat(history): add local git history runtime parity"
```

---

### Task 4: Add document History panel and read-only revision viewing

**Files:**
- Create: `ui/src/components/History/DocumentHistoryPanel.tsx`
- Create: `ui/src/components/History/GitRevisionView.tsx`
- Modify: `ui/src/components/Topbar/Topbar.tsx` and More Actions menu
- Modify: `ui/src/contexts/AppStateContext.tsx`
- Modify: `ui/src/components/Content/DocumentSurface.tsx`
- Modify: `ui/src/components/SplitView/DocumentPane.tsx`
- Test: `tests/unit/ui/history/document-history-panel.test.tsx`
- Test: `tests/unit/ui/history/git-revision-view.test.tsx`

**Interfaces:**
- History panel emits `onViewRevision(revision)`, `onCompareCurrent(revision)`, `onCompareSelected(left, right)`.
- `GitRevisionView` accepts a `GitRevisionSnapshot` and renders with the existing client Markdown renderer; it exposes no editing controls.

- [ ] **Step 1: Write failing UI tests**

```tsx
it('loads history only when the panel opens', async () => {
  render(<DocumentHistoryPanel filePath="/docs/a.md" client={client} />);
  expect(client.listDocumentHistory).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /load history/i }));
  expect(client.listDocumentHistory).toHaveBeenCalledWith('/docs/a.md');
});

it('historical revision view is read-only', () => {
  render(<GitRevisionView snapshot={{ oid: fullOid, path: 'a.md', source: '# Old' }} />);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Old' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/history/document-history-panel.test.tsx tests/unit/ui/history/git-revision-view.test.tsx
```

Expected: FAIL because history UI does not exist.

- [ ] **Step 3: Implement lazy history UI and pane revision mode**

Do not request Git capability/history during normal navigation. Open History from More Actions; then request capability and list. Render revision rows with subject, author, localized timestamp, short OID, and path when renamed.

`View revision` reads the snapshot and sets the active pane/single document surface to `git-revision` mode using pane revision state; the historical source is held in history-view state, not `documentSessions`. Hide Plain/Inline/Save controls in this mode.

- [ ] **Step 4: Run history UI and editing regression tests**

```bash
pnpm vitest run tests/unit/ui/history tests/unit/ui/editor tests/unit/ui/split-view
```

Expected: PASS; viewing old content cannot dirty or save the current document.

- [ ] **Step 5: Commit History UI**

```bash
git add ui/src/components/History/DocumentHistoryPanel.tsx ui/src/components/History/GitRevisionView.tsx ui/src/components/Topbar/Topbar.tsx ui/src/contexts/AppStateContext.tsx ui/src/components/Content/DocumentSurface.tsx ui/src/components/SplitView/DocumentPane.tsx tests/unit/ui/history
git commit -m "feat(history): browse document revisions locally"
```

---

### Task 5: Implement dependency-free Myers line diff and changed source ranges

**Files:**
- Create: `ui/src/history/lineDiff.ts`
- Create: `ui/src/history/diffRanges.ts`
- Test: `tests/unit/ui/history/line-diff.test.ts`
- Test: `tests/unit/ui/history/diff-ranges.test.ts`

**Interfaces:**

```ts
export type DiffLine =
  | { readonly type: 'context'; readonly left: number; readonly right: number; readonly text: string }
  | { readonly type: 'remove'; readonly left: number; readonly text: string }
  | { readonly type: 'add'; readonly right: number; readonly text: string };

export interface DiffHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly DiffLine[];
}

export function diffLines(leftSource: string, rightSource: string, contextLines = 3): DiffHunk[];
export function changedCharacterRanges(source: string, hunks: readonly DiffHunk[], side: 'left' | 'right'): readonly { start: number; end: number }[];
```

- [ ] **Step 1: Write failing algorithm tests**

```ts
it('produces deterministic add/remove/context lines', () => {
  const hunks = diffLines('a\nb\nc', 'a\nx\nc');
  expect(hunks[0].lines).toEqual([
    { type: 'context', left: 1, right: 1, text: 'a' },
    { type: 'remove', left: 2, text: 'b' },
    { type: 'add', right: 2, text: 'x' },
    { type: 'context', left: 3, right: 3, text: 'c' },
  ]);
});

it('handles empty files and trailing newlines', () => {
  expect(diffLines('', 'x\n')).toMatchSnapshot();
});
```

Also test multiple hunks/context trimming, repeated lines, Unicode, CRLF normalization, and a 10k-line mostly-identical document.

- [ ] **Step 2: Run diff tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/history/line-diff.test.ts tests/unit/ui/history/diff-ranges.test.ts
```

Expected: FAIL because diff engine does not exist.

- [ ] **Step 3: Implement Myers shortest-edit-script and hunk building**

Normalize `\r\n`/`\r` to `\n`, split into lines, and use Myers frontier trace:

```ts
function buildTrace(a: readonly string[], b: readonly string[]): Map<number, number>[] {
  const max = a.length + b.length;
  let frontier = new Map<number, number>([[1, 0]]);
  const trace: Map<number, number>[] = [];
  for (let d = 0; d <= max; d += 1) {
    trace.push(new Map(frontier));
    const next = new Map<number, number>();
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (frontier.get(k - 1) ?? -1) < (frontier.get(k + 1) ?? -1))) {
        x = frontier.get(k + 1) ?? 0;
      } else {
        x = (frontier.get(k - 1) ?? 0) + 1;
      }
      let y = x - k;
      while (x < a.length && y < b.length && a[x] === b[y]) { x += 1; y += 1; }
      next.set(k, x);
      if (x >= a.length && y >= b.length) { trace.push(next); return trace; }
    }
    frontier = next;
  }
  return trace;
}
```

Backtrack the trace into primitive context/add/remove operations, assign 1-based line numbers, then group operations into hunks with exactly `contextLines` unchanged lines around each changed run. `changedCharacterRanges` converts affected line spans into character offsets using a precomputed line-start array; merge overlapping/adjacent ranges.

Do not implement move detection or semantic diff.

- [ ] **Step 4: Run diff tests**

```bash
pnpm vitest run tests/unit/ui/history/line-diff.test.ts tests/unit/ui/history/diff-ranges.test.ts
```

Expected: PASS and the 10k-line mostly-identical fixture completes without quadratic matrix allocation.

- [ ] **Step 5: Commit diff engine**

```bash
git add ui/src/history/lineDiff.ts ui/src/history/diffRanges.ts tests/unit/ui/history/line-diff.test.ts tests/unit/ui/history/diff-ranges.test.ts
git commit -m "feat(diff): add dependency-free markdown line diff"
```

---

### Task 6: Add Source/Rendered Diff UI and integrate Diff mode with split panes

**Files:**
- Create: `ui/src/components/History/DocumentDiffView.tsx`
- Create: `ui/src/components/History/SourceDiffView.tsx`
- Create: `ui/src/components/History/RenderedDiffView.tsx`
- Create: `ui/src/styles/global/global-history-diff.css`
- Modify: `ui/src/styles/global.css`
- Modify: `ui/src/components/History/DocumentHistoryPanel.tsx`
- Modify: `ui/src/components/SplitView/DocumentPane.tsx`
- Modify: `ui/src/components/Content/DocumentSurface.tsx`
- Modify: conflict modal Compare action from editing plan
- Test: `tests/unit/ui/history/source-diff-view.test.tsx`
- Test: `tests/unit/ui/history/rendered-diff-view.test.tsx`
- Test: `tests/unit/ui/history/history-split-integration.test.tsx`

**Interfaces:**
- `DocumentDiffView({ leftSource, rightSource, leftLabel, rightLabel, defaultMode })`.
- Source mode consumes `diffLines`.
- Rendered mode renders each complete source through the existing renderer and highlights source-backed DOM blocks whose `data-mdn-source-start/end` overlap `changedCharacterRanges`.

- [ ] **Step 1: Write failing Source/Rendered diff tests**

```tsx
it('source diff exposes additions and removals with semantic labels', () => {
  render(<DocumentDiffView leftSource={'# A\nold'} rightSource={'# A\nnew'} leftLabel="old" rightLabel="current" defaultMode="source" />);
  expect(screen.getByText('old').closest('[data-diff-type]')).toHaveAttribute('data-diff-type', 'remove');
  expect(screen.getByText('new').closest('[data-diff-type]')).toHaveAttribute('data-diff-type', 'add');
});

it('rendered diff renders complete valid Markdown and marks changed blocks', () => {
  render(<DocumentDiffView leftSource={'# A\n\nold'} rightSource={'# A\n\nnew'} leftLabel="old" rightLabel="current" defaultMode="rendered" />);
  expect(screen.getAllByRole('heading', { name: 'A' })).toHaveLength(2);
  expect(document.querySelectorAll('.is-diff-changed')).not.toHaveLength(0);
});
```

- [ ] **Step 2: Run UI tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/history/source-diff-view.test.tsx tests/unit/ui/history/rendered-diff-view.test.tsx tests/unit/ui/history/history-split-integration.test.tsx
```

Expected: FAIL because diff views do not exist.

- [ ] **Step 3: Implement source table and full-document rendered comparison**

Source diff uses one accessible row per `DiffLine`, line-number columns, and text status (`Added`, `Removed`, `Unchanged`) in addition to styling. Synchronize the left/right scroll containers in diff mode with a reentrancy guard.

Rendered diff must **not** render partial Markdown hunks. Render the entire left and right sources with `renderMarkdownClientSide`, then after DOM mount:

```ts
for (const element of root.querySelectorAll<HTMLElement>('[data-mdn-source-start][data-mdn-source-end]')) {
  const start = Number(element.dataset.mdnSourceStart);
  const end = Number(element.dataset.mdnSourceEnd);
  if (ranges.some((range) => start < range.end && end > range.start)) {
    element.classList.add('is-diff-changed');
  }
}
```

Use removed styling on the left and added styling on the right. This preserves valid Mermaid/math/table rendering because each side remains a complete document.

History actions:
- Compare with current persisted -> revision snapshot vs `session.persistedSource`.
- Compare with working copy -> revision/disk vs `session.source` when dirty.
- Compare two revisions -> `compareGitRevisions` or two snapshots, then shared diff.
- Conflict Compare -> `conflict.diskSource` vs session working `source`; no Git required.

Enable `git-revision` and `diff` mode choices only when the pane has corresponding history view data. Historical revision remains read-only.

- [ ] **Step 4: Run history/diff/split/editor integration tests**

```bash
pnpm vitest run tests/unit/ui/history tests/unit/ui/split-view tests/unit/ui/editor
```

Expected: PASS, including conflict diff on a non-Git workspace.

- [ ] **Step 5: Commit diff UI/integration**

```bash
git add ui/src/components/History ui/src/components/SplitView/DocumentPane.tsx ui/src/components/Content/DocumentSurface.tsx ui/src/styles/global/global-history-diff.css ui/src/styles/global.css tests/unit/ui/history
git commit -m "feat(diff): compare markdown revisions in source and rendered views"
```

---

### Task 7: Localize, document, and fully verify Git History/Diff

**Files:**
- Modify translation types/data for all nine locales
- Modify `README.md`
- Modify `CHANGELOG.md`
- Add/update Git History/Diff use-case and feature docs
- Modify runtime/capability/current-state/protocol catalogs
- Modify coverage/manifest/release acceptance tests

**Interfaces:**
- Documents exact commands, capability matrix, read-only guarantees, and diff modes.

- [ ] **Step 1: Add failing documentation/localization assertions**

Require translations for History, View revision, Compare with current, Compare with…, Source Diff, Rendered Diff, Git unavailable, Not a Git repository, unsupported runtime, Added, Removed, and Unchanged.

- [ ] **Step 2: Run contract/localization tests and verify failure**

```bash
pnpm run test:translations
pnpm run test:contracts
pnpm run test:node
```

Expected: FAIL until docs and all nine locales are synchronized.

- [ ] **Step 3: Update docs/capability matrices**

Document that Electron/Tauri/VS Code use installed local Git, Chromium/Web do not provide Git, all Git operations are read-only, all command arguments are structured/no-shell, historical snapshots are read-only, and diff computation is local/dependency-free.

- [ ] **Step 4: Run final complete verification for all three plans**

```bash
pnpm run test:ui
pnpm run test:electron
pnpm run test:vscode
pnpm run test:chromium
pnpm run test:contracts
pnpm run test:node
pnpm run test:translations
pnpm run lint:ui-styles
pnpm run build
cargo test --manifest-path tauri/Cargo.toml -- --test-threads=1
```

Expected: every command exits 0. Also manually verify on at least one Git repository: edit/save, conflict protection, two-pane independent modes, history rename traversal, revision view, revision-to-current diff, and dirty working-copy diff.

- [ ] **Step 5: Commit final docs/coverage synchronization**

```bash
git add README.md CHANGELOG.md docs ui/src/contexts tests
git commit -m "docs: document git history and diff viewer"
```
