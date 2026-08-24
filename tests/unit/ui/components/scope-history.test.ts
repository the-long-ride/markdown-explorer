import { describe, expect, it } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import type { DocumentSnapshot } from '../../../../ui/src/export/documentSnapshot';
import {
  MAX_SCOPE_DEPTH,
  createScopeHistory,
  nextScope,
  previousScope,
  pushScope,
  type ScopeEntry,
} from '../../../../ui/src/components/Modal/scopeHistory';

function entry(index: number): ScopeEntry {
  const file: MdFile = {
    fsPath: `/docs/${index}.md`, relativePath: `${index}.md`, parts: [`${index}.md`],
    fileName: `${index}.md`, title: `Doc ${index}`, extension: '.md', documentKind: 'markdown',
  };
  const snapshot: DocumentSnapshot = { file, markdownSource: `# ${index}`, html: `<h1>${index}</h1>` };
  return { file, snapshot };
}

describe('scope history', () => {
  it('moves previous and next without leaving bounds', () => {
    let state = createScopeHistory(entry(1));
    state = pushScope(state, entry(2)).state;
    state = pushScope(state, entry(3)).state;

    expect(previousScope(state).index).toBe(1);
    expect(previousScope(previousScope(state)).index).toBe(0);
    expect(previousScope(previousScope(previousScope(state))).index).toBe(0);
    expect(nextScope(previousScope(state)).index).toBe(2);
    expect(nextScope(state).index).toBe(2);
  });

  it('truncates forward history before pushing a new scope', () => {
    let state = createScopeHistory(entry(1));
    state = pushScope(state, entry(2)).state;
    state = pushScope(state, entry(3)).state;
    state = previousScope(state);

    const result = pushScope(state, entry(4));
    expect(result.blocked).toBe(false);
    expect(result.state.entries.map((item) => item.file.title)).toEqual(['Doc 1', 'Doc 2', 'Doc 4']);
    expect(result.state.index).toBe(2);
  });

  it('blocks an eleventh scope instead of dropping old history', () => {
    let state = createScopeHistory(entry(1));
    for (let i = 2; i <= MAX_SCOPE_DEPTH; i += 1) state = pushScope(state, entry(i)).state;

    const result = pushScope(state, entry(11));
    expect(result.blocked).toBe(true);
    expect(result.state).toBe(state);
    expect(result.state.entries).toHaveLength(10);
    expect(result.state.index).toBe(9);
  });
});
