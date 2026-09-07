# Markdown Editing and Safe Save Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dependency-free Plain and Inline Edit modes for `.md`/`.mdx` documents with shared dirty state, safe local saves, conflict protection, and writable-host parity across Electron, Tauri, VS Code, Chromium, and capable Web runtimes.

**Architecture:** Keep editable working copies in shared React state keyed by normalized file path. Reuse existing parser source offsets and renderer `data-mdn-source-start/end` attributes for inline block editing. All filesystem writes remain behind the typed bridge; each host validates the target, compares a revision token, writes locally, and returns a correlated result.

**Tech Stack:** React 19, TypeScript, existing Markdown Explorer parser/renderer, Node `fs`/`path`, Rust stdlib + Tauri host, VS Code `workspace.fs`, File System Access API. Zero new production dependencies.

**Spec:** `docs/superpowers/specs/2026-09-06-editor-git-history-split-view-design.md`

## Global Constraints

- Add **zero new production dependencies**.
- No CodeMirror, Monaco, TipTap, ProseMirror, or equivalent editor framework.
- Editing is local-only; no upload, remote editor, telemetry, or cloud service.
- Electron, Tauri, VS Code, Chromium, and Web-with-write-capability must save Markdown.
- Browser environments without writable File System Access stay read-only.
- Never silently overwrite a file that changed after the editing revision was loaded.
- Inline editing only applies to reliable source-backed Markdown blocks; ambiguous content remains editable in Plain mode.
- Existing Open in Editor behavior remains available.
- All new user-facing strings must enter the existing nine-locale localization system.

---

## File Structure

### Shared editor domain

- Create `ui/src/editor/documentSession.ts` — pure editable-session state transitions and dirty derivation.
- Create `ui/src/editor/saveDocument.ts` — request correlation and save-result normalization.
- Create `ui/src/editor/inlineEdit.ts` — source-range validation and range replacement.
- Create `ui/src/components/Content/PlainMarkdownEditor.tsx` — full-source native editor.
- Create `ui/src/components/Content/InlineMarkdownEditor.tsx` — native block editor rendered into the selected source-backed block.
- Create `ui/src/components/Content/useInlineMarkdownEditing.ts` — event delegation, active block selection, and portal target lifecycle.
- Create `ui/src/styles/global/global-markdown-editing.css` — editor/dirty/conflict styles.

### Shared state/protocol

- Modify `ui/src/types/content.ts` — revision/write metadata on rendered documents/content tabs.
- Modify `ui/src/types/webviewMessages.ts` — `saveDocument` request.
- Modify `ui/src/types/hostMessages.ts` — `saveDocumentResult` response.
- Modify `ui/src/contexts/appStateModel.ts` — editable sessions + actions.
- Modify `ui/src/contexts/contentTabState.ts` — seed sessions from rendered source and re-render working source.
- Modify `ui/src/contexts/AppStateContext.tsx` — expose edit/save actions.
- Modify `ui/src/components/Content/Content.tsx` and `ContentMainView.tsx` — mode rendering and conflict UI.
- Modify `ui/src/components/Content/ContentTabItem.tsx` — dirty marker.
- Modify `ui/src/components/Topbar/Topbar.tsx` and settings keyboard catalogs — mode/save actions.

### Runtime hosts

- Create `electron/workspace/document-write.js`; modify `electron/core/runtime-command-handlers.js` and render-content path.
- Create `tauri/src/dispatcher/document_write.rs`; modify `tauri/src/dispatcher.rs`, `tauri/src/host_message.rs`, and module registration.
- Create `vscode/src/core/panelDocumentWrite.ts`; modify `vscode/src/core/panel.ts` and render-content path.
- Modify `chromium-xtension/src/file-access.ts` and `chromium-xtension/src/chrome-host.ts`.
- Modify `website-app/src/web-file-mode.ts` and `website-app/src/web-host.ts`.

### Tests/docs

- Create `tests/unit/ui/editor/document-session.test.ts`.
- Create `tests/unit/ui/editor/inline-edit.test.ts`.
- Create `tests/unit/ui/components/plain-markdown-editor.test.tsx`.
- Create `tests/unit/electron/document-write.test.ts`.
- Create `tests/unit/vscode/panel-document-write.test.ts`.
- Create/extend Chromium/Web host tests for write permission and revision conflicts.
- Add Rust unit tests beside `tauri/src/dispatcher/document_write.rs`.
- Modify protocol parity/coverage tests and docs catalogs.

---

### Task 1: Add editable document-session and save protocol contracts

**Files:**
- Create: `ui/src/editor/documentSession.ts`
- Modify: `ui/src/types/content.ts`
- Modify: `ui/src/types/webviewMessages.ts`
- Modify: `ui/src/types/hostMessages.ts`
- Modify: `ui/src/contexts/appStateModel.ts`
- Test: `tests/unit/ui/editor/document-session.test.ts`
- Test: `tests/contracts/host-message-parity.test.ts`

**Interfaces:**
- Produces: `DocumentRevisionToken`, `DocumentWriteCapability`, `EditableDocumentSession`, `SaveDocumentMessage`, `SaveDocumentResultMessage`.
- Produces pure functions: `createEditableDocumentSession`, `isDocumentDirty`, `replaceWorkingSource`, `markSaveStarted`, `markSaveSucceeded`, `markSaveConflict`, `discardWorkingChanges`.

- [ ] **Step 1: Write failing session-state tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  createEditableDocumentSession,
  discardWorkingChanges,
  isDocumentDirty,
  markSaveConflict,
  markSaveSucceeded,
  replaceWorkingSource,
} from '../../../../ui/src/editor/documentSession';

describe('editable document session', () => {
  it('derives dirty state from working and persisted source', () => {
    const clean = createEditableDocumentSession('/docs/a.md', '# A', '10:3');
    expect(isDocumentDirty(clean)).toBe(false);
    expect(isDocumentDirty(replaceWorkingSource(clean, '# B'))).toBe(true);
  });

  it('keeps the working source when a save conflicts', () => {
    const edited = replaceWorkingSource(createEditableDocumentSession('/docs/a.md', '# A', '10:3'), '# Mine');
    const conflicted = markSaveConflict(edited, '# Disk', '20:6');
    expect(conflicted.source).toBe('# Mine');
    expect(conflicted.conflict?.diskSource).toBe('# Disk');
  });

  it('advances persisted source and revision after a successful save', () => {
    const edited = replaceWorkingSource(createEditableDocumentSession('/docs/a.md', '# A', '10:3'), '# B');
    const saved = markSaveSucceeded(edited, '30:3');
    expect(saved.persistedSource).toBe('# B');
    expect(saved.revision).toBe('30:3');
    expect(isDocumentDirty(saved)).toBe(false);
  });

  it('discard restores the last persisted source', () => {
    const edited = replaceWorkingSource(createEditableDocumentSession('/docs/a.md', '# A', '10:3'), '# B');
    expect(discardWorkingChanges(edited).source).toBe('# A');
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
pnpm vitest run tests/unit/ui/editor/document-session.test.ts
```

Expected: FAIL because `ui/src/editor/documentSession.ts` and the exported types/functions do not exist.

- [ ] **Step 3: Implement the pure session model and protocol types**

Add to `ui/src/types/content.ts`:

```ts
export type DocumentRevisionToken = string;

export interface DocumentWriteCapability {
  readonly supported: boolean;
  readonly revision: DocumentRevisionToken | null;
  readonly reason?: 'read-only-runtime' | 'permission-required' | 'unsupported-document';
}

export interface DocumentConflict {
  readonly diskSource: string;
  readonly diskRevision: DocumentRevisionToken;
}

export interface EditableDocumentSession {
  readonly filePath: string;
  readonly source: string;
  readonly persistedSource: string;
  readonly revision: DocumentRevisionToken | null;
  readonly saveState: 'idle' | 'saving' | 'conflict';
  readonly conflict: DocumentConflict | null;
}
```

Extend `RenderContentMessage` and `ContentTab` with:

```ts
readonly documentWrite?: DocumentWriteCapability;
```

Add to `ui/src/types/webviewMessages.ts`:

```ts
export interface SaveDocumentMessage {
  readonly command: 'saveDocument';
  readonly requestId: string;
  readonly filePath: string;
  readonly source: string;
  readonly expectedRevision: DocumentRevisionToken | null;
  readonly force?: boolean;
}
```

Add to `ui/src/types/hostMessages.ts`:

```ts
export interface SaveDocumentResultMessage {
  readonly command: 'saveDocumentResult';
  readonly requestId: string;
  readonly filePath: string;
  readonly ok: boolean;
  readonly revision?: DocumentRevisionToken;
  readonly diskSource?: string;
  readonly diskRevision?: DocumentRevisionToken;
  readonly reason?: 'conflict' | 'permission-denied' | 'missing' | 'outside-workspace' | 'read-only' | 'write-failed';
  readonly error?: string;
}
```

Create `ui/src/editor/documentSession.ts` with immutable implementations matching the test names. Add `documentSessions: Record<string, EditableDocumentSession>` to `AppState` and initialize it to `{}`. Do not add UI behavior yet.

- [ ] **Step 4: Run session and protocol contract tests**

Run:

```bash
pnpm vitest run tests/unit/ui/editor/document-session.test.ts tests/contracts/host-message-parity.test.ts
```

Expected: PASS after updating the parity fixture/catalog expectations for the new request/response discriminants.

- [ ] **Step 5: Commit the contract/state foundation**

```bash
git add ui/src/editor/documentSession.ts ui/src/types/content.ts ui/src/types/webviewMessages.ts ui/src/types/hostMessages.ts ui/src/contexts/appStateModel.ts tests/unit/ui/editor/document-session.test.ts tests/contracts/host-message-parity.test.ts
git commit -m "feat(editor): add editable document session contracts"
```

---

### Task 2: Seed working sessions from rendered Markdown and re-render unsaved source

**Files:**
- Modify: `ui/src/contexts/contentTabState.ts`
- Modify: `ui/src/contexts/appStateModel.ts`
- Modify: `ui/src/contexts/AppStateContext.tsx`
- Create: `ui/src/editor/saveDocument.ts`
- Test: `tests/unit/ui/contexts/content-tab-editing.test.ts`
- Test: `tests/unit/ui/editor/save-document.test.ts`

**Interfaces:**
- Consumes: `EditableDocumentSession`, `DocumentWriteCapability` from Task 1.
- Produces: `ensureDocumentSession(state, tab)`, `updateWorkingDocumentSource(state, filePath, source)`, `applySavedDocumentResult(state, result)`.
- Produces context actions: `setWorkingDocumentSource(filePath, source)`, `saveDocument(filePath, options?)`, `discardDocumentChanges(filePath)`.

- [ ] **Step 1: Write failing reducer/helper tests**

```ts
it('creates one shared session when markdown content first renders', () => {
  const next = applyRenderContentWithSession(initialState, renderMessage({
    filePath: '/docs/a.md',
    markdownSource: '# A',
    documentWrite: { supported: true, revision: '10:3' },
  }));
  expect(next.documentSessions['/docs/a.md'].source).toBe('# A');
});

it('re-renders the active document from unsaved working source', () => {
  const next = updateWorkingDocumentSource(stateWithMarkdown('# A'), '/docs/a.md', '# B');
  expect(next.documentSessions['/docs/a.md'].source).toBe('# B');
  expect(next.contentHtml).toContain('B');
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/contexts/content-tab-editing.test.ts tests/unit/ui/editor/save-document.test.ts
```

Expected: FAIL because session seeding, working-source updates, and save correlation do not exist.

- [ ] **Step 3: Implement shared working-copy flow**

In `contentTabState.ts`, when a Markdown/MDX `RenderContentMessage` contains source and `documentWrite`, seed a session only when no dirty session already exists for that normalized path. Preserve a dirty session when a filesystem watcher emits a stale-content signal; do not replace user edits.

Implement working-source update as:

```ts
const rendered = renderMarkdownClientSide(source, filePath, /\.mdx$/i.test(filePath), state.settings);
```

Update the matching `ContentTab` and active document projection from that rendered result while leaving `persistedSource` unchanged.

In `saveDocument.ts`, use one `requestId` per write, post the exact `SaveDocumentMessage`, and resolve only the matching `saveDocumentResult`. On success call `markSaveSucceeded`; on conflict call `markSaveConflict`; on failure leave source dirty.

- [ ] **Step 4: Run state/save tests**

```bash
pnpm vitest run tests/unit/ui/contexts/content-tab-editing.test.ts tests/unit/ui/editor/save-document.test.ts
```

Expected: PASS, including a test proving two consumers of the same path observe the same `documentSessions[path]` object after updates.

- [ ] **Step 5: Commit working-copy state**

```bash
git add ui/src/contexts/contentTabState.ts ui/src/contexts/appStateModel.ts ui/src/contexts/AppStateContext.tsx ui/src/editor/saveDocument.ts tests/unit/ui/contexts/content-tab-editing.test.ts tests/unit/ui/editor/save-document.test.ts
git commit -m "feat(editor): manage shared markdown working copies"
```

---

### Task 3: Implement Electron and VS Code safe-save adapters

**Files:**
- Create: `electron/workspace/document-write.js`
- Modify: `electron/core/runtime-command-handlers.js`
- Modify: Electron Markdown render-content loader to attach `documentWrite`
- Create: `vscode/src/core/panelDocumentWrite.ts`
- Modify: `vscode/src/core/panel.ts`
- Modify: VS Code Markdown render-content loader to attach `documentWrite`
- Test: `tests/unit/electron/document-write.test.ts`
- Test: `tests/unit/vscode/panel-document-write.test.ts`

**Interfaces:**
- Produces host-local `revisionFor(path)` using metadata modification time + byte length.
- Electron produces `handleSaveDocument(message, context)`.
- VS Code produces `handlePanelDocumentWrite(message, deps)`.

- [ ] **Step 1: Write failing host tests**

```ts
it('rejects an Electron write outside the workspace', async () => {
  const result = await saveWorkspaceDocument({
    workspacePath: root,
    filePath: '../escape.md',
    source: '# nope',
    expectedRevision: null,
  });
  expect(result.reason).toBe('outside-workspace');
});

it('returns conflict without overwriting when revision changed', async () => {
  const before = await revisionFor(file);
  await fs.promises.writeFile(file, '# External');
  const result = await saveWorkspaceDocument({ workspacePath: root, filePath: file, source: '# Mine', expectedRevision: before });
  expect(result.reason).toBe('conflict');
  expect(await fs.promises.readFile(file, 'utf8')).toBe('# External');
});
```

For VS Code, inject a fake `workspace.fs` and assert `writeFile` is not called on stale revision.

- [ ] **Step 2: Run Electron and VS Code tests and verify failure**

```bash
pnpm vitest run tests/unit/electron/document-write.test.ts tests/unit/vscode/panel-document-write.test.ts
```

Expected: FAIL because the host adapters do not exist.

- [ ] **Step 3: Implement path validation, revision comparison, and write**

Electron revision format:

```js
async function revisionFor(filePath) {
  const stat = await fs.promises.stat(filePath);
  return `${Math.trunc(stat.mtimeMs)}:${stat.size}`;
}
```

Resolve the requested path, verify it is equal to or beneath the active workspace root, read current source/revision before writing, and return conflict data when `expectedRevision !== currentRevision` unless `force === true`. Use `fs.promises.writeFile(target, source, 'utf8')`; do not invoke a shell.

VS Code uses `workspace.fs.stat`, `workspace.fs.readFile`, and `workspace.fs.writeFile`; compute the same logical `mtime:size` token from `FileStat.mtime` and byte length. Validate that the URI belongs to the active workspace folder before writing.

Attach `{ supported: true, revision }` to Markdown/MDX `renderContent` messages in both hosts. Converted/non-Markdown previews get `{ supported: false, revision: null, reason: 'unsupported-document' }`.

- [ ] **Step 4: Run host tests**

```bash
pnpm vitest run tests/unit/electron/document-write.test.ts tests/unit/vscode/panel-document-write.test.ts
```

Expected: PASS for success, outside-workspace rejection, missing file, conflict, explicit force-save, and write failure.

- [ ] **Step 5: Commit Electron/VS Code adapters**

```bash
git add electron/workspace/document-write.js electron/core/runtime-command-handlers.js vscode/src/core/panelDocumentWrite.ts vscode/src/core/panel.ts tests/unit/electron/document-write.test.ts tests/unit/vscode/panel-document-write.test.ts
git commit -m "feat(editor): save markdown safely on electron and vscode"
```

---

### Task 4: Implement Tauri, Chromium, and Web safe-save adapters

**Files:**
- Create: `tauri/src/dispatcher/document_write.rs`
- Modify: `tauri/src/dispatcher.rs`
- Modify: `tauri/src/host_message.rs`
- Modify: Tauri render-content builder to attach write metadata
- Modify: `chromium-xtension/src/file-access.ts`
- Modify: `chromium-xtension/src/chrome-host.ts`
- Modify: `website-app/src/web-file-mode.ts`
- Modify: `website-app/src/web-host.ts`
- Test: Rust module tests in `tauri/src/dispatcher/document_write.rs`
- Test: `tests/unit/chromium/file-access-write.test.ts`
- Test: `tests/unit/website/web-file-write.test.ts`

**Interfaces:**
- Tauri produces `save_document(...) -> SaveDocumentOutcome` and revision token from `Metadata.modified()` + `len()`.
- Browser produces `writeTextFile(root, relativePath, source, expectedRevision, force)` and single-file equivalent.

- [ ] **Step 1: Write failing Tauri/browser tests**

Rust test shape:

```rust
#[test]
fn stale_revision_returns_conflict_without_overwrite() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("a.md");
    std::fs::write(&file, "# A").unwrap();
    let old = document_revision(&file).unwrap();
    std::fs::write(&file, "# External").unwrap();
    let result = save_document_to_path(dir.path(), &file, "# Mine", Some(&old), false).unwrap();
    assert!(matches!(result, SaveDocumentOutcome::Conflict { .. }));
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "# External");
}
```

Browser test shape:

```ts
it('requests readwrite permission before creating a writable stream', async () => {
  const result = await writeTextFile(rootHandle, 'a.md', '# B', '10:3', false);
  expect(rootHandle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  expect(result.ok).toBe(true);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
cargo test --manifest-path tauri/Cargo.toml document_write -- --test-threads=1
pnpm vitest run tests/unit/chromium/file-access-write.test.ts tests/unit/website/web-file-write.test.ts
```

Expected: FAIL because write helpers/routes do not exist.

- [ ] **Step 3: Implement Tauri and File System Access writes**

Tauri must canonicalize the workspace root and target parent, reject any target outside the workspace, compare revision before writing, and emit `saveDocumentResult` through the existing host message path.

Browser `file-access.ts` adds:

```ts
export async function documentRevision(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return `${file.lastModified}:${file.size}`;
}

export async function writeTextFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  source: string,
  expectedRevision: string | null,
  force = false,
): Promise<SaveDocumentHostResult> {
  if (!(await verifyPermission(root, true))) return { ok: false, reason: 'permission-denied' };
  const handle = await resolveFileHandle(root, relativePath);
  if (!handle) return { ok: false, reason: 'missing' };
  const currentRevision = await documentRevision(handle);
  if (!force && expectedRevision !== null && currentRevision !== expectedRevision) {
    return { ok: false, reason: 'conflict', diskSource: await (await handle.getFile()).text(), diskRevision: currentRevision };
  }
  const writable = await handle.createWritable();
  await writable.write(source);
  await writable.close();
  return { ok: true, revision: await documentRevision(handle) };
}
```

Web `web-file-mode.ts` uses the same handle logic for directory and single-file modes. Chromium/Web render messages include `documentWrite` only for `.md`/`.mdx` documents and report `permission-required` before the first granted write.

- [ ] **Step 4: Run Tauri/browser tests**

```bash
cargo test --manifest-path tauri/Cargo.toml document_write -- --test-threads=1
pnpm vitest run tests/unit/chromium/file-access-write.test.ts tests/unit/website/web-file-write.test.ts
```

Expected: PASS for permission denied, successful write, conflict, force-save, missing target, and traversal rejection.

- [ ] **Step 5: Commit remaining runtime adapters**

```bash
git add tauri/src/dispatcher/document_write.rs tauri/src/dispatcher.rs tauri/src/host_message.rs chromium-xtension/src/file-access.ts chromium-xtension/src/chrome-host.ts website-app/src/web-file-mode.ts website-app/src/web-host.ts tests/unit/chromium/file-access-write.test.ts tests/unit/website/web-file-write.test.ts
git commit -m "feat(editor): save markdown safely on tauri and browser hosts"
```

---

### Task 5: Add Plain mode, save action, and dirty tab state

**Files:**
- Create: `ui/src/components/Content/PlainMarkdownEditor.tsx`
- Modify: `ui/src/components/Content/Content.tsx`
- Modify: `ui/src/components/Content/ContentMainView.tsx`
- Modify: `ui/src/components/Content/ContentTabItem.tsx`
- Modify: `ui/src/components/Topbar/Topbar.tsx`
- Modify: `ui/src/components/Settings/settingsActions.ts`
- Modify: `ui/src/contexts/appStateConstants.ts`
- Create: `ui/src/styles/global/global-markdown-editing.css`
- Test: `tests/unit/ui/components/plain-markdown-editor.test.tsx`
- Test: keyboard/action contract tests

**Interfaces:**
- Produces view modes `rendered | inline-edit | plain` for the active document before split-view work extends the union.
- Produces `PlainMarkdownEditor({ value, disabled, onChange, onSave })`.

- [ ] **Step 1: Write failing Plain editor tests**

```tsx
it('edits the working source without writing until Save', async () => {
  render(<PlainMarkdownEditor value="# A" disabled={false} onChange={onChange} onSave={onSave} />);
  await userEvent.clear(screen.getByRole('textbox'));
  await userEvent.type(screen.getByRole('textbox'), '# B');
  expect(onChange).toHaveBeenLastCalledWith('# B');
  expect(onSave).not.toHaveBeenCalled();
  await userEvent.keyboard('{Control>}s{/Control}');
  expect(onSave).toHaveBeenCalledTimes(1);
});
```

Add a `ContentTabItem` test asserting a dirty tab exposes visible `●` plus an accessible dirty label.

- [ ] **Step 2: Run UI tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/components/plain-markdown-editor.test.tsx tests/unit/ui/components/content-tab-item.test.tsx
```

Expected: FAIL because Plain mode and dirty presentation do not exist.

- [ ] **Step 3: Implement Plain mode and topbar/shortcut actions**

Use a native textarea:

```tsx
<textarea
  className="markdown-plain-editor"
  aria-label={t.editor.plainSourceLabel}
  value={value}
  disabled={disabled}
  spellCheck={false}
  onChange={(event) => onChange(event.currentTarget.value)}
  onKeyDown={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      onSave();
    }
  }}
/>
```

Add mode toggle actions only for `.md`/`.mdx` with a working source. Save is enabled only when dirty and writable. Keep existing external `editCurrentDocument` action unchanged.

- [ ] **Step 4: Run Plain mode, tabs, keyboard, and existing content tests**

```bash
pnpm vitest run --project ui tests/unit/ui/components/plain-markdown-editor.test.tsx tests/unit/ui/components/content-tab-item.test.tsx tests/unit/ui/hooks/useKeyboard.test.ts
```

Expected: PASS with no regressions in rendered mode.

- [ ] **Step 5: Commit Plain mode**

```bash
git add ui/src/components/Content/PlainMarkdownEditor.tsx ui/src/components/Content/Content.tsx ui/src/components/Content/ContentMainView.tsx ui/src/components/Content/ContentTabItem.tsx ui/src/components/Topbar/Topbar.tsx ui/src/components/Settings/settingsActions.ts ui/src/contexts/appStateConstants.ts ui/src/styles/global/global-markdown-editing.css tests/unit/ui/components/plain-markdown-editor.test.tsx
git commit -m "feat(editor): add plain markdown editing mode"
```

---

### Task 6: Add Inline Edit using existing rendered source ranges

**Files:**
- Create: `ui/src/editor/inlineEdit.ts`
- Create: `ui/src/components/Content/InlineMarkdownEditor.tsx`
- Create: `ui/src/components/Content/useInlineMarkdownEditing.ts`
- Modify: `ui/src/components/Content/Content.tsx`
- Modify: `ui/src/styles/global/global-markdown-editing.css`
- Test: `tests/unit/ui/editor/inline-edit.test.ts`
- Test: `tests/unit/ui/components/inline-markdown-editor.test.tsx`
- Regression: `tests/unit/ui/markdown/parser.test.ts`, `renderer.test.ts`

**Interfaces:**
- Consumes existing DOM attributes: `data-mdn-source-start`, `data-mdn-source-end`.
- Produces `replaceSourceRange(source, { start, end }, replacement)` and `readEditableRange(element, sourceLength)`.

- [ ] **Step 1: Write failing range and component tests**

```ts
it('replaces exactly the selected Markdown source range', () => {
  expect(replaceSourceRange('# A\n\nText', { start: 0, end: 3 }, '# B')).toBe('# B\n\nText');
});

it('rejects a stale/out-of-bounds rendered source range', () => {
  expect(() => replaceSourceRange('# A', { start: 0, end: 99 }, '# B')).toThrow('Invalid Markdown source range');
});
```

Component test: activate a rendered block with `data-mdn-source-start="5" data-mdn-source-end="9"`, assert its exact source slice appears in the editor, Cancel restores rendered presentation, and Apply calls `onApply` without disk save.

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/editor/inline-edit.test.ts tests/unit/ui/components/inline-markdown-editor.test.tsx
```

Expected: FAIL because inline edit helpers/components do not exist.

- [ ] **Step 3: Implement event delegation and portal editor**

Use the renderer's existing source attributes; do not infer Markdown from HTML. `useInlineMarkdownEditing` listens within `bodyRef` for an explicit edit affordance on top-level source-backed blocks. Add the affordance only to headings, paragraphs, blockquotes/callouts, lists, code blocks, and `.mdn-table-source`.

The active editor uses `createPortal` from `react-dom` into the selected block. While active, add `is-inline-editing` to the target so CSS hides rendered children and displays the native textarea + Apply/Cancel controls.

Apply logic:

```ts
const nextSource = replaceSourceRange(session.source, range, draft);
setWorkingDocumentSource(filePath, nextSource);
closeInlineEditor();
```

Because the working source immediately re-renders, discard the old DOM range after Apply; the next edit reads fresh range attributes from the new render.

- [ ] **Step 4: Run inline, parser, renderer, and Content tests**

```bash
pnpm vitest run tests/unit/ui/editor/inline-edit.test.ts tests/unit/ui/components/inline-markdown-editor.test.tsx tests/unit/ui/markdown/parser.test.ts tests/unit/ui/markdown/renderer.test.ts
```

Expected: PASS, including existing source-range mapping through frontmatter.

- [ ] **Step 5: Commit Inline Edit**

```bash
git add ui/src/editor/inlineEdit.ts ui/src/components/Content/InlineMarkdownEditor.tsx ui/src/components/Content/useInlineMarkdownEditing.ts ui/src/components/Content/Content.tsx ui/src/styles/global/global-markdown-editing.css tests/unit/ui/editor/inline-edit.test.ts tests/unit/ui/components/inline-markdown-editor.test.tsx
git commit -m "feat(editor): edit rendered markdown blocks inline"
```

---

### Task 7: Add conflict resolution and unsaved-change guards

**Files:**
- Create: `ui/src/components/Modal/DocumentConflictModal.tsx`
- Create: `ui/src/components/Modal/UnsavedChangesModal.tsx`
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/components/Content/ContentTabs.tsx`
- Modify: desktop workspace close/quit handling in shared UI and Electron/Tauri host bridge path
- Modify: translations/types/data for all nine locales
- Test: `tests/unit/ui/editor/unsaved-guards.test.tsx`
- Test: `tests/unit/ui/editor/conflict-modal.test.tsx`

**Interfaces:**
- Produces guard result `'save' | 'discard' | 'cancel'`.
- Conflict actions: `reloadDisk`, `keepMine` (force save), `compare` (opens a local unsaved-vs-disk diff entry point consumed by the later Git/Diff plan).

- [ ] **Step 1: Write failing guard/conflict tests**

```tsx
it('cancels tab close when the user cancels the dirty prompt', async () => {
  render(<UnsavedChangesModal fileName="a.md" onChoose={onChoose} />);
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
  expect(onChoose).toHaveBeenCalledWith('cancel');
});

it('force save is only sent after Keep my edit', async () => {
  render(<DocumentConflictModal conflict={conflict} onKeepMine={onKeepMine} onReload={onReload} onCompare={onCompare} />);
  await userEvent.click(screen.getByRole('button', { name: /keep my edit/i }));
  expect(onKeepMine).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm vitest run tests/unit/ui/editor/unsaved-guards.test.tsx tests/unit/ui/editor/conflict-modal.test.tsx
```

Expected: FAIL because the modals/guard coordinator do not exist.

- [ ] **Step 3: Implement dirty close/workspace/quit guards and conflict flow**

Route tab-close, close-other-tabs, close-all-tabs, workspace replacement/close, and desktop quit through one shared guard coordinator. Save waits for a successful correlated `saveDocumentResult`; failure keeps the close operation cancelled. Discard restores `persistedSource`. Cancel does nothing.

Conflict modal behavior:

```text
Reload disk version -> replace source + persistedSource with diskSource and diskRevision
Keep my edit       -> resend saveDocument with force: true and expectedRevision: diskRevision
Compare changes    -> preserve both sources and emit an in-app compare request; do not save
```

For desktop quit, the UI reports whether dirty sessions exist before the host destroys the window. Do not add a host-side hidden copy of document text.

- [ ] **Step 4: Run editor UI tests and core regression suite**

```bash
pnpm vitest run --project ui
pnpm vitest run --project electron --project vscode --project chromium
cargo test --manifest-path tauri/Cargo.toml -- --test-threads=1
```

Expected: PASS; save failures never close dirty documents.

- [ ] **Step 5: Commit guards/conflict handling**

```bash
git add ui/src/components/Modal/DocumentConflictModal.tsx ui/src/components/Modal/UnsavedChangesModal.tsx ui/src/App.tsx ui/src/components/Content/ContentTabs.tsx ui/src/contexts/translations.ts ui/src/contexts/translationsData.ts ui/src/contexts/translationTypes.ts tests/unit/ui/editor/unsaved-guards.test.tsx tests/unit/ui/editor/conflict-modal.test.tsx
git commit -m "feat(editor): protect unsaved and conflicting markdown edits"
```

---

### Task 8: Synchronize protocol docs, user docs, coverage, and full verification

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/instructions/00-foundation/06-coverage-matrix.md`
- Modify: `docs/instructions/05-reference/01-ui-to-host-command-catalog.md`
- Modify: `docs/instructions/05-reference/02-host-to-ui-message-catalog.md`
- Modify: `docs/instructions/05-reference/04-shortcut-catalog.md`
- Modify: `docs/instructions/05-reference/07-current-app-state.md`
- Add/update use-case and feature docs for Markdown editing.
- Modify contract/manifest tests that assert counts.

**Interfaces:**
- No new runtime interface; documents the exact interfaces implemented in Tasks 1-7.

- [ ] **Step 1: Update documentation contract tests first**

Add assertions for `saveDocument`, `saveDocumentResult`, Plain mode, Inline Edit, writable runtime matrix, and dirty/conflict behavior to the existing documentation/coverage contract tests.

- [ ] **Step 2: Run documentation/contract tests and verify failure**

```bash
pnpm run test:contracts
pnpm run test:node
```

Expected: FAIL until docs/catalog counts and feature coverage are updated.

- [ ] **Step 3: Update docs and localization coverage**

Document exact runtime support and explicitly state zero new production editor dependencies. Add the new feature/use-case entries using the repository's existing instruction-document frontmatter format. Update command/message counts based on the final unions rather than hard-coding guessed totals.

- [ ] **Step 4: Run complete verification for this plan**

```bash
pnpm run test:ui
pnpm run test:electron
pnpm run test:vscode
pnpm run test:chromium
pnpm run test:contracts
pnpm run test:node
pnpm run test:translations
pnpm run build
cargo test --manifest-path tauri/Cargo.toml -- --test-threads=1
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit docs and verification updates**

```bash
git add README.md CHANGELOG.md docs tests
 git commit -m "docs: document markdown editing and safe saves"
```
