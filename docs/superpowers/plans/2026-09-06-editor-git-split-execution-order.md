# Editor, Git History, and Split View Execution Order

> **For agentic workers:** This is the authoritative entrypoint for the three implementation plans in this directory. Where a type/signature below is more specific than a subplan, this file wins.

**Spec:** `docs/superpowers/specs/2026-09-06-editor-git-history-split-view-design.md`

## Required order

1. `2026-09-06-markdown-editing-save-core.md` Tasks 1-2.
2. Execute the **Source Integrity Gate** below.
3. Finish `2026-09-06-markdown-editing-save-core.md` Tasks 3-8.
4. Execute `2026-09-06-split-document-view.md` Tasks 1-6.
5. Execute `2026-09-06-git-history-diff-viewer.md` Tasks 1-7.
6. Run the final verification command set from the Git History/Diff plan.

## Cross-plan type ownership

Use one definition for each shared concept:

```ts
// ui/src/editor/documentSession.ts
export type MarkdownEditMode = 'rendered' | 'inline-edit' | 'plain';
export type LineEnding = '\n' | '\r\n';

// ui/src/split-view/paneState.ts
import type { MarkdownEditMode } from '../editor/documentSession';
export type DocumentViewMode = MarkdownEditMode | 'git-revision' | 'diff';
```

Do not redefine these unions in components or history modules.

All editable-session map access must use one key helper:

```ts
import { normalizePathKey } from '../contexts/appStateModel';

export function documentSessionKey(filePath: string): string {
  return normalizePathKey(filePath);
}
```

This prevents the same Windows file from acquiring separate dirty sessions because of slash/case differences.

## Source Integrity Gate

The existing Markdown parser normalizes CRLF/CR to LF before producing `sourceStart`/`sourceEnd`. Inline editing therefore must use a canonical LF working source, while disk writes preserve the file's original dominant line-ending style.

MDX currently hides import/export lines before tokenization. Those hidden lines must retain their original length so later rendered source offsets still point to the correct source text.

### Files

- Modify `ui/src/editor/documentSession.ts`.
- Modify `ui/src/editor/saveDocument.ts`.
- Modify `ui/src/markdown/parser.ts`.
- Test `tests/unit/ui/editor/document-session.test.ts`.
- Test `tests/unit/ui/markdown/parser.test.ts`.

### Required session shape

Amend `EditableDocumentSession` from the editing plan to include:

```ts
export interface EditableDocumentSession {
  readonly filePath: string;
  readonly source: string;           // canonical LF
  readonly persistedSource: string;  // canonical LF
  readonly lineEnding: LineEnding;
  readonly revision: DocumentRevisionToken | null;
  readonly saveState: 'idle' | 'saving' | 'conflict';
  readonly conflict: DocumentConflict | null;
}
```

Add these helpers:

```ts
export function canonicalizeDocumentSource(raw: string): { source: string; lineEnding: LineEnding } {
  const crlf = (raw.match(/\r\n/g) ?? []).length;
  const bareLf = (raw.match(/(?<!\r)\n/g) ?? []).length;
  const lineEnding: LineEnding = crlf > bareLf ? '\r\n' : '\n';
  return {
    source: raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    lineEnding,
  };
}

export function serializeDocumentSource(source: string, lineEnding: LineEnding): string {
  return lineEnding === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
}
```

`createEditableDocumentSession(filePath, rawSource, revision)` must canonicalize `rawSource`. `saveDocument.ts` must send `serializeDocumentSource(session.source, session.lineEnding)` to the host while dirty comparison remains canonical-LF-to-canonical-LF.

When a conflict response returns raw `diskSource`, canonicalize it before placing it in `DocumentConflict`. Reloading the disk version must also adopt the detected disk line ending.

### Required tests

Add:

```ts
it('keeps CRLF as the disk serialization while editing canonical LF offsets', () => {
  const session = createEditableDocumentSession('/docs/a.md', '# A\r\n\r\nText\r\n', '1:12');
  expect(session.source).toBe('# A\n\nText\n');
  expect(session.lineEnding).toBe('\r\n');
  expect(serializeDocumentSource('# B\n\nText\n', session.lineEnding)).toBe('# B\r\n\r\nText\r\n');
});
```

Run:

```bash
pnpm vitest run tests/unit/ui/editor/document-session.test.ts
```

Expected: PASS.

### MDX offset preservation

In `ui/src/markdown/parser.ts`, replace the current length-changing import/export filter with same-length whitespace lines:

```ts
if (isMdx) {
  const lines = body.split('\n');
  body = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
      return ' '.repeat(line.length);
    }
    return line;
  }).join('\n');
}
```

This keeps imports/exports non-rendering while preserving line and character offsets.

Add parser tests:

```ts
it('keeps MDX source ranges aligned after imports', () => {
  const source = "import Card from './Card'\n\n# Heading\n\nBody";
  const { tokens } = parse(source, true);
  const heading = tokens.find((token) => token.type === 'heading');
  expect(heading?.sourceStart).toBe(source.indexOf('# Heading'));
  expect(source.slice(heading!.sourceStart, heading!.sourceEnd)).toBe('# Heading');
});

it('keeps MDX source ranges aligned after exports', () => {
  const source = "export const value = 1\n\nParagraph";
  const { tokens } = parse(source, true);
  const paragraph = tokens.find((token) => token.type === 'paragraph');
  expect(source.slice(paragraph!.sourceStart, paragraph!.sourceEnd)).toBe('Paragraph');
});
```

Run:

```bash
pnpm vitest run tests/unit/ui/markdown/parser.test.ts tests/unit/ui/markdown/renderer.test.ts
```

Expected: PASS.

Commit the gate separately:

```bash
git add ui/src/editor/documentSession.ts ui/src/editor/saveDocument.ts ui/src/markdown/parser.ts tests/unit/ui/editor/document-session.test.ts tests/unit/ui/markdown/parser.test.ts
git commit -m "fix(editor): preserve markdown source offset integrity"
```

## Final consistency rules

- `EditableDocumentSession.source` and `persistedSource` are always canonical LF strings.
- Host `saveDocument.source` is serialized to the session's disk line ending before crossing the bridge.
- Rendered `data-mdn-source-start/end` offsets are applied only to canonical LF working source.
- MDX imports/exports remain invisible but do not alter source positions.
- One normalized path maps to exactly one editable session regardless of pane count.
- Historical Git snapshots are never inserted into `documentSessions`.
- Split panes reference sessions; they never clone working source.
- Diff inputs are immutable source snapshots and never mutate editor sessions.
